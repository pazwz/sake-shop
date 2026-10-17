import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { SSMClient, GetParameterCommand } = require('/tmp/linxas-email-infra-PDGcnu/node_modules/@aws-sdk/client-ssm');
const { fromIni } = require('/tmp/linxas-email-infra-PDGcnu/node_modules/@aws-sdk/credential-provider-ini');
const origin = process.env.PREVIEW_E2E_ORIGIN;
if (!origin || !/^https:\/\/sake-shop-[a-z0-9]+-latte-moca\.vercel\.app$/.test(origin))
  throw new Error('EXPLICIT_PREVIEW_E2E_ORIGIN_REQUIRED');
const email = 'pazwz@yahoo.co.jp';
const url = execFileSync('npx', ['--yes', 'neon@8.7.2', 'connection-string', '--project-id', 'cold-bread-74303000', '--profile', 'linxas-preview-e2e', '--pooled'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
assert.match(new URL(url).hostname, /^ep-muddy-shadow-a1ivn2h4-pooler\.ap-southeast-1\.aws\.neon\.tech$/);
const db = new PrismaClient({ datasources: { db: { url } } });
const mediaEnvironment = Object.fromEntries(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].map(key => [key, process.env[key]]));
const operationsProfile = 'default';
const operationsCredentials = fromIni({ profile: operationsProfile });
const caller = JSON.parse(execFileSync('aws', ['sts', 'get-caller-identity', '--profile', operationsProfile, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(caller.Arn, 'arn:aws:iam::108782085732:user/sake-shop-admin');
const resolved = await operationsCredentials();
if (mediaEnvironment.AWS_ACCESS_KEY_ID && resolved.accessKeyId === mediaEnvironment.AWS_ACCESS_KEY_ID)
  throw new Error('MEDIA_IDENTITY_SELECTED');
const parameterClient = new SSMClient({ region: 'ap-northeast-1', credentials: operationsCredentials });
const auth = JSON.parse((await parameterClient.send(new GetParameterCommand({ Name: '/sake-shop/preview/email-event-secret', WithDecryption: true }))).Parameter.Value);
if (Object.keys(mediaEnvironment).some(key => process.env[key] !== mediaEnvironment[key]))
  throw new Error('AWS_ENVIRONMENT_WAS_CHANGED');
assert.equal(auth.endpoint, origin + '/api/v1/internal/email/process');
assert.ok(new Date(auth.expiresAt) > new Date());

if (process.argv.includes('--preflight')) {
  process.stdout.write(JSON.stringify({ operationsProfile, caller: caller.Arn, provider: 'fromIni(default)', previewParameterRead: true, mediaIdentityNotSelected: true, mediaEnvironmentPreserved: true, expiresAt: auth.expiresAt }) + '\n');
  await db.$disconnect();
  process.exit(0);
}

const report = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const call = async (path, body, cookies = '', internal = false) => {
  const response = await fetch(origin + path, {
    method: 'POST', redirect: 'error',
    headers: { Cookie: [auth.protectionCookie, cookies].filter(Boolean).join('; '), Origin: origin, 'Content-Type': 'application/json', ...(internal ? { Authorization: 'Bearer ' + auth.secret } : {}) },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
};

try {
  for (const [model, field] of [['customer', 'email'], ['newsletterSubscription', 'email'], ['emailOutbox', 'recipient']]) {
    assert.equal(await db[model].count({ where: { [field]: { not: email } } }), 0, 'Recipient allowlist mismatch; stop');
  }
  const password = randomBytes(32).toString('base64url');
  const customer = await db.customer.update({ where: { email }, data: { passwordHash: await hash(password, 12), emailVerifiedAt: new Date() } });
  const login = await call('/api/v1/customer/login', { email, password });
  assert.equal(login.response.status, 200, 'Customer fixture login failed');
  const session = login.response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  assert.ok(session, 'Missing Customer session');
  const order = await db.order.create({ data: {
    customerId: customer.id, orderNumber: 'PREVIEW-E2E-' + Date.now(),
    subtotal: 0, shippingFee: 0, taxAmount: 0, totalAmount: 0,
    paymentMethod: 'PREVIEW_TEST_NO_PAYMENT', shippingAddressSnapshot: { test: true },
  } });
  const start = new Date();
  const inquiry = await call('/api/v1/my/orders/' + order.id + '/inquiries', { message: 'Isolated Preview E2E staff notification. Synthetic test data only.' }, session);
  report({ test: 'Inquiry API', http: inquiry.response.status, success: inquiry.data.success, errorCode: inquiry.data.error?.code });
  assert.equal(inquiry.response.status, 201);
  const rows = await db.emailOutbox.findMany({ where: { createdAt: { gte: start } }, select: { id: true, recipient: true, status: true, attemptCount: true, template: true, providerMessageId: true } });
  assert.ok(rows.length > 0, 'Inquiry must create notification Outbox');
  assert.ok(rows.every(r => r.recipient === email), 'Recipient mismatch; stop');
  report({ test: 'Immediate Inquiry Outbox', rows: rows.map(({ recipient: _recipient, ...r }) => r) });
  for (let i = 0; i < 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const state = await db.emailOutbox.findMany({ where: { id: { in: rows.map(r => r.id) } }, select: { id: true, status: true, attemptCount: true, lastError: true } });
    report({ test: 'Immediate delivery observation', elapsedSeconds: (i + 1) * 5, state });
    if (state.every(r => r.status === 'SENT')) { report({ test: 'Immediate Inquiry delivery', outcome: 'PASS' }); break; }
    if (i === 5) throw new Error('IMMEDIATE_INQUIRY_NOT_SENT');
  }
} catch (error) {
  report({ outcome: 'STOPPED', reason: error.message, name: error.name });
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
