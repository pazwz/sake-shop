import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

export const handler = async () => {
  const startedAt = Date.now();
  const endpoint = process.env.EXPIRATION_ENDPOINT_URL;
  const parameterName = process.env.CRON_SECRET_PARAMETER;

  if (!endpoint || !parameterName) {
    throw new Error('TRIGGER_CONFIGURATION_MISSING');
  }

  try {
    const parameter = await ssm.send(
      new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
    );
    const secret = parameter.Parameter?.Value;
    if (!secret) throw new Error('CRON_SECRET_MISSING');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status === 401) throw new Error('AUTH_FAILED');
    if (!response.ok) throw new Error(`ENDPOINT_HTTP_${response.status}`);

    const payload = await response.json();
    const transitioned = payload?.data?.transitioned;
    if (payload?.success !== true || typeof transitioned !== 'number') {
      throw new Error('ENDPOINT_RESPONSE_INVALID');
    }

    console.log(
      JSON.stringify({
        event: 'reservation_expiration_trigger',
        outcome: 'SUCCESS',
        statusCode: response.status,
        transitioned,
        durationMs: Date.now() - startedAt,
      }),
    );

    return { statusCode: response.status, transitioned };
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN_FAILURE';
    console.error(
      JSON.stringify({
        event: 'reservation_expiration_trigger',
        outcome: 'FAILED',
        code,
        durationMs: Date.now() - startedAt,
      }),
    );
    throw error;
  }
};
