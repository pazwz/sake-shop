import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { AwsEmailEventAdapter } from '@/services/email-event-adapters/aws-email-event.adapter';

test('AWS adapter requests only identifier messages, scoped one-time UTC schedules, completed deletion and DLQ', async () => {
  const queueInputs: Array<Record<string, unknown>> = [];
  const scheduleInputs: Array<Record<string, unknown>> = [];
  const env = {
    EMAIL_EVENT_QUEUE_URL: 'https://sqs.ap-northeast-1.amazonaws.com/000000000000/test',
    EMAIL_EVENT_QUEUE_ARN: 'arn:aws:sqs:ap-northeast-1:000000000000:test',
    EMAIL_EVENT_DLQ_ARN: 'arn:aws:sqs:ap-northeast-1:000000000000:test-dlq',
    EMAIL_EVENT_SCHEDULE_GROUP: 'test-email-once',
    EMAIL_EVENT_SCHEDULE_ROLE_ARN: 'arn:aws:iam::000000000000:role/test-scheduler',
  };
  const adapter = new AwsEmailEventAdapter(
    { send: async (command: { input: Record<string, unknown> }) => { queueInputs.push(command.input); } } as never,
    { send: async (command: { input: Record<string, unknown> }) => { scheduleInputs.push(command.input); } } as never,
    env,
  );
  const event = { kind: 'outbox' as const, outboxId: 'row' };
  await adapter.publish(event);
  assert.equal(queueInputs[0].MessageBody, '{"kind":"outbox","outboxId":"row"}');
  await adapter.schedule('email-test', event, new Date('2026-10-16T00:00:00.123Z'));
  assert.equal(scheduleInputs[0].ScheduleExpression, 'at(2026-10-16T00:00:01)');
  assert.equal(scheduleInputs[0].ActionAfterCompletion, 'DELETE');
  assert.equal(scheduleInputs[0].GroupName, 'test-email-once');
  const target = scheduleInputs[0].Target as Record<string, unknown>;
  assert.equal(target.Arn, env.EMAIL_EVENT_QUEUE_ARN);
  assert.deepEqual(target.DeadLetterConfig, { Arn: env.EMAIL_EVENT_DLQ_ARN });
  await adapter.cancel('email-test');
  assert.deepEqual(scheduleInputs[1], { Name: 'email-test', GroupName: 'test-email-once' });
});

test('queue worker acknowledges success only; transport, auth and malformed responses are redelivered without leaking secrets', async () => {
  const modulePath = pathToFileURL(process.cwd() + '/infrastructure/aws/email-events/index.mjs').href;
  const { createHandler } = await import(modulePath);
  const requests: RequestInit[] = [];
  let status = 503;
  const worker = createHandler({
    environment: { EMAIL_PROCESS_ENDPOINT_URL: 'https://example.test/api/v1/internal/email/process', CRON_SECRET_PARAMETER: '/test/secret' },
    readSecret: async () => 'test-only-secret',
    request: async (_url: string, init: RequestInit) => {
      requests.push(init);
      return new Response(JSON.stringify({ success: true, data: { outcome: 'SUCCESS' } }), { status });
    },
  });
  const event = { Records: [{ messageId: 'message-id', body: '{"kind":"outbox","outboxId":"row"}' }] };
  assert.deepEqual(await worker(event), { batchItemFailures: [{ itemIdentifier: 'message-id' }] });
  status = 200;
  assert.deepEqual(await worker(event), { batchItemFailures: [] });
  assert.equal(requests[0].body, '{"event":{"kind":"outbox","outboxId":"row"}}');
});
