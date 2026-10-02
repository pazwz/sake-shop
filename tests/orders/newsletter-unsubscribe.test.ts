import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { NewsletterStatus } from '@prisma/client';
import {
  createEmailActionToken,
  hashEmailActionToken,
  isValidEmailActionToken,
} from '@/lib/email-action-token';
import { NewsletterRepository } from '@/repositories/newsletter.repository';
import { NewsletterService } from '@/services/newsletter.service';
import { NewsletterCampaignDispatchService } from '@/services/newsletter-campaign.service';
import { EmailOutboxService } from '@/services/email-outbox.service';
import { EmailOutboxStatus, EmailTemplate } from '@prisma/client';
// Next supplies this marker at runtime; route tests execute outside its compiler.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return specifier === 'server-only'
      ? {
          url: pathToFileURL(
            `${process.cwd()}/node_modules/next/dist/compiled/server-only/empty.js`,
          ).href,
          shortCircuit: true,
        }
      : nextResolve(specifier, context);
  },
});

process.env.JWT_SECRET = 'newsletter-unsubscribe-test-secret';
process.env.EMAIL_MODE = 'disabled';
const id = 'subscription-reader-private-id';
const legacy = () => createEmailActionToken(id, 'newsletter-unsubscribe');

const memory = () => {
  const subscription = {
    id,
    email: 'reader@example.test',
    status: NewsletterStatus.SUBSCRIBED as NewsletterStatus,
    unsubscribeTokenHash: hashEmailActionToken(legacy()),
    consentAt: new Date('2026-10-01'),
    unsubscribedAt: null as Date | null,
  };
  const jobs = new Map<string, { payload: { unsubscribed: boolean } }>();
  let writes = 0;
  const db = {
    newsletterSubscription: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        Object.entries(where).every(
          ([key, value]) =>
            subscription[key as keyof typeof subscription] === value,
        )
          ? { ...subscription }
          : null,
      update: async ({ data }: { data: Partial<typeof subscription> }) => {
        writes++;
        Object.assign(subscription, data);
        return { ...subscription };
      },
      updateMany: async ({ data }: { data: Partial<typeof subscription> }) => {
        if (subscription.status === NewsletterStatus.UNSUBSCRIBED)
          return { count: 0 };
        writes++;
        Object.assign(subscription, data);
        return { count: 1 };
      },
      upsert: async ({ update }: { update: Partial<typeof subscription> }) => {
        writes++;
        Object.assign(subscription, update);
        return { ...subscription };
      },
    },
    emailOutbox: {
      upsert: async ({
        where,
        create,
      }: {
        where: { eventKey: string };
        create: { payload: { unsubscribed: boolean } };
      }) => {
        if (!jobs.has(where.eventKey)) jobs.set(where.eventKey, create);
        return create;
      },
    },
    $transaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> =>
      work(db),
  };
  const repository = new NewsletterRepository(db as never);
  const service = new NewsletterService(repository, {
    trigger: async () => ({ outcome: 'DISABLED' }),
  } as never);
  return { subscription, jobs, repository, service, writes: () => writes };
};

test('new unsubscribe token hides identity, authenticates tampering and retains the stored legacy hash', async () => {
  const {
    createNewsletterUnsubscribeToken,
    getNewsletterUnsubscribeTokenHash,
  } = await import('@/lib/newsletter-unsubscribe-token');
  const token = createNewsletterUnsubscribeToken(id);
  assert.equal(token.includes(id), false);
  assert.equal(token.includes('reader@example.test'), false);
  assert.equal(
    getNewsletterUnsubscribeTokenHash(token),
    hashEmailActionToken(legacy()),
  );
  assert.equal(
    getNewsletterUnsubscribeTokenHash(legacy()),
    hashEmailActionToken(legacy()),
  );
  const pieces = token.split('.');
  pieces[2] = (pieces[2][0] === 'A' ? 'B' : 'A') + pieces[2].slice(1);
  assert.equal(getNewsletterUnsubscribeTokenHash(pieces.join('.')), null);
  assert.equal(
    getNewsletterUnsubscribeTokenHash(
      createEmailActionToken(id, 'reset-password'),
    ),
    null,
  );
  assert.equal(getNewsletterUnsubscribeTokenHash('invalid'), null);
  assert.ok(
    isValidEmailActionToken(
      createEmailActionToken(id, 'verify-email'),
      'verify-email',
    ),
  );
  assert.ok(
    isValidEmailActionToken(
      createEmailActionToken(id, 'reset-password'),
      'reset-password',
    ),
  );
});

test('opaque unsubscribe envelope stays stable for provider idempotency retries', async () => {
  const { createNewsletterUnsubscribeToken } = await import(
    '@/lib/newsletter-unsubscribe-token'
  );
  assert.equal(
    createNewsletterUnsubscribeToken(id),
    createNewsletterUnsubscribeToken(id),
  );
  assert.notEqual(
    createNewsletterUnsubscribeToken(id),
    createNewsletterUnsubscribeToken('another-subscription'),
  );
});

test('confirmation inspection performs no writes and invalid links expose only invalid state', async () => {
  const state = memory();
  assert.equal(await state.service.getUnsubscribeState(legacy()), 'confirm');
  assert.equal(await state.service.getUnsubscribeState('invalid'), 'invalid');
  assert.equal(
    await state.service.getUnsubscribeState(
      createEmailActionToken('missing', 'newsletter-unsubscribe'),
    ),
    'invalid',
  );
  assert.equal(state.writes(), 0);
  assert.equal(state.jobs.size, 0);
});

test('POST unsubscribe is idempotent, preserves consent, and new consent cycle gets a fresh mirror job', async () => {
  const state = memory();
  const { createNewsletterUnsubscribeToken } = await import(
    '@/lib/newsletter-unsubscribe-token'
  );
  await state.service.unsubscribe(createNewsletterUnsubscribeToken(id));
  assert.equal(state.subscription.status, NewsletterStatus.UNSUBSCRIBED);
  assert.equal(
    state.subscription.consentAt.toISOString(),
    '2026-10-01T00:00:00.000Z',
  );
  assert.equal(await state.service.getUnsubscribeState(legacy()), 'already');
  const firstTime = state.subscription.unsubscribedAt;
  assert.deepEqual(await state.service.unsubscribe(legacy()), {
    unsubscribed: true,
  });
  assert.equal(state.writes(), 1);
  assert.equal(state.subscription.unsubscribedAt, firstTime);
  assert.deepEqual(
    await state.service.getCustomerPreference('reader@example.test'),
    {
      subscribed: false,
      consentAt: state.subscription.consentAt,
      unsubscribedAt: firstTime,
    },
  );
  await state.repository.subscribe({
    id,
    email: state.subscription.email,
    tokenHash: state.subscription.unsubscribeTokenHash,
    source: 'CUSTOMER_ACCOUNT',
    now: new Date('2026-10-02T01:00:00Z'),
  });
  await state.repository.unsubscribe(
    state.subscription.unsubscribeTokenHash,
    new Date('2026-10-02T02:00:00Z'),
  );
  assert.equal(state.jobs.size, 3);
  assert.equal(state.subscription.status, NewsletterStatus.UNSUBSCRIBED);
  assert.equal(state.subscription.id, id);
  assert.equal(state.subscription.email, 'reader@example.test');
});

test('formal newsletter without subscription identity fails closed; only explicit test mode bypasses', async () => {
  const service = new NewsletterCampaignDispatchService({
    isRecipientSubscribed: async () => false,
  } as never);
  assert.equal(await service.shouldSend(null), false);
  assert.equal(await service.shouldSend(null, true), true);
  assert.equal(await service.shouldSend(id), false);
  assert.equal(await service.shouldSend(id, true), false);
});

test('GET inspection and confirmation POST use bearer token without Customer auth', async () => {
  const unsubscribeRoute = await import(
    '../../app/api/v1/newsletter/unsubscribe/route'
  );
  const state = memory();
  assert.equal(typeof unsubscribeRoute.GET, 'function');
  // Bind the real service before replacing the shared prototype for the route boundary.
  const inspect = state.service.getUnsubscribeState.bind(state.service);
  const unsubscribe = state.service.unsubscribe.bind(state.service);
  mock.method(NewsletterService.prototype, 'getUnsubscribeState', inspect);
  mock.method(NewsletterService.prototype, 'unsubscribe', unsubscribe);
  try {
    const get = await unsubscribeRoute.GET(
      new Request(
        `https://linxas-fukuoka.com/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(legacy())}`,
      ),
    );
    assert.equal(get.status, 200);
    assert.equal((await get.json()).data.state, 'confirm');
    assert.equal(state.writes(), 0);
    assert.equal(get.headers.get('cache-control'), 'no-store');
    const post = await unsubscribeRoute.POST(
      new Request('https://linxas-fukuoka.com/api/v1/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: legacy() }),
      }),
    );
    assert.equal(post.status, 200);
    assert.equal(state.subscription.status, NewsletterStatus.UNSUBSCRIBED);
  } finally {
    mock.restoreAll();
  }
});

test('standard one-click POST executes without login/HTML and rejects invalid bearer without leaking it', async () => {
  const { POST } = await import(
    '../../app/api/v1/newsletter/unsubscribe/one-click/route'
  );
  const state = memory();
  const unsubscribe = state.service.unsubscribe.bind(state.service);
  mock.method(NewsletterService.prototype, 'unsubscribe', unsubscribe);
  try {
    const request = (token: string) =>
      new Request(
        `https://linxas-fukuoka.com/api/v1/newsletter/unsubscribe/one-click?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
        },
      );
    assert.equal((await POST(request(legacy()))).status, 200);
    assert.equal((await POST(request(legacy()))).status, 200);
    assert.equal(state.writes(), 1);
    const invalid = 'invalid-token-do-not-log-or-echo-00000000';
    const response = await POST(request(invalid));
    assert.equal(response.status, 401);
    assert.equal((await response.text()).includes(invalid), false);
  } finally {
    mock.restoreAll();
  }
});

test('one-click accepts RFC 8058 multipart requests without login and stays idempotent', async () => {
  const { POST } = await import(
    '../../app/api/v1/newsletter/unsubscribe/one-click/route'
  );
  const state = memory();
  mock.method(
    NewsletterService.prototype,
    'unsubscribe',
    state.service.unsubscribe.bind(state.service),
  );
  try {
    const request = () => {
      const form = new FormData();
      form.set('List-Unsubscribe', 'One-Click');
      return new Request(
        `https://linxas-fukuoka.com/api/v1/newsletter/unsubscribe/one-click?token=${encodeURIComponent(legacy())}`,
        { method: 'POST', body: form },
      );
    };
    assert.equal((await POST(request())).status, 200);
    assert.equal((await POST(request())).status, 200);
    assert.equal(state.subscription.status, NewsletterStatus.UNSUBSCRIBED);
    assert.equal(state.writes(), 1);
  } finally {
    mock.restoreAll();
  }
});

test('stale mirror job respects live Neon opt-out, and provider failure leaves consent committed', async () => {
  const state = memory();
  await state.service.unsubscribe(legacy());
  const previous = {
    EMAIL_MODE: process.env.EMAIL_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };
  Object.assign(process.env, {
    EMAIL_MODE: 'resend',
    RESEND_API_KEY: 'offline-test-key',
    RESEND_FROM_EMAIL: 'test@example.test',
  });
  const row = {
    id: 'mirror',
    template: EmailTemplate.NEWSLETTER_CONTACT_SYNC,
    recipient: state.subscription.email,
    payload: { unsubscribed: false },
    status: EmailOutboxStatus.PENDING,
    attemptCount: 0,
    newsletterCampaignId: null,
  };
  let retry: Date | null = null;
  let observed: boolean | undefined;
  const worker = new EmailOutboxService(
    {
      claimById: async () => row,
      getNewsletterStatus: async () => ({ status: state.subscription.status }),
      markFailed: async (_id: string, _reason: string, next: Date | null) => {
        retry = next;
      },
    } as never,
    {} as never,
    {
      provider: 'offline',
      send: async () => {
        throw new Error('not an email');
      },
    },
    {
      sync: async ({ unsubscribed }: { unsubscribed: boolean }) => {
        observed = unsubscribed;
        throw new Error('mirror unavailable');
      },
    } as never,
    { refresh: async () => undefined } as never,
  );
  try {
    const result = await worker.processOutbox('mirror');
    assert.equal(result.failed, 1);
    assert.equal(observed, true);
    assert.ok((retry as Date | null) instanceof Date);
    assert.equal(state.subscription.status, NewsletterStatus.UNSUBSCRIBED);
    assert.equal(
      (await state.service.getCustomerPreference(state.subscription.email))
        .subscribed,
      false,
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
});

test('worker excludes unsubscribed Newsletter recipient but keeps transactional sending unaffected', async () => {
  const previous = process.env.EMAIL_MODE;
  process.env.EMAIL_MODE = 'console';
  const sends: string[] = [];
  const skipped: string[] = [];
  const row = (template: EmailTemplate) => ({
    id: template,
    recipient: 'reader@example.test',
    template,
    payload: {},
    attemptCount: 0,
    newsletterSubscriptionId: id,
    newsletterCampaignId: null,
  });
  const worker = new EmailOutboxService(
    {
      claimDue: async () => [
        row(EmailTemplate.NEWSLETTER_CAMPAIGN),
        row(EmailTemplate.WELCOME),
        row(EmailTemplate.ORDER_RECEIVED),
      ],
      markSkipped: async (id: string) => skipped.push(id),
      markSent: async () => undefined,
    } as never,
    {
      render: () => ({ subject: 'test', html: '<p>test</p>', text: 'test' }),
    } as never,
    {
      provider: 'offline',
      send: async (mail) => {
        sends.push(mail.idempotencyKey);
        return { messageId: 'offline' };
      },
    },
    {} as never,
    new NewsletterCampaignDispatchService({
      dispatchDueCampaigns: async () => [],
      isRecipientSubscribed: async () => false,
    } as never),
  );
  // Only replace campaign scheduling/aggregation; keep the actual live-recipient gate.
  mock.method(
    NewsletterCampaignDispatchService.prototype,
    'dispatchDue',
    async () => ({ dispatched: 0, recipients: 0 }),
  );
  mock.method(
    NewsletterCampaignDispatchService.prototype,
    'refresh',
    async () => undefined,
  );
  try {
    const result = await worker.processDue();
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 0);
    assert.deepEqual(skipped, [EmailTemplate.NEWSLETTER_CAMPAIGN]);
    assert.deepEqual(sends, [
      'email-outbox:WELCOME',
      'email-outbox:ORDER_RECEIVED',
    ]);
  } finally {
    mock.restoreAll();
    if (previous === undefined)
      Reflect.deleteProperty(process.env, 'EMAIL_MODE');
    else process.env.EMAIL_MODE = previous;
  }
});

test('consent changed during a mirror request schedules reconciliation instead of completing a stale job', async () => {
  const previous = {
    EMAIL_MODE: process.env.EMAIL_MODE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };
  Object.assign(process.env, {
    EMAIL_MODE: 'resend',
    RESEND_API_KEY: 'offline-test-key',
    RESEND_FROM_EMAIL: 'test@example.test',
  });
  let subscribed = true;
  let sent = false;
  let retry: Date | null = null;
  const worker = new EmailOutboxService(
    {
      claimById: async () => ({
        id: 'in-flight-mirror',
        template: EmailTemplate.NEWSLETTER_CONTACT_SYNC,
        recipient: 'reader@example.test',
        payload: {},
        attemptCount: 0,
      }),
      getNewsletterStatus: async () => ({
        status: subscribed ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
      }),
      markContactSynced: async () => undefined,
      markSent: async () => {
        sent = true;
      },
      markFailed: async (_id: string, _error: string, next: Date | null) => {
        retry = next;
      },
    } as never,
    {} as never,
    { provider: 'offline', send: async () => ({ messageId: 'unused' }) },
    {
      sync: async () => {
        subscribed = false;
        return { contactId: 'test-contact' };
      },
    } as never,
    { refresh: async () => undefined } as never,
  );
  try {
    const result = await worker.processOutbox('in-flight-mirror');
    assert.equal(result.failed, 1);
    assert.equal(sent, false);
    assert.ok((retry as Date | null) instanceof Date);
    assert.equal(subscribed, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
});
