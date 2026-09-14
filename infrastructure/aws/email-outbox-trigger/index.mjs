import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

export const handler = async () => {
  const startedAt = Date.now();
  const endpoint = process.env.EMAIL_PROCESS_ENDPOINT_URL;
  const parameterName = process.env.CRON_SECRET_PARAMETER;
  if (!endpoint || !parameterName)
    throw new Error('TRIGGER_CONFIGURATION_MISSING');
  try {
    const parameter = await ssm.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    );
    const secret = parameter.Parameter?.Value;
    if (!secret) throw new Error('CRON_SECRET_MISSING');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(45_000),
    });
    if (response.status === 401) throw new Error('AUTH_FAILED');
    if (!response.ok) throw new Error(`ENDPOINT_HTTP_${response.status}`);
    const payload = await response.json();
    if (payload?.success !== true || typeof payload?.data?.outcome !== 'string')
      throw new Error('ENDPOINT_RESPONSE_INVALID');
    console.log(
      JSON.stringify({
        event: 'email_outbox_trigger',
        outcome: payload.data.outcome,
        statusCode: response.status,
        processed: Number(payload.data.processed ?? 0),
        sent: Number(payload.data.sent ?? 0),
        failed: Number(payload.data.failed ?? 0),
        durationMs: Date.now() - startedAt,
      }),
    );
    return { statusCode: response.status, outcome: payload.data.outcome };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
    console.error(
      JSON.stringify({
        event: 'email_outbox_trigger',
        outcome: 'FAILED',
        code,
        durationMs: Date.now() - startedAt,
      }),
    );
    throw error;
  }
};
