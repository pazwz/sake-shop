import { compare, hash, hashSync } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import {
  CUSTOMER_PASSWORD_HASH_ROUNDS,
  CUSTOMER_SESSION_TTL_SECONDS,
} from '@/config/customer-auth';
import { ConflictError, UnauthorizedError } from '@/lib/errors';
import {
  createCustomerSessionToken,
  hashCustomerSessionToken,
} from '@/lib/customer-session';
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
}
