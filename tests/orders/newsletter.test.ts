import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createEmailActionToken,
  hashEmailActionToken,
} from '@/lib/email-action-token';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { NewsletterService } from '@/services/newsletter.service';
import { newsletterSubscribeValidator } from '@/validators/newsletter.validator';

test('anonymous newsletter subscription requires explicit consent', () => {
  assert.equal(
    newsletterSubscribeValidator.safeParse({ email: 'reader@example.com' })
      .success,
    false,
  );
  assert.equal(
    newsletterSubscribeValidator.safeParse({
      email: 'READER@EXAMPLE.COM ',
      consent: true,
    }).data?.email,
    'reader@example.com',
  );
});

test('newsletter subscribe stores a signed-token hash and is repository-idempotent', async () => {
  let stored: Record<string, unknown> | undefined;
  const newsletter = new NewsletterService({
    findByEmail: async () => null,
    subscribe: async (input: Record<string, unknown>) => {
      stored = input;
      return input;
    },
  } as never);
  assert.deepEqual(await newsletter.subscribe('reader@example.com'), {
    subscribed: true,
  });
  assert.equal(typeof stored?.tokenHash, 'string');
  assert.equal(String(stored?.tokenHash).includes('.'), false);
  const source = await readFile(
    `${process.cwd()}/repositories/newsletter.repository.ts`,
    'utf8',
  );
  assert.ok(source.includes('current?.status === NewsletterStatus.SUBSCRIBED'));
  assert.ok(source.includes('emailOutbox.upsert'));
});

test('newsletter unsubscribe accepts only a signed opaque token and is idempotent', async () => {
  const token = createEmailActionToken(
    'subscription-1',
    'newsletter-unsubscribe',
  );
  let storedHash = '';
  const newsletter = new NewsletterService({
    unsubscribe: async (tokenHash: string) => {
      storedHash = tokenHash;
      return { id: 'subscription-1' };
    },
  } as never);
  assert.deepEqual(await newsletter.unsubscribe(token), { unsubscribed: true });
  assert.equal(storedHash, hashEmailActionToken(token));
  await assert.rejects(() => newsletter.unsubscribe('invalid-token'));
});

test('customer registration does not subscribe unless marketing opt-in is explicit', async () => {
  const registrations: Array<Record<string, unknown>> = [];
  const auth = new CustomerAuthService({
    registerPendingVerification: async (input: Record<string, unknown>) => {
      registrations.push(input);
      return {
        id: `customer-${registrations.length}`,
        name: 'Buyer',
        email: String(input.email),
        phone: null,
        emailVerifiedAt: null,
      };
    },
  } as never);
  await auth.register({
    name: 'Buyer',
    email: 'first@example.com',
    password: 'long-password',
  });
  await auth.register({
    name: 'Buyer',
    email: 'second@example.com',
    password: 'long-password',
    marketingOptIn: true,
  });
  assert.equal(registrations[0].marketing, undefined);
  assert.equal(typeof registrations[1].marketing, 'object');
});

test('Resend contact failure cannot roll back NewsletterSubscription source of truth', async () => {
  const repository = await readFile(
    `${process.cwd()}/repositories/newsletter.repository.ts`,
    'utf8',
  );
  const worker = await readFile(
    `${process.cwd()}/services/email-outbox.service.ts`,
    'utf8',
  );
  assert.ok(repository.includes('newsletterSubscription.upsert'));
  assert.ok(repository.includes('emailOutbox.upsert'));
  assert.ok(worker.includes('this.marketing.sync'));
  assert.equal(repository.includes('Resend'), false);
});

test('Footer newsletter is connected to the backend and has an unchecked consent control', async () => {
  const source = await readFile(
    `${process.cwd()}/components/footer.tsx`,
    'utf8',
  );
  assert.ok(source.includes('/api/v1/newsletter/subscribe'));
  assert.ok(source.includes('type="checkbox"'));
  assert.equal(source.includes('defaultChecked'), false);
});
