import { OperationsRunRepository } from '@/repositories/operations-run.repository';

const safeSummary = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const summary: Record<string, number | string> = {};
  for (const key of ['processed', 'sent', 'failed', 'transitioned']) {
    if (typeof source[key] === 'number') summary[key] = source[key];
  }
  if (typeof source.outcome === 'string') summary.outcome = source.outcome;
  return summary;
};

export class OperationsRunService {
  public constructor(
    private readonly repository = new OperationsRunRepository(),
  ) {}

  public async run<T>(operation: string, work: () => Promise<T>) {
    const run = await this.repository.start(operation);
    try {
      const result = await work();
      await this.repository.succeed(run.id, safeSummary(result));
      return result;
    } catch (error) {
      await this.repository.fail(
        run.id,
        error instanceof Error ? error.message : 'OPERATIONS_WORKER_FAILED',
      );
      throw error;
    }
  }
}
