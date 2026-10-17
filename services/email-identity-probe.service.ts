import { randomUUID } from 'node:crypto';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { CreateScheduleCommand, DeleteScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler';
import { getEmailAwsClientConfig } from '@/lib/aws/email-event-client';

const group = 'sake-shop-production-email-once';
const role = 'arn:aws:iam::108782085732:role/sake-shop-production-email-events-SchedulerRole-zrRAPku9ErOz';

/** No database, SQS publish or email provider access. Disabled schedules cannot dispatch. */
export class EmailIdentityProbeService {
  constructor(
    private readonly sts = new STSClient(getEmailAwsClientConfig()),
    private readonly scheduler = new SchedulerClient(getEmailAwsClientConfig()),
  ) {}

  async create() {
    const caller = await this.sts.send(new GetCallerIdentityCommand({}));
    if (!caller.Arn?.startsWith('arn:aws:sts::108782085732:assumed-role/sake-shop-production-email-app/'))
      throw new Error('EMAIL_IDENTITY_MISMATCH');
    const name = `email-identity-probe-${randomUUID()}`;
    const when = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 19);
    await this.scheduler.send(new CreateScheduleCommand({
      Name: name, GroupName: group, State: 'DISABLED',
      ScheduleExpression: `at(${when})`, ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' }, ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: 'arn:aws:sqs:ap-northeast-1:108782085732:sake-shop-production-email-events',
        RoleArn: role,
        Input: JSON.stringify({ kind: 'outbox', outboxId: 'email-identity-probe' }),
      },
    }));
    return { callerArn: caller.Arn, scheduleName: name, state: 'DISABLED' };
  }

  async cancel(name: string) {
    if (!/^email-identity-probe-[0-9a-f-]{36}$/.test(name))
      throw new Error('EMAIL_IDENTITY_PROBE_NAME_INVALID');
    await this.scheduler.send(new DeleteScheduleCommand({ Name: name, GroupName: group }));
    return { cancelled: true };
  }
}
