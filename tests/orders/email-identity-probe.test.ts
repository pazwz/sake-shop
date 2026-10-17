import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailIdentityProbeService } from '@/services/email-identity-probe.service';

test('identity probe verifies the assumed Email role and creates only a disabled future identifier schedule', async () => {
  const inputs: Record<string, unknown>[] = [];
  const service = new EmailIdentityProbeService(
    { send: async () => ({ Arn: 'arn:aws:sts::108782085732:assumed-role/sake-shop-production-email-app/test' }) } as never,
    { send: async (command: { input: Record<string, unknown> }) => { inputs.push(command.input); return {}; } } as never,
  );
  const result = await service.create();
  assert.match(result.scheduleName, /^email-identity-probe-/);
  assert.equal(inputs[0].State, 'DISABLED');
  assert.equal(inputs[0].GroupName, 'sake-shop-production-email-once');
  assert.ok(Date.parse(String(inputs[0].ScheduleExpression).slice(3, -1) + 'Z') > Date.now() + 20 * 86400_000);
  const target = inputs[0].Target as Record<string, string>;
  assert.equal(target.Arn, 'arn:aws:sqs:ap-northeast-1:108782085732:sake-shop-production-email-events');
  assert.deepEqual(JSON.parse(target.Input), { kind: 'outbox', outboxId: 'email-identity-probe' });
  await service.cancel(result.scheduleName);
  assert.deepEqual(inputs[1], { Name: result.scheduleName, GroupName: 'sake-shop-production-email-once' });
  await assert.rejects(service.cancel('email-real-campaign'), /EMAIL_IDENTITY_PROBE_NAME_INVALID/);
  assert.equal(inputs.length, 2);
});

test('a media or administrator caller cannot satisfy the identity probe', async () => {
  let creates = 0;
  const service = new EmailIdentityProbeService(
    { send: async () => ({ Arn: 'arn:aws:iam::108782085732:user/sake-shop-media-app' }) } as never,
    { send: async () => { creates++; } } as never,
  );
  await assert.rejects(service.create(), /EMAIL_IDENTITY_MISMATCH/);
  assert.equal(creates, 0);
});
