import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { SSMClient, GetParameterCommand } = require('/tmp/linxas-email-infra-PDGcnu/node_modules/@aws-sdk/client-ssm');
const { fromIni } = require('/tmp/linxas-email-infra-PDGcnu/node_modules/@aws-sdk/credential-provider-ini');
const origin = process.env.PREVIEW_E2E_ORIGIN;
assert.match(origin ?? '', /^https:\/\/sake-shop-[a-z0-9]+-latte-moca\.vercel\.app$/);
const email = 'pazwz@yahoo.co.jp';
const url = execFileSync('npx', ['--yes', 'neon@8.7.2', 'connection-string', '--project-id', 'cold-bread-74303000', '--profile', 'linxas-preview-e2e', '--pooled'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
assert.equal(new URL(url).hostname, 'ep-muddy-shadow-a1ivn2h4-pooler.ap-southeast-1.aws.neon.tech');
const db = new PrismaClient({ datasources: { db: { url } } });
const ssm = new SSMClient({ region: 'ap-northeast-1', credentials: fromIni({ profile: 'default' }) });
const auth = JSON.parse((await ssm.send(new GetParameterCommand({ Name: '/sake-shop/preview/email-event-secret', WithDecryption: true }))).Parameter.Value);
assert.equal(auth.endpoint, origin + '/api/v1/internal/email/process');
assert.ok(new Date(auth.expiresAt) > new Date());
const report = data => process.stdout.write(JSON.stringify(data) + '\n');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let session = '';
const call = async (path, body, internal = false) => {
  const r = await fetch(origin + path, { method: 'POST', redirect: 'error',
    headers: { Cookie: [auth.protectionCookie, internal ? '' : session].filter(Boolean).join('; '), Origin: origin,
      'Content-Type': 'application/json', ...(internal ? { Authorization: 'Bearer ' + auth.secret } : {}) },
    body: JSON.stringify(body) });
  const data = await r.json();
  assert.ok(r.ok && data.success, `Preview API ${path}: ${r.status} ${data.error?.code ?? ''}`);
  return { response: r, data: data.data };
};
const queue = id => call('/api/v1/internal/email/process', { outboxId: id }, true);
const scheduleName = (event, at) => 'email-' + createHash('sha256').update(JSON.stringify([event, at])).digest('hex').slice(0, 48);
const readSchedule = name => {
  try {
    const d = JSON.parse(execFileSync('aws', ['scheduler', 'get-schedule', '--profile', 'default', '--region', 'ap-northeast-1', '--group-name', 'sake-shop-preview-email-once', '--name', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    const payload = JSON.parse(d.Target.Input);
    assert.ok(Object.keys(payload).every(k => ['kind', 'outboxId', 'campaignId', 'scheduledAt', 'afterId'].includes(k)));
    assert.equal(d.Target.Arn, 'arn:aws:sqs:ap-northeast-1:108782085732:sake-shop-preview-email-events');
    return { state: d.State, expression: d.ScheduleExpression, payload };
  } catch (e) {
    if (String(e.stderr ?? '').includes('ResourceNotFoundException')) return null;
    throw e;
  }
};
const rowState = id => db.emailOutbox.findUnique({ where: { id }, select: { id: true, status: true, attemptCount: true, nextAttemptAt: true, providerMessageId: true, updatedAt: true } });
const assertRetryTiming = row => {
  const expected = [60_000, 300_000, 1_800_000][row.attemptCount - 1];
  assert.ok(expected && row.nextAttemptAt);
  const delta = row.nextAttemptAt.getTime() - row.updatedAt.getTime();
  assert.ok(Math.abs(delta - expected) <= 2_000, 'Incorrect retry interval');
  const event = { kind: 'outbox', outboxId: row.id };
  const schedule = readSchedule(scheduleName(event, row.nextAttemptAt.toISOString()));
  if (!schedule) return false;
  assert.equal(schedule.expression, `at(${new Date(Math.ceil(row.nextAttemptAt.getTime() / 1000) * 1000).toISOString().slice(0, 19)})`);
  return { expectedDelayMs: expected, actualDelayMs: delta, schedule };
};
const waitFor = async (label, check, limitMs = 360_000) => {
  const deadline = Date.now() + limitMs;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) { report({ test: label, outcome: 'PASS', evidence: result }); return result; }
    await pause(10_000);
  }
  throw Error(label + ' timed out');
};

try {
  for (const [model, field] of [['customer', 'email'], ['newsletterSubscription', 'email'], ['emailOutbox', 'recipient']])
    assert.equal(await db[model].count({ where: { [field]: { not: email } } }), 0, 'Recipient mismatch; stop');

  if (process.argv.includes('--strict-retry')) {
    const seed = await db.emailOutbox.create({ data: { eventKey: 'preview-strict-retry:' + Date.now(), type: 'PREVIEW_STRICT_RETRY',
      recipient: email, subject: 'Preview E2E retry fixture seed', template: 'NEWSLETTER_CAMPAIGN',
      payload: { testMode: true, headline: 'Authorized isolated retry fixture', body: 'One seed message for a provider idempotency-conflict test.' } } });
    await queue(seed.id);
    const original = await waitFor('Strict retry seed', async () => {
      const row = await rowState(seed.id);
      return row.status === 'SENT' && row.providerMessageId ? row : false;
    });
    await db.emailOutbox.update({ where: { id: seed.id }, data: { status: 'PENDING', attemptCount: 0, nextAttemptAt: new Date(),
      subject: 'Changed content for idempotency conflict', payload: { testMode: true, headline: 'Rejected conflicting request', body: 'Changed content must be rejected for the same provider idempotency key.' } } });
    await queue(seed.id);
    let lastAttempt = 0;
    let previousDue = null;
    await waitFor('Strict cloud retry 1 / 5 / 30 and terminal FAILED', async () => {
      const row = await rowState(seed.id);
      assert.equal(row.providerMessageId, original.providerMessageId);
      if (row.status !== 'FAILED' || row.attemptCount <= lastAttempt) return false;
      assert.equal(row.attemptCount, lastAttempt + 1, 'Every retry stage must be observed');
      if (previousDue) assert.ok(row.updatedAt >= previousDue, 'Retry ran before its due time');
      if (row.attemptCount < 4) {
        const evidence = assertRetryTiming(row);
        if (!evidence) return false;
        report({ test: 'Strict retry interval', outcome: 'PASS', id: row.id, attemptCount: row.attemptCount, ...evidence });
        previousDue = row.nextAttemptAt;
      } else {
        assert.equal(row.nextAttemptAt, null);
        report({ test: 'Strict terminal FAILED', outcome: 'PASS', id: row.id, attempts: 4, providerIdUnchanged: true });
      }
      lastAttempt = row.attemptCount;
      return lastAttempt === 4;
    }, 2_700_000);
    await db.$disconnect();
    process.exit(0);
  }

  // The immediate Inquiry already succeeded automatically. Never republish a pending Inquiry here.
  const sent = await db.emailOutbox.findFirst({ where: { status: 'SENT', template: 'CONTACT_INQUIRY' }, orderBy: { createdAt: 'desc' } });
  assert.ok(sent?.providerMessageId, 'Automatic Inquiry must pass before extended tests');
  await queue(sent.id);
  await pause(20_000);
  const duplicate = await rowState(sent.id);
  assert.equal(duplicate.attemptCount, sent.attemptCount);
  assert.equal(duplicate.providerMessageId, sent.providerMessageId);
  report({ test: 'Duplicate event', outcome: 'PASS', id: sent.id, attemptCount: duplicate.attemptCount, providerIdUnchanged: true });

  let retryId;
  let probe;
  if (!process.argv.includes('--newsletter-only')) {
  // The isolated probe already delivered once. Reusing its idempotency key with changed
  // content produces a provider conflict rather than another delivered message.
  probe = await db.emailOutbox.findFirst({ where: { type: 'PREVIEW_RETRY_FAILURE', status: 'SENT' }, orderBy: { createdAt: 'desc' } });
  if (!probe) {
    const seed = await db.emailOutbox.create({ data: { eventKey: 'preview-retry-seed:' + Date.now(), type: 'PREVIEW_RETRY_FAILURE',
      recipient: email, subject: 'Preview E2E retry fixture seed', template: 'NEWSLETTER_CAMPAIGN',
      payload: { testMode: true, headline: 'Authorized retry seed', body: 'One test message to establish an idempotency key.' } } });
    await queue(seed.id);
    probe = await waitFor('Retry seed delivered', async () => {
      const row = await rowState(seed.id);
      return row.status === 'SENT' && row.providerMessageId ? row : false;
    });
  }
  const retry = await db.emailOutbox.update({ where: { id: probe.id }, data: {
    status: 'PENDING', attemptCount: 0, nextAttemptAt: new Date(), lockedAt: null, lastError: null,
    subject: 'Changed content: isolated idempotency conflict',
    payload: { testMode: true, subject: 'Changed content: isolated idempotency conflict', headline: 'Rejected idempotency-conflict test', body: 'Different content for the same existing provider idempotency key.' },
  } });
  await queue(retry.id);
  const firstRetry = await waitFor('Retry first provider failure / 1 minute schedule', async () => {
    const row = await rowState(retry.id);
    if (row.status !== 'FAILED' || row.attemptCount !== 1 || !row.nextAttemptAt) return false;
    assert.equal(row.providerMessageId, probe.providerMessageId);
    const evidence = assertRetryTiming(row);
    return evidence ? { id: retry.id, attemptCount: row.attemptCount, nextAttemptAt: row.nextAttemptAt, ...evidence } : false;
  });
  retryId = retry.id;
  report({ test: 'Retry observation started', id: retryId, firstRetry });
  }

  const password = randomBytes(32).toString('base64url');
  const admin = await db.adminUser.upsert({ where: { username: 'preview_e2e_admin' },
    create: { username: 'preview_e2e_admin', name: 'Isolated Preview E2E', email: null, role: 'ADMIN', passwordHash: await hash(password, 12) },
    update: { passwordHash: await hash(password, 12), isActive: true } });
  const login = await call('/api/v1/admin/auth/login', { username: admin.username, password });
  session = login.response.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
  assert.ok(session);
  const createCampaign = async label => (await call('/api/v1/admin/newsletters', { subject: 'Preview E2E ' + label,
    headline: 'Isolated test only', body: 'Authorized Preview test. No Production audience.' })).data;
  const eventFor = (campaign, at) => ({ kind: 'campaign', campaignId: campaign.id, scheduledAt: at });

  const cancelled = await createCampaign('cancel');
  const cancelledAt = new Date(Date.now() + 300_000).toISOString();
  await call('/api/v1/admin/newsletters/' + cancelled.id + '/schedule', { scheduledAt: cancelledAt });
  assert.ok(readSchedule(scheduleName(eventFor(cancelled, cancelledAt), cancelledAt)));
  await call('/api/v1/admin/newsletters/' + cancelled.id + '/cancel', {});
  assert.equal(readSchedule(scheduleName(eventFor(cancelled, cancelledAt), cancelledAt)), null);
  report({ test: 'Newsletter cancel', outcome: 'PASS', campaignId: cancelled.id });

  const campaign = await createCampaign('future and batch');
  const oldAt = new Date(Date.now() + 300_000).toISOString();
  await call('/api/v1/admin/newsletters/' + campaign.id + '/schedule', { scheduledAt: oldAt });
  assert.ok(readSchedule(scheduleName(eventFor(campaign, oldAt), oldAt)));
  // Twenty synthetic ineligible rows exercise page continuation without sending twenty emails.
  await db.emailOutbox.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ eventKey: `preview-batch:${campaign.id}:${i}`,
    type: 'PREVIEW_BATCH_INELIGIBLE', recipient: email, subject: 'Synthetic ineligible row', template: 'NEWSLETTER_CAMPAIGN',
    newsletterCampaignId: campaign.id, payload: { testMode: false, headline: 'Synthetic row' } })) });
  const newAt = new Date(Date.now() + 90_000).toISOString();
  await call('/api/v1/admin/newsletters/' + campaign.id + '/schedule', { scheduledAt: newAt });
  assert.equal(readSchedule(scheduleName(eventFor(campaign, oldAt), oldAt)), null);
  const newSchedule = readSchedule(scheduleName(eventFor(campaign, newAt), newAt));
  assert.ok(newSchedule);
  report({ test: 'Newsletter reschedule', outcome: 'PASS', campaignId: campaign.id, newAt, schedule: newSchedule });

  await waitFor('Future Newsletter and batch continuation', async () => {
    const rows = await db.emailOutbox.findMany({ where: { newsletterCampaignId: campaign.id }, select: { status: true, recipient: true, providerMessageId: true } });
    assert.ok(rows.every(r => r.recipient === email));
    const delivered = rows.filter(r => r.status === 'SENT');
    const skipped = rows.filter(r => r.status === 'SKIPPED');
    if (rows.length === 21 && delivered.length === 1 && skipped.length === 20)
      return { rows: rows.length, sent: 1, skipped: 20, realAudience: 1, syntheticContinuationRows: 20,
        campaignStatus: (await db.newsletterCampaign.findUnique({ where: { id: campaign.id } })).status };
    return false;
  });

  let lastAttempt = 1;
  if (retryId) {
  await waitFor('Retry 1 / 5 / 30 minutes and terminal FAILED', async () => {
    const row = await rowState(retryId);
    assert.equal(row.providerMessageId, probe.providerMessageId, 'Conflict fixture must not create another provider message');
    if (row.attemptCount > lastAttempt) {
      if (row.nextAttemptAt) {
        const evidence = assertRetryTiming(row);
        if (!evidence) return false;
        report({ test: 'Retry progressed', attemptCount: row.attemptCount, nextAttemptAt: row.nextAttemptAt, ...evidence });
      } else report({ test: 'Retry terminal state', attemptCount: row.attemptCount, status: row.status });
      lastAttempt = row.attemptCount;
    }
    return row.status === 'FAILED' && row.attemptCount === 4 && row.nextAttemptAt === null
      ? { id: retryId, attempts: 4, additionalSend: false } : false;
  }, 2_700_000);
  }
  assert.equal(await db.emailOutbox.count({ where: { newsletterCampaignId: cancelled.id } }), 0);
  report({ outcome: 'PASS', productionWrites: false, recipient: email });
} catch (error) {
  report({ outcome: 'STOPPED', reason: error.message, name: error.name });
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
