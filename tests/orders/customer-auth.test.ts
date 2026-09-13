import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compare, hash } from 'bcryptjs';
import {
  CUSTOMER_PASSWORD_HASH_ROUNDS,
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from '@/config/customer-auth';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session';
import { hashCustomerSessionToken } from '@/lib/customer-session';
import { CustomerAuthService } from '@/services/customer-auth.service';
import {
  customerLoginValidator,
  customerRegisterValidator,
} from '@/validators/customer-auth.validator';

const customer = {
  id: 'customer-1',
  name: 'Buyer',
  email: 'buyer@example.com',
  phone: null,
};

test('registration normalizes email and enforces the password rule', () => {
  assert.equal(
    customerRegisterValidator.parse({
      name: ' Buyer ',
      email: 'BUYER@EXAMPLE.COM ',
      password: 'long-password',
    }).email,
    'buyer@example.com',
  );
  assert.equal(
    customerRegisterValidator.safeParse({
      name: 'Buyer',
      email: 'buyer@example.com',
      password: 'short',
    }).success,
    false,
  );
});

test('registration hashes the password and stores only a session token hash', async () => {
  const captured: Array<Record<string, unknown>> = [];
  const service = new CustomerAuthService({
    registerWithSession: async (input: Record<string, unknown>) => {
      captured.push(input);
      return customer;
    },
  } as never);
  const result = await service.register({
    name: customer.name,
    email: customer.email,
    password: 'long-password',
  });
  assert.equal(
    await compare('long-password', String(captured[0].passwordHash)),
    true,
  );
  assert.equal(captured[0].tokenHash, hashCustomerSessionToken(result.token));
  assert.notEqual(captured[0].tokenHash, result.token);
});

test('login succeeds with bcrypt and creates a fresh high-entropy session', async () => {
  let storedHash = '';
  const service = new CustomerAuthService({
    findAuthenticationByEmail: async () => ({
      ...customer,
      passwordHash: await hash('long-password', CUSTOMER_PASSWORD_HASH_ROUNDS),
    }),
    rotateSession: async (_id: string, tokenHash: string) => {
      storedHash = tokenHash;
      return { id: 'session-1' };
    },
  } as never);
  const result = await service.login({
    email: customer.email,
    password: 'long-password',
  });
  assert.equal(result.customer.email, customer.email);
  assert.equal(storedHash, hashCustomerSessionToken(result.token));
  assert.ok(result.token.length >= 40);
});

test('unknown email and wrong password return the same safe error', async () => {
  const missing = new CustomerAuthService({
    findAuthenticationByEmail: async () => null,
  } as never);
  const wrong = new CustomerAuthService({
    findAuthenticationByEmail: async () => ({
      ...customer,
      passwordHash: await hash('correct-password', 4),
    }),
  } as never);
  const messages = await Promise.all(
    [missing, wrong].map(async (service) => {
      try {
        await service.login({
          email: customer.email,
          password: 'wrong-password',
        });
      } catch (error) {
        return (error as Error).message;
      }
    }),
  );
  assert.equal(messages[0], messages[1]);
});

test('expired or revoked session is treated as anonymous', async () => {
  const service = new CustomerAuthService({
    findCustomerBySessionHash: async () => null,
  } as never);
  assert.equal(await service.getCustomer('expired-token'), null);
  assert.equal(await service.getCustomer(undefined), null);
});

test('logout revokes the hashed token and is idempotent', async () => {
  const hashes: string[] = [];
  const service = new CustomerAuthService({
    revokeSession: async (tokenHash: string) => {
      hashes.push(tokenHash);
      return { count: hashes.length === 1 ? 1 : 0 };
    },
  } as never);
  assert.deepEqual(await service.logout('opaque-token'), { invalidated: true });
  assert.deepEqual(await service.logout('opaque-token'), {
    invalidated: false,
  });
  assert.ok(
    hashes.every((value) => value === hashCustomerSessionToken('opaque-token')),
  );
});

test('customer cookie is HttpOnly, production Secure, SameSite Lax and separate from Admin', () => {
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'production' });
  const options = customerSessionCookieOptions();
  if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
  else Object.assign(process.env, { NODE_ENV: previous });
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.notEqual(CUSTOMER_SESSION_COOKIE, ADMIN_SESSION_COOKIE);
});

test('localStorage no longer controls customer identity', async () => {
  const source = await readFile(
    `${process.cwd()}/components/auth-provider.tsx`,
    'utf8',
  );
  assert.equal(source.includes('localStorage'), false);
  assert.ok(source.includes('/api/v1/customer/me'));
});

test('checkout validator rejects forged customer identity fields', () => {
  const parsed = customerLoginValidator.parse({
    email: 'buyer@example.com',
    password: 'long-password',
  });
  assert.equal('customerId' in parsed, false);
});
