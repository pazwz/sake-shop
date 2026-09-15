import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  CustomerRegistrationError,
  type CustomerRegistrationStage,
} from '@/lib/customer-registration-error';

const publicCustomerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
} satisfies Prisma.CustomerSelect;

type CustomerDatabase = Pick<PrismaClient, '$transaction'> & {
  customer: PrismaClient['customer'];
  customerSession: PrismaClient['customerSession'];
};

export class CustomerRepository {
  public constructor(private readonly database: CustomerDatabase = prisma) {}

  findAuthenticationByEmail(email: string) {
    return this.database.customer.findUnique({
      where: { email },
      select: { ...publicCustomerSelect, passwordHash: true },
    });
  }

  findPublicById(id: string) {
    return this.database.customer.findUnique({
      where: { id },
      select: publicCustomerSelect,
    });
  }

  registerPendingVerification(input: {
    name: string;
    email: string;
    passwordHash: string;
    verification: {
      id: string;
      tokenHash: string;
      expiresAt: Date;
    };
    marketing?: {
      id: string;
      tokenHash: string;
      consentAt: Date;
    };
  }) {
    const operation = async <T>(
      stage: CustomerRegistrationStage,
      run: () => Promise<T>,
    ) => {
      try {
        return await run();
      } catch (error) {
        throw new CustomerRegistrationError(stage, error);
      }
    };
    return this.database
      .$transaction(async (tx) => {
        const customer = await operation('CUSTOMER_CREATE', () =>
          tx.customer.create({
            data: {
              name: input.name,
              email: input.email,
              passwordHash: input.passwordHash,
            },
            select: publicCustomerSelect,
          }),
        );
        await operation('VERIFICATION_TOKEN_CREATE', () =>
          tx.emailVerificationToken.create({
            data: { customerId: customer.id, ...input.verification },
          }),
        );
        await operation('EMAIL_OUTBOX_ENQUEUE', () =>
          tx.emailOutbox.create({
            data: {
              eventKey: `customer-verification:${customer.id}`,
              type: 'CUSTOMER_REGISTERED',
              recipient: customer.email,
              subject: 'メールアドレス確認のお願い',
              template: 'EMAIL_VERIFICATION',
              payload: {
                tokenId: input.verification.id,
                customerName: customer.name,
              },
            },
          }),
        );
        const marketing = input.marketing;
        if (marketing) {
          await operation('NEWSLETTER_UPSERT', () =>
            tx.newsletterSubscription.upsert({
              where: { email: customer.email },
              update: {
                status: 'SUBSCRIBED',
                consentAt: marketing.consentAt,
                unsubscribedAt: null,
                source: 'CUSTOMER_REGISTER',
              },
              create: {
                id: marketing.id,
                email: customer.email,
                status: 'SUBSCRIBED',
                consentAt: marketing.consentAt,
                source: 'CUSTOMER_REGISTER',
                unsubscribeTokenHash: marketing.tokenHash,
              },
            }),
          );
          await operation('NEWSLETTER_OUTBOX_ENQUEUE', () =>
            tx.emailOutbox.create({
              data: {
                eventKey: `newsletter-contact:${customer.id}:subscribe`,
                type: 'NEWSLETTER_SUBSCRIBED',
                recipient: customer.email,
                subject: 'Newsletter contact synchronization',
                template: 'NEWSLETTER_CONTACT_SYNC',
                payload: { unsubscribed: false },
              },
            }),
          );
        }
        return customer;
      })
      .catch((error: unknown) => {
        if (error instanceof CustomerRegistrationError) throw error;
        throw new CustomerRegistrationError('TRANSACTION_COMMIT', error);
      });
  }

  rotateSession(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
    previousTokenHash?: string,
  ) {
    return this.database.$transaction(async (tx) => {
      const session = await tx.customerSession.create({
        data: { customerId, tokenHash, expiresAt },
        select: { id: true },
      });
      if (previousTokenHash) {
        await tx.customerSession.updateMany({
          where: { tokenHash: previousTokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return session;
    });
  }

  requestEmailVerification(input: {
    email: string;
    token: { id: string; tokenHash: string; expiresAt: Date };
    now: Date;
    cooldownSince: Date;
  }) {
    return this.database.$transaction(async (tx) => {
      const candidate = await tx.customer.findUnique({
        where: { email: input.email },
        select: { id: true, name: true, email: true, emailVerifiedAt: true },
      });
      if (!candidate || candidate.emailVerifiedAt)
        return { enqueued: false, reason: 'INELIGIBLE' as const };
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM customers WHERE id = ${candidate.id} FOR UPDATE`,
      );
      const customer = await tx.customer.findUnique({
        where: { id: candidate.id },
        select: { id: true, name: true, email: true, emailVerifiedAt: true },
      });
      if (!customer || customer.emailVerifiedAt)
        return { enqueued: false, reason: 'INELIGIBLE' as const };
      const recent = await tx.emailVerificationToken.findFirst({
        where: {
          customerId: customer.id,
          createdAt: { gt: input.cooldownSince },
        },
        select: { id: true },
      });
      if (recent) return { enqueued: false, reason: 'COOLDOWN' as const };
      await tx.emailVerificationToken.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: input.now },
      });
      await tx.emailVerificationToken.create({
        data: { customerId: customer.id, ...input.token },
      });
      await tx.emailOutbox.create({
        data: {
          eventKey: `customer-verification:${customer.id}:${input.token.id}`,
          type: 'CUSTOMER_VERIFICATION_REQUESTED',
          recipient: customer.email,
          subject: 'メールアドレス確認のお願い',
          template: 'EMAIL_VERIFICATION',
          payload: { tokenId: input.token.id, customerName: customer.name },
        },
      });
      return { enqueued: true, reason: null };
    });
  }

  findCustomerBySessionHash(tokenHash: string, now: Date) {
    return this.database.customerSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
        customer: { emailVerifiedAt: { not: null } },
      },
      select: { customer: { select: publicCustomerSelect } },
    });
  }

  revokeSession(tokenHash: string, now = new Date()) {
    return this.database.customerSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  findCustomerForPasswordReset(email: string) {
    return this.database.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        emailVerifiedAt: true,
      },
    });
  }

  createPasswordReset(input: {
    id: string;
    customerId: string;
    recipient: string;
    customerName: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.database.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { customerId: input.customerId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: {
          id: input.id,
          customerId: input.customerId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      return tx.emailOutbox.create({
        data: {
          eventKey: `password-reset:${input.id}`,
          type: 'PASSWORD_RESET_REQUESTED',
          recipient: input.recipient,
          subject: 'パスワード再設定',
          template: 'PASSWORD_RESET',
          payload: { tokenId: input.id, customerName: input.customerName },
        },
      });
    });
  }

  verifyEmailAndCreateSession(input: {
    tokenHash: string;
    sessionTokenHash: string;
    sessionExpiresAt: Date;
    now: Date;
  }) {
    return this.database.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({
        where: { tokenHash: input.tokenHash },
        include: { customer: { select: publicCustomerSelect } },
      });
      if (
        !token ||
        token.usedAt ||
        token.expiresAt <= input.now ||
        token.customer.emailVerifiedAt
      )
        return null;
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM customers WHERE id = ${token.customerId} FOR UPDATE`,
      );
      const lockedCustomer = await tx.customer.findUnique({
        where: { id: token.customerId },
        select: { emailVerifiedAt: true },
      });
      if (lockedCustomer?.emailVerifiedAt) return null;
      const claimed = await tx.emailVerificationToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: input.now },
        },
        data: { usedAt: input.now },
      });
      if (claimed.count !== 1) return null;
      const customer = await tx.customer.update({
        where: { id: token.customerId },
        data: { emailVerifiedAt: input.now },
        select: publicCustomerSelect,
      });
      await tx.emailVerificationToken.updateMany({
        where: {
          customerId: token.customerId,
          id: { not: token.id },
          usedAt: null,
        },
        data: { usedAt: input.now },
      });
      await tx.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash: input.sessionTokenHash,
          expiresAt: input.sessionExpiresAt,
        },
      });
      await tx.emailOutbox.upsert({
        where: { eventKey: `customer-welcome:${customer.id}` },
        update: {},
        create: {
          eventKey: `customer-welcome:${customer.id}`,
          type: 'CUSTOMER_VERIFIED',
          recipient: customer.email,
          subject: '会員登録が完了しました',
          template: 'WELCOME',
          payload: { customerName: customer.name },
        },
      });
      return { customer };
    });
  }

  resetPassword(tokenHash: string, passwordHash: string, now: Date) {
    return this.database.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { customer: { select: { emailVerifiedAt: true } } },
      });
      if (
        !token ||
        token.usedAt ||
        token.expiresAt <= now ||
        !token.customer.emailVerifiedAt
      )
        return null;
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM customers WHERE id = ${token.customerId} FOR UPDATE`,
      );
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return null;
      await tx.customer.update({
        where: { id: token.customerId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.updateMany({
        where: { customerId: token.customerId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.customerSession.updateMany({
        where: { customerId: token.customerId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { reset: true };
    });
  }

  findPasswordById(customerId: string) {
    return this.database.customer.findUnique({
      where: { id: customerId, emailVerifiedAt: { not: null } },
      select: { passwordHash: true },
    });
  }

  changePasswordAndRotateSession(input: {
    customerId: string;
    expectedPasswordHash: string;
    passwordHash: string;
    sessionTokenHash: string;
    sessionExpiresAt: Date;
    now: Date;
  }) {
    return this.database.$transaction(async (tx) => {
      const updated = await tx.customer.updateMany({
        where: {
          id: input.customerId,
          emailVerifiedAt: { not: null },
          passwordHash: input.expectedPasswordHash,
        },
        data: { passwordHash: input.passwordHash },
      });
      if (updated.count !== 1) return null;
      await tx.customerSession.updateMany({
        where: { customerId: input.customerId, revokedAt: null },
        data: { revokedAt: input.now },
      });
      await tx.customerSession.create({
        data: {
          customerId: input.customerId,
          tokenHash: input.sessionTokenHash,
          expiresAt: input.sessionExpiresAt,
        },
      });
      return { changed: true };
    });
  }

  updateProfile(customerId: string, name: string) {
    return this.database.customer.update({
      where: { id: customerId, emailVerifiedAt: { not: null } },
      data: { name },
      select: publicCustomerSelect,
    });
  }
}
