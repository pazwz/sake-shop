import {
  EMAIL_DISPATCH_TRIGGER_DELAYS_MS,
  EMAIL_DISPATCH_TRIGGER_TIMEOUT_MS,
  getEmailDispatchTriggerConfig,
  type EmailEnvironment,
} from '@/config/email';

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type EmailDispatchTriggerLogger = (event: {
  event: 'email_dispatch_trigger';
  outcome: 'FAILED';
  code: string;
  attempts: number;
}) => void;

type Wait = (milliseconds: number) => Promise<void>;

const wait: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const defaultLogger: EmailDispatchTriggerLogger = (event) =>
  console.error(JSON.stringify(event));

/**
 * Wakes the authenticated EmailOutbox worker only after the caller's database
 * transaction has completed. Trigger failure is intentionally non-fatal: the
 * durable PENDING outbox row remains available to recovery processing.
 */
export class EmailDispatchTriggerService {
  public constructor(
    private readonly fetcher: FetchLike = fetch,
    private readonly environment: EmailEnvironment = process.env,
    private readonly logger: EmailDispatchTriggerLogger = defaultLogger,
    private readonly waitForRetry: Wait = wait,
  ) {}

  public async trigger(outboxId?: string) {
    const config = getEmailDispatchTriggerConfig(this.environment);
    if (!config.available || !config.secret)
      return {
        triggered: false as const,
        reason: 'TRIGGER_UNAVAILABLE',
        attempts: 0,
      };

    let failureCode = 'EMAIL_WORKER_TRIGGER_REQUEST_FAILED';
    for (const [index, delay] of EMAIL_DISPATCH_TRIGGER_DELAYS_MS.entries()) {
      if (delay > 0) await this.waitForRetry(delay);
      try {
        const response = await this.fetcher(config.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(outboxId ? { outboxId } : {}),
          signal: AbortSignal.timeout(EMAIL_DISPATCH_TRIGGER_TIMEOUT_MS),
        });
        if (response.ok)
          return { triggered: true as const, reason: null, attempts: index + 1 };
        failureCode = `EMAIL_WORKER_HTTP_${response.status}`;
      } catch {
        // Do not log raw transport errors: they can contain sensitive URLs or
        // implementation details. The durable outbox will be recovered later.
        failureCode = 'EMAIL_WORKER_TRIGGER_REQUEST_FAILED';
      }
    }

    this.logger({
      event: 'email_dispatch_trigger',
      outcome: 'FAILED',
      code: failureCode,
      attempts: EMAIL_DISPATCH_TRIGGER_DELAYS_MS.length,
    });
    return {
      triggered: false as const,
      reason: 'TRIGGER_FAILED',
      attempts: EMAIL_DISPATCH_TRIGGER_DELAYS_MS.length,
    };
  }
}
