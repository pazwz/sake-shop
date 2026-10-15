import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand } from '@aws-sdk/client-scheduler';
import type { EmailEvent, EmailEventAdapter } from '@/services/email-event-transport.service';

/** Configuration is deliberately not provisioned or written into Production by this change. */
export class AwsEmailEventAdapter implements EmailEventAdapter {
  constructor(
    private readonly sqs = new SQSClient({}),
    private readonly scheduler = new SchedulerClient({}),
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  private configuration() {
    const { EMAIL_EVENT_QUEUE_URL: url, EMAIL_EVENT_QUEUE_ARN: arn, EMAIL_EVENT_DLQ_ARN: dlq, EMAIL_EVENT_SCHEDULE_GROUP: group, EMAIL_EVENT_SCHEDULE_ROLE_ARN: role } = this.env;
    if (!url || !arn || !dlq || !group || !role) throw new Error('EMAIL_EVENTS_NOT_CONFIGURED');
    return { url, arn, dlq, group, role };
  }

  async publish(event: EmailEvent) {
    const config = this.configuration();
    await this.sqs.send(new SendMessageCommand({ QueueUrl: config.url, MessageBody: JSON.stringify(event) }));
  }

  async schedule(name: string, event: EmailEvent, at: Date) {
    const config = this.configuration();
    // Scheduler accepts second precision. Round up, never retry earlier than eligibility.
    const when = new Date(Math.ceil(at.getTime() / 1000) * 1000).toISOString().slice(0, 19);
    try {
      await this.scheduler.send(new CreateScheduleCommand({
        Name: name, GroupName: config.group,
        ScheduleExpression: `at(${when})`, ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: 'OFF' }, ActionAfterCompletion: 'DELETE',
        Target: { Arn: config.arn, RoleArn: config.role, Input: JSON.stringify(event),
          DeadLetterConfig: { Arn: config.dlq },
          RetryPolicy: { MaximumEventAgeInSeconds: 86400, MaximumRetryAttempts: 10 } },
      }));
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'ConflictException') throw error;
      // Deterministic name includes payload and timestamp; a duplicate has identical intent.
    }
  }

  async cancel(name: string) {
    const config = this.configuration();
    try { await this.scheduler.send(new DeleteScheduleCommand({ Name: name, GroupName: config.group })); }
    catch (error) { if (!(error instanceof Error) || error.name !== 'ResourceNotFoundException') throw error; }
  }
}
