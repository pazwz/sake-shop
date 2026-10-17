export const createHandler = ({ readSecret, request = fetch, environment = process.env }) => async (event) => {
  const failures = [];
  const endpoint = environment.EMAIL_PROCESS_ENDPOINT_URL;
  if (!endpoint?.startsWith('https://') || !environment.CRON_SECRET_PARAMETER)
    throw new Error('EMAIL_EVENT_WORKER_NOT_CONFIGURED');
  const stored = await readSecret(environment.CRON_SECRET_PARAMETER);
  if (!stored) throw new Error('EMAIL_EVENT_AUTH_UNAVAILABLE');
  if (environment.EMAIL_DEPLOYMENT_ENV === 'preview' && !stored.startsWith('{'))
    throw new Error('EMAIL_EVENT_PREVIEW_AUTH_INVALID');
  let secret = stored;
  const headers = { 'Content-Type': 'application/json' };
  if (stored.startsWith('{')) {
    let auth;
    try { auth = JSON.parse(stored); } catch { throw new Error('EMAIL_EVENT_PREVIEW_AUTH_INVALID'); }
    if (environment.EMAIL_DEPLOYMENT_ENV !== 'preview' || auth.kind !== 'preview' || auth.endpoint !== endpoint ||
        typeof auth.secret !== 'string' || !auth.secret ||
        typeof auth.protectionCookie !== 'string' || !/^_vercel_jwt=[A-Za-z0-9_.-]+$/.test(auth.protectionCookie) ||
        !(new Date(auth.expiresAt).getTime() > Date.now()))
      throw new Error('EMAIL_EVENT_PREVIEW_AUTH_INVALID');
    secret = auth.secret;
    headers.Cookie = auth.protectionCookie;
  }
  headers.Authorization = `Bearer ${secret}`;
  for (const record of event.Records ?? []) {
    try {
      const payload = JSON.parse(record.body);
      // The application strictly validates the identifier-only event again.
      const response = await request(endpoint, {
        method: 'POST',
        headers,
        redirect: 'error',
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
