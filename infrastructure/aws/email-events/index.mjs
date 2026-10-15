export const createHandler = ({ readSecret, request = fetch, environment = process.env }) => async (event) => {
  const failures = [];
  const endpoint = environment.EMAIL_PROCESS_ENDPOINT_URL;
  if (!endpoint?.startsWith('https://') || !environment.CRON_SECRET_PARAMETER)
    throw new Error('EMAIL_EVENT_WORKER_NOT_CONFIGURED');
  const secret = await readSecret(environment.CRON_SECRET_PARAMETER);
  if (!secret) throw new Error('EMAIL_EVENT_AUTH_UNAVAILABLE');
  for (const record of event.Records ?? []) {
    try {
      const payload = JSON.parse(record.body);
      // The application strictly validates the identifier-only event again.
      const response = await request(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: payload }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error('EMAIL_EVENT_ENDPOINT_REJECTED');
      const result = await response.json();
      if (result.success !== true || !['SUCCESS', 'NOOP', 'DEFERRED', 'QUEUED'].includes(result.data?.outcome))
        throw new Error('EMAIL_EVENT_RESPONSE_INVALID');
    } catch {
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  // Do not log payload, URLs, response bodies, secret or raw exceptions.
  return { batchItemFailures: failures };
};

export const handler = async (event) => {
  const { GetParameterCommand, SSMClient } = await import('@aws-sdk/client-ssm');
  const ssm = new SSMClient({});
  return createHandler({
    readSecret: async (name) => (await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }))).Parameter?.Value,
  })(event);
};
