import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
  customerAddress: PrismaClient['customerAddress'];
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

  registerWithSession(input: {
    name: string;
    email: string;
    passwordHash: string;
    tokenHash: string;
    expiresAt: Date;
    previousTokenHash?: string;
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
    return this.database.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
        },
        select: publicCustomerSelect,
      });
      await tx.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      await tx.emailVerificationToken.create({
        data: { customerId: customer.id, ...input.verification },
      });
      await tx.emailOutbox.create({
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
      });
      if (input.marketing) {
        await tx.newsletterSubscription.upsert({
          where: { email: customer.email },
          update: {
            status: 'SUBSCRIBED',
            consentAt: input.marketing.consentAt,
            unsubscribedAt: null,
            source: 'CUSTOMER_REGISTER',
          },
          create: {
            id: input.marketing.id,
            email: customer.email,
            status: 'SUBSCRIBED',
            consentAt: input.marketing.consentAt,
            source: 'CUSTOMER_REGISTER',
            unsubscribeTokenHash: input.marketing.tokenHash,
          },
        });
        await tx.emailOutbox.create({
          data: {
            eventKey: `newsletter-contact:${customer.id}:subscribe`,
            type: 'NEWSLETTER_SUBSCRIBED',
            recipient: customer.email,
            subject: 'Newsletter contact synchronization',
            template: 'NEWSLETTER_CONTACT_SYNC',
            payload: { unsubscribed: false },
          },
        });
      }
      if (input.previousTokenHash) {
        await tx.customerSession.updateMany({
          where: { tokenHash: input.previousTokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return customer;
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

  findCustomerBySessionHash(tokenHash: string, now: Date) {
    return this.database.customerSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
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
      select: { id: true, email: true, name: true },
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

  verifyEmail(tokenHash: string, now: Date) {
    return this.database.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: { customer: { select: publicCustomerSelect } },
      });
      if (!token) return null;
      if (token.customer.emailVerifiedAt)
        return { customer: token.customer, alreadyVerified: true };
      if (token.usedAt || token.expiresAt <= now) return null;
      const customer = await tx.customer.update({
        where: { id: token.customerId },
        data: { emailVerifiedAt: now },
        select: publicCustomerSelect,
      });
      await tx.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: now },
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
      return { customer, alreadyVerified: false };
    });
  }

  resetPassword(tokenHash: string, passwordHash: string, now: Date) {
    return this.database.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (!token || token.usedAt || token.expiresAt <= now) return null;
      await tx.customer.update({
        where: { id: token.customerId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: now },
      });
      await tx.customerSession.updateMany({
        where: { customerId: token.customerId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { reset: true };
    });
  }

  findOwnedAddress(customerId: string, addressId: string) {
    return this.database.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
  }
}
