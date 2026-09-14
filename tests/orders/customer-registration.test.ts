import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { CustomerRegistrationError } from '@/lib/customer-registration-error';
import { toSafeServerErrorLog } from '@/lib/server-error-logger';
import { CustomerRepository } from '@/repositories/customer.repository';
import { CustomerAuthService } from '@/services/customer-auth.service';

const registrationInput = {
  name: 'Registration Test',
  email: 'registration@example.com',
  password: 'safe-password-123',
};

const transactionDatabase = (failOperation?: string) => {
  const committed: string[] = [];
  return {
    committed,
    customer: {},
    customerSession: {},
    customerAddress: {},
    async $transaction(operation: (transaction: unknown) => Promise<unknown>) {
      const staged: string[] = [];
      const record = async (name: string, result: unknown) => {
        staged.push(name);
        if (name === failOperation)
          throw new Error('sensitive database detail');
        return result;
      };
      const transaction = {
        customer: {
          create: async () =>
            record('customer.create', {
              id: 'customer-1',
              name: registrationInput.name,
              email: registrationInput.email,
              phone: null,
              emailVerifiedAt: null,
            }),
        },
        customerSession: {
          create: async () => record('customerSession.create', {}),
          updateMany: async () => record('customerSession.updateMany', {}),
        },
        emailVerificationToken: {
          create: async () => record('emailVerificationToken.create', {}),
        },
        emailOutbox: {
          create: async (input: { data: { template: string } }) =>
            record(`emailOutbox.create:${input.data.template}`, {}),
        },
        newsletterSubscription: {
          upsert: async () => record('newsletterSubscription.upsert', {}),
        },
      };
      const result = await operation(transaction);
      committed.push(...staged);
      return result;
    },
  };
};

test('registration without marketing creates Customer, Session, verification token, and Outbox atomically', async () => {
  const database = transactionDatabase();
  const service = new CustomerAuthService(
    new CustomerRepository(database as never),
  );
  const result = await service.register(registrationInput);
  assert.equal(result.customer.id, 'customer-1');
  assert.deepEqual(database.committed, [
    'customer.create',
    'customerSession.create',
    'emailVerificationToken.create',
    'emailOutbox.create:EMAIL_VERIFICATION',
  ]);
});

test('registration with marketing also creates NewsletterSubscription and its Outbox event', async () => {
  const database = transactionDatabase();
  const service = new CustomerAuthService(
    new CustomerRepository(database as never),
  );
  await service.register({ ...registrationInput, marketingOptIn: true });
  assert.deepEqual(database.committed, [
    'customer.create',
    'customerSession.create',
    'emailVerificationToken.create',
    'emailOutbox.create:EMAIL_VERIFICATION',
    'newsletterSubscription.upsert',
    'emailOutbox.create:NEWSLETTER_CONTACT_SYNC',
  ]);
});

test('duplicate email remains a safe conflict response', async () => {
  const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '6.16.0',
  });
  const service = new CustomerAuthService({
    registerWithSession: async () => {
      throw duplicate;
    },
  } as never);
  await assert.rejects(() => service.register(registrationInput), {
    code: 'CONFLICT',
    statusCode: 409,
  });
});

test('transaction failure leaves no partially committed Customer', async () => {
  const database = transactionDatabase('emailOutbox.create:EMAIL_VERIFICATION');
  const service = new CustomerAuthService(
    new CustomerRepository(database as never),
  );
  await assert.rejects(
    () => service.register(registrationInput),
    (error: unknown) =>
      error instanceof CustomerRegistrationError &&
      error.stage === 'EMAIL_OUTBOX_ENQUEUE',
  );
  assert.deepEqual(database.committed, []);
});

test('missing signing secret is identified before persistence', async () => {
  const previous = process.env.JWT_SECRET;
  Reflect.deleteProperty(process.env, 'JWT_SECRET');
  let persisted = false;
  try {
    const service = new CustomerAuthService({
      registerWithSession: async () => {
        persisted = true;
        return {};
      },
    } as never);
    await assert.rejects(
      () => service.register(registrationInput),
      (error: unknown) =>
        error instanceof CustomerRegistrationError &&
        error.stage === 'TOKEN_GENERATION',
    );
    assert.equal(persisted, false);
  } finally {
    if (previous === undefined)
      Reflect.deleteProperty(process.env, 'JWT_SECRET');
    else process.env.JWT_SECRET = previous;
  }
});

test('registration does not call Resend and unknown errors produce safe structured logs', async () => {
  const repositorySource = await readFile(
    `${process.cwd()}/repositories/customer.repository.ts`,
    'utf8',
  );
  assert.equal(repositorySource.includes('Resend'), false);
  const error = new CustomerRegistrationError(
    'EMAIL_OUTBOX_ENQUEUE',
    new Error('password=sensitive-value DATABASE_URL=secret'),
  );
  const log = toSafeServerErrorLog({
    route: '/api/v1/customer/register',
    requestId: 'request-1',
    error,
  });
  const serialized = JSON.stringify(log);
  assert.equal(log.operationStage, 'EMAIL_OUTBOX_ENQUEUE');
  assert.doesNotMatch(serialized, /sensitive-value|DATABASE_URL=secret/);

  const routeSource = await readFile(
    `${process.cwd()}/app/api/v1/customer/register/route.ts`,
    'utf8',
  );
  assert.ok(routeSource.includes("'会員登録に失敗しました。'"));
  assert.equal(routeSource.includes('error.message'), false);
});
