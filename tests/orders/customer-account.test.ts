import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { hash } from 'bcryptjs';
import { CUSTOMER_PASSWORD_HASH_ROUNDS } from '@/config/customer-auth';
import { createEmailActionToken } from '@/lib/email-action-token';
import { CustomerAddressService } from '@/services/customer-address.service';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { NewsletterService } from '@/services/newsletter.service';
import {
  customerAddressValidator,
  customerProfileValidator,
  customerNewsletterPreferenceValidator,
} from '@/validators/customer-account.validator';
import { verifiedChangePasswordValidator } from '@/validators/customer-auth.validator';

const verifiedCustomer = {
  id: 'customer-1',
  name: 'Buyer',
  email: 'buyer@example.com',
  phone: null,
  emailVerifiedAt: new Date(),
};

test('unverified login is rejected without creating a session', async () => {
  let sessions = 0;
  const service = new CustomerAuthService({
    findAuthenticationByEmail: async () => ({
      ...verifiedCustomer,
      emailVerifiedAt: null,
      passwordHash: await hash('correct-password', 4),
    }),
    rotateSession: async () => {
      sessions += 1;
    },
  } as never);
  await assert.rejects(
    () =>
      service.login({
        email: verifiedCustomer.email,
        password: 'correct-password',
      }),
    { code: 'EMAIL_NOT_VERIFIED', statusCode: 403 },
  );
  assert.equal(sessions, 0);
});

test('legacy session authentication requires a verified Customer', async () => {
  const repository = await readFile(
    `${process.cwd()}/repositories/customer.repository.ts`,
    'utf8',
  );
  assert.match(
    repository,
    /customer:\s*\{\s*emailVerifiedAt:\s*\{\s*not:\s*null/,
  );
});

test('verification creates one fresh session and token reuse is rejected', async () => {
  let available = true;
  let captured: Record<string, unknown> | undefined;
  const service = new CustomerAuthService({
    verifyEmailAndCreateSession: async (input: Record<string, unknown>) => {
      captured = input;
      if (!available) return null;
      available = false;
      return { customer: verifiedCustomer };
    },
  } as never);
  const token = createEmailActionToken('verification-1', 'verify-email');
  const result = await service.verifyEmail(token);
  assert.equal(result.verified, true);
  assert.ok(result.token.length >= 40);
  assert.equal(typeof captured?.sessionTokenHash, 'string');
  await assert.rejects(() => service.verifyEmail(token), /無効または期限切れ/);
});

test('verification resend is generic and delegates only a token hash', async () => {
  let captured: Record<string, unknown> | undefined;
  const service = new CustomerAuthService({
    requestEmailVerification: async (input: Record<string, unknown>) => {
      captured = input;
      return { enqueued: false, reason: 'COOLDOWN' };
    },
  } as never);
  assert.deepEqual(await service.resendVerification('buyer@example.com'), {
    accepted: true,
  });
  const token = captured?.token as Record<string, unknown>;
  assert.equal(typeof token.tokenHash, 'string');
  assert.equal(String(token.tokenHash).includes('.'), false);
  const repository = await readFile(
    `${process.cwd()}/repositories/customer.repository.ts`,
    'utf8',
  );
  assert.ok(repository.includes("reason: 'COOLDOWN'"));
  assert.ok(repository.includes('FOR UPDATE'));
});

test('password change verifies the old password and rotates every session', async () => {
  let changed: Record<string, unknown> | undefined;
  const service = new CustomerAuthService({
    findPasswordById: async () => ({
      passwordHash: await hash(
        'current-password',
        CUSTOMER_PASSWORD_HASH_ROUNDS,
      ),
    }),
    changePasswordAndRotateSession: async (input: Record<string, unknown>) => {
      changed = input;
      return { changed: true };
    },
  } as never);
  const result = await service.changePassword(
    verifiedCustomer.id,
    'current-password',
    'replacement-password',
  );
  assert.equal(result.changed, true);
  assert.equal(typeof changed?.passwordHash, 'string');
  assert.equal(typeof changed?.sessionTokenHash, 'string');
  const repository = await readFile(
    `${process.cwd()}/repositories/customer.repository.ts`,
    'utf8',
  );
  assert.match(repository, /customerSession\.updateMany/);
  assert.match(repository, /customerSession\.create/);
});

test('wrong current password cannot update the password', async () => {
  let writes = 0;
  const service = new CustomerAuthService({
    findPasswordById: async () => ({
      passwordHash: await hash('correct-password', 4),
    }),
    changePasswordAndRotateSession: async () => {
      writes += 1;
    },
  } as never);
  await assert.rejects(
    () =>
      service.changePassword(
        verifiedCustomer.id,
        'wrong-password',
        'replacement-password',
      ),
    { statusCode: 401 },
  );
  assert.equal(writes, 0);
});

test('forgot password skips missing and unverified accounts identically', async () => {
  let created = 0;
  for (const found of [
    null,
    { ...verifiedCustomer, emailVerifiedAt: null, passwordHash: 'hash' },
  ]) {
    const service = new CustomerAuthService({
      findCustomerForPasswordReset: async () => found,
      createPasswordReset: async () => {
        created += 1;
      },
    } as never);
    assert.deepEqual(await service.requestPasswordReset('buyer@example.com'), {
      accepted: true,
    });
  }
  assert.equal(created, 0);
});

test('reset is one-time, expires safely, and cannot bypass verification', async () => {
  const repository = await readFile(
    `${process.cwd()}/repositories/customer.repository.ts`,
    'utf8',
  );
  assert.ok(repository.includes('!token.customer.emailVerifiedAt'));
  assert.ok(repository.includes('claimed.count !== 1'));
  assert.match(
    repository,
    /passwordResetToken\.updateMany\([\s\S]*customerId: token\.customerId/,
  );
  assert.match(
    repository,
    /customerSession\.updateMany\([\s\S]*customerId: token\.customerId/,
  );
});

const addressInput = customerAddressValidator.parse({
  recipientName: '購入者',
  postalCode: '810-0001',
  prefecture: '福岡県',
  city: '福岡市',
  addressLine1: '1-1',
  phone: '090-1234-5678',
  isDefault: true,
});

test('address validation normalizes Japanese postal code and phone', () => {
  assert.equal(addressInput.postalCode, '8100001');
  assert.equal(addressInput.phone, '09012345678');
  assert.equal(
    customerAddressValidator.safeParse({
      ...addressInput,
      prefecture: 'invalid',
    }).success,
    false,
  );
});

test('address CRUD always receives authenticated ownership scope', async () => {
  const calls: string[][] = [];
  const service = new CustomerAddressService({
    list: async (customerId: string) => {
      calls.push(['list', customerId]);
      return [];
    },
    create: async (customerId: string) => {
      calls.push(['create', customerId]);
      return { id: 'address-1' };
    },
    update: async (customerId: string, id: string) => {
      calls.push(['update', customerId, id]);
      return { id };
    },
    delete: async (customerId: string, id: string) => {
      calls.push(['delete', customerId, id]);
      return { deleted: true };
    },
    findOwned: async (customerId: string, id: string) => {
      calls.push(['read', customerId, id]);
      return customerId === 'customer-a' && id === 'owned'
        ? { id: 'owned' }
        : null;
    },
  } as never);
  await service.list('customer-a');
  await service.create('customer-a', addressInput);
  await service.update('customer-a', 'owned', addressInput);
  await service.delete('customer-a', 'owned');
  await assert.rejects(() => service.getOwnedAddress('customer-b', 'owned'), {
    statusCode: 404,
  });
  assert.deepEqual(calls.at(-1), ['read', 'customer-b', 'owned']);
});

test('default address operations are serialized and define a fallback', async () => {
  const repository = await readFile(
    `${process.cwd()}/repositories/customer-address.repository.ts`,
    'utf8',
  );
  assert.ok(repository.includes('FOR UPDATE'));
  assert.ok(repository.includes("orderBy: { createdAt: 'asc' }"));
  assert.match(repository, /data: \{ isDefault: true \}/);
  assert.match(repository, /where: \{ id: addressId, customerId \}/);
});

test('newsletter preference is authenticated, explicit, and idempotent', async () => {
  let subscribed = 0;
  let unsubscribed = 0;
  const service = new NewsletterService({
    getStatus: async () => null,
    findByEmail: async () => null,
    subscribe: async () => {
      subscribed += 1;
    },
    unsubscribeByEmail: async () => {
      unsubscribed += 1;
      return { unsubscribed: true };
    },
  } as never);
  assert.equal(
    customerNewsletterPreferenceValidator.parse({ subscribed: true })
      .subscribed,
    true,
  );
  await service.setCustomerPreference('buyer@example.com', true);
  await service.setCustomerPreference('buyer@example.com', false);
  assert.equal(subscribed, 1);
  assert.equal(unsubscribed, 1);
  const route = await readFile(
    `${process.cwd()}/app/api/v1/customer/preferences/newsletter/route.ts`,
    'utf8',
  );
  assert.ok(route.includes('requireCustomer()'));
});

test('newsletter mirror failure is asynchronous and cannot roll back Neon consent', async () => {
  const repository = await readFile(
    `${process.cwd()}/repositories/newsletter.repository.ts`,
    'utf8',
  );
  assert.ok(repository.includes('newsletterSubscription.update'));
  assert.ok(repository.includes('emailOutbox.create'));
  assert.equal(repository.includes('marketing.sync'), false);
});

test('profile only accepts name and cannot change verified email', () => {
  assert.deepEqual(customerProfileValidator.parse({ name: ' 新しい名前 ' }), {
    name: '新しい名前',
  });
  assert.equal(
    customerProfileValidator.safeParse({
      name: 'Buyer',
      email: 'attacker@example.com',
    }).success,
    false,
  );
  assert.equal(
    verifiedChangePasswordValidator.safeParse({
      currentPassword: 'old-password',
      newPassword: 'new-password-1',
      newPasswordConfirmation: 'different-password',
    }).success,
    false,
  );
});
