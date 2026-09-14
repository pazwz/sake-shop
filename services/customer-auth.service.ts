import { compare, hash, hashSync } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  CUSTOMER_PASSWORD_HASH_ROUNDS,
  CUSTOMER_SESSION_TTL_SECONDS,
} from '@/config/customer-auth';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '@/config/email';
import { ConflictError, UnauthorizedError } from '@/lib/errors';
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
  public constructor(private readonly customers = new CustomerRepository()) {}

  async register(input: CustomerRegisterInput, previousToken?: string) {
    const token = createCustomerSessionToken();
    const expiresAt = new Date(
      Date.now() + CUSTOMER_SESSION_TTL_SECONDS * 1000,
    );

    const verificationId = randomUUID();
    const verificationToken = createEmailActionToken(
      verificationId,
      'verify-email',
    );
    const newsletterId = input.marketingOptIn ? randomUUID() : null;
    try {
      const customer = await this.customers.registerWithSession({
        name: input.name,
        email: input.email,
        passwordHash: await hash(input.password, CUSTOMER_PASSWORD_HASH_ROUNDS),
        tokenHash: hashCustomerSessionToken(token),
        expiresAt,
        previousTokenHash: previousToken
          ? hashCustomerSessionToken(previousToken)
          : undefined,
        verification: {
          id: verificationId,
          tokenHash: hashEmailActionToken(verificationToken),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
        ...(newsletterId
          ? {
              marketing: {
                id: newsletterId,
                tokenHash: hashEmailActionToken(
                  createEmailActionToken(
                    newsletterId,
                    'newsletter-unsubscribe',
                  ),
                ),
                consentAt: new Date(),
              },
            }
          : {}),
      });
      return { customer, token, expiresAt };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('このメールアドレスはすでに登録されています。');
      }
      throw error;
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
    if (!customer) return { accepted: true };
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
    return { accepted: true };
  }

  async verifyEmail(token: string) {
    if (!isValidEmailActionToken(token, 'verify-email'))
      throw new UnauthorizedError('確認リンクが無効または期限切れです。');
    const result = await this.customers.verifyEmail(
      hashEmailActionToken(token),
      new Date(),
    );
    if (!result)
      throw new UnauthorizedError('確認リンクが無効または期限切れです。');
    return { verified: true, alreadyVerified: result.alreadyVerified };
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
}
