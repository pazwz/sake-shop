import { compare, hash, hashSync } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  CUSTOMER_PASSWORD_HASH_ROUNDS,
  CUSTOMER_SESSION_TTL_SECONDS,
} from '@/config/customer-auth';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '@/config/email';
import {
  ConflictError,
  EmailNotVerifiedError,
  UnauthorizedError,
} from '@/lib/errors';
import { CustomerRegistrationError } from '@/lib/customer-registration-error';
import {
  createCustomerSessionToken,
  hashCustomerSessionToken,
} from '@/lib/customer-session';
import {
  createEmailActionToken,
  hashEmailActionToken,
  isValidEmailActionToken,
} from '@/lib/email-action-token';
import { CustomerRepository } from '@/repositories/customer.repository';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';
import type {
  CustomerLoginInput,
  CustomerRegisterInput,
} from '@/validators/customer-auth.validator';

const invalidCredentials = () =>
  new UnauthorizedError('メールアドレスまたはパスワードが正しくありません。');
const DUMMY_PASSWORD_HASH = hashSync(
  'linxas-invalid-password-sentinel',
  CUSTOMER_PASSWORD_HASH_ROUNDS,
);

export class CustomerAuthService {
  public constructor(
    private readonly customers = new CustomerRepository(),
    private readonly trigger = new EmailDispatchTriggerService(),
  ) {}

  async register(input: CustomerRegisterInput) {
    let stage: 'TOKEN_GENERATION' | 'PASSWORD_HASH' = 'TOKEN_GENERATION';
    try {
      const verificationId = randomUUID();
      const verificationToken = createEmailActionToken(
        verificationId,
        'verify-email',
      );
      const newsletterId = input.marketingOptIn ? randomUUID() : null;
      const marketingTokenHash = newsletterId
        ? hashEmailActionToken(
            createEmailActionToken(newsletterId, 'newsletter-unsubscribe'),
          )
        : null;
      stage = 'PASSWORD_HASH';
      const passwordHash = await hash(
        input.password,
        CUSTOMER_PASSWORD_HASH_ROUNDS,
      );
      const customer = await this.customers.registerPendingVerification({
        name: input.name,
        email: input.email,
        passwordHash,
        verification: {
          id: verificationId,
          tokenHash: hashEmailActionToken(verificationToken),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
        ...(newsletterId
          ? {
              marketing: {
                id: newsletterId,
                tokenHash: marketingTokenHash!,
                consentAt: new Date(),
              },
            }
          : {}),
      });
      await this.trigger.trigger();
      return { customer, verificationRequired: true as const };
    } catch (error) {
      const prismaCode =
        error instanceof CustomerRegistrationError
          ? error.prismaCode
          : error instanceof Prisma.PrismaClientKnownRequestError
            ? error.code
            : null;
      if (prismaCode === 'P2002') {
        throw new ConflictError('このメールアドレスはすでに登録されています。');
      }
      if (error instanceof CustomerRegistrationError) throw error;
      throw new CustomerRegistrationError(stage, error);
    }
  }

  async login(input: CustomerLoginInput, previousToken?: string) {
    const customer = await this.customers.findAuthenticationByEmail(
      input.email,
    );
    const passwordMatches = await compare(
      input.password,
      customer?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!customer?.passwordHash || !passwordMatches) {
      throw invalidCredentials();
    }
    if (!customer.emailVerifiedAt) throw new EmailNotVerifiedError();
    const token = createCustomerSessionToken();
    const expiresAt = new Date(
      Date.now() + CUSTOMER_SESSION_TTL_SECONDS * 1000,
    );
    await this.customers.rotateSession(
      customer.id,
      hashCustomerSessionToken(token),
      expiresAt,
      previousToken ? hashCustomerSessionToken(previousToken) : undefined,
    );
    const { passwordHash: _passwordHash, ...publicCustomer } = customer;
    return { customer: publicCustomer, token, expiresAt };
  }

  async getCustomer(token?: string) {
    if (!token) return null;
    const session = await this.customers.findCustomerBySessionHash(
      hashCustomerSessionToken(token),
      new Date(),
    );
    return session?.customer ?? null;
  }

  async logout(token?: string) {
    if (!token) return { invalidated: false };
    const result = await this.customers.revokeSession(
      hashCustomerSessionToken(token),
    );
    return { invalidated: result.count > 0 };
  }

  async requestPasswordReset(email: string) {
    const customer = await this.customers.findCustomerForPasswordReset(email);
    if (!customer?.passwordHash || !customer.emailVerifiedAt)
      return { accepted: true };
    const id = randomUUID();
    const token = createEmailActionToken(id, 'reset-password');
    await this.customers.createPasswordReset({
      id,
      customerId: customer.id,
      recipient: customer.email,
      customerName: customer.name,
      tokenHash: hashEmailActionToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    await this.trigger.trigger();
    return { accepted: true };
  }

  async verifyEmail(token: string) {
    if (!isValidEmailActionToken(token, 'verify-email'))
      throw new UnauthorizedError('確認リンクが無効または期限切れです。');
    const sessionToken = createCustomerSessionToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + CUSTOMER_SESSION_TTL_SECONDS * 1000,
    );
    const result = await this.customers.verifyEmailAndCreateSession({
      tokenHash: hashEmailActionToken(token),
      sessionTokenHash: hashCustomerSessionToken(sessionToken),
      sessionExpiresAt: expiresAt,
      now,
    });
    if (!result)
      throw new UnauthorizedError('確認リンクが無効または期限切れです。');
    await this.trigger.trigger();
    return {
      customer: result.customer,
      token: sessionToken,
      expiresAt,
      verified: true as const,
    };
  }

  async resetPassword(token: string, password: string) {
    if (!isValidEmailActionToken(token, 'reset-password'))
      throw new UnauthorizedError('再設定リンクが無効または期限切れです。');
    const result = await this.customers.resetPassword(
      hashEmailActionToken(token),
      await hash(password, CUSTOMER_PASSWORD_HASH_ROUNDS),
      new Date(),
    );
    if (!result)
      throw new UnauthorizedError('再設定リンクが無効または期限切れです。');
    return result;
  }

  async resendVerification(email: string) {
    const now = new Date();
    const id = randomUUID();
    const token = createEmailActionToken(id, 'verify-email');
    const result = await this.customers.requestEmailVerification({
      email,
      token: {
        id,
        tokenHash: hashEmailActionToken(token),
        expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
      },
      now,
      cooldownSince: new Date(
        now.getTime() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      ),
    });
    if (result.enqueued) await this.trigger.trigger();
    return { accepted: true };
  }

  async changePassword(
    customerId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const authentication = await this.customers.findPasswordById(customerId);
    const matches = await compare(
      currentPassword,
      authentication?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!authentication?.passwordHash || !matches)
      throw new UnauthorizedError('現在のパスワードが正しくありません。');
    const token = createCustomerSessionToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + CUSTOMER_SESSION_TTL_SECONDS * 1000,
    );
    const result = await this.customers.changePasswordAndRotateSession({
      customerId,
      expectedPasswordHash: authentication.passwordHash,
      passwordHash: await hash(newPassword, CUSTOMER_PASSWORD_HASH_ROUNDS),
      sessionTokenHash: hashCustomerSessionToken(token),
      sessionExpiresAt: expiresAt,
      now,
    });
    if (!result) throw new UnauthorizedError();
    return { changed: true as const, token, expiresAt };
  }

  updateProfile(customerId: string, name: string) {
    return this.customers.updateProfile(customerId, name);
  }
}
