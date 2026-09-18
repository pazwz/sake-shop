import { SyncStatus } from '@prisma/client';
import { OPERATIONS_HEALTH_THRESHOLDS } from '@/config/operations';
import {
  OperationsHealthRepository,
  type OperationsRun,
} from '@/repositories/operations-health.repository';
import type {
  OperationsHealth,
  OperationsHealthItem,
  OperationsHealthStatus,
} from '@/types/operations';

type Snapshot = Awaited<ReturnType<OperationsHealthRepository['getSnapshot']>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toIso = (value: Date | null | undefined) => value?.toISOString() ?? null;

const isWarningSync = (run: OperationsRun | undefined) =>
  isRecord(run?.responsePayload) &&
  run.responsePayload.outcome === 'SUCCESS_WITH_WARNINGS';

const workerHealth = (
  runs: OperationsRun[],
  now: Date,
  thresholds: { warningMs: number; criticalMs: number },
  backlogCount: number,
  summary: string,
): OperationsHealthItem => {
  const latest = runs[0];
  const lastSuccess = runs.find((run) => run.status === SyncStatus.SUCCESS);
  const lastSuccessAt = lastSuccess?.completedAt ?? lastSuccess?.createdAt;
  const lastAttemptAt = latest?.completedAt ?? latest?.createdAt;
  const failureCount = runs.filter(
    (run) => run.status === SyncStatus.FAILED,
  ).length;
  if (!latest || !lastSuccessAt) {
    return {
      status: 'UNKNOWN',
      lastSuccessAt: null,
      lastAttemptAt: toIso(lastAttemptAt),
      failureCount,
      stale: false,
      backlogCount,
      summary: '実行履歴をまだ取得できていません。',
    };
  }
  const elapsed = now.getTime() - lastSuccessAt.getTime();
  const stale = elapsed > thresholds.warningMs;
  const status: OperationsHealthStatus =
    latest.status === SyncStatus.FAILED || elapsed > thresholds.criticalMs
      ? 'CRITICAL'
      : stale
        ? 'WARNING'
        : 'HEALTHY';
  return {
    status,
    lastSuccessAt: toIso(lastSuccessAt),
    lastAttemptAt: toIso(lastAttemptAt),
    failureCount,
    stale,
    backlogCount,
    summary,
  };
};

export class OperationsHealthService {
  public constructor(
    private readonly repository = new OperationsHealthRepository(),
  ) {}

  public async getHealth(now = new Date()): Promise<OperationsHealth> {
    const snapshot = await this.repository.getSnapshot(now);
    return {
      generatedAt: now.toISOString(),
      smaregiSync: this.smaregiHealth(snapshot, now),
      reservationExpiration: this.reservationHealth(snapshot, now),
      emailOutbox: this.emailHealth(snapshot, now),
      paymentReview: this.paymentHealth(snapshot),
    };
  }

  private smaregiHealth(snapshot: Snapshot, now: Date): OperationsHealthItem {
    const item = workerHealth(
      snapshot.smaregiRuns,
      now,
      OPERATIONS_HEALTH_THRESHOLDS.smaregiSync,
      0,
      'Smaregi 本番同期の最新実行結果です。',
    );
    if (item.status === 'HEALTHY' && isWarningSync(snapshot.smaregiRuns[0])) {
      return {
        ...item,
        status: 'WARNING',
        summary:
          '既知の警告を含む同期が完了しました。fatal 異常ではありません。',
      };
    }
    return item;
  }

  private reservationHealth(
    snapshot: Snapshot,
    now: Date,
  ): OperationsHealthItem {
    const item = workerHealth(
      snapshot.reservationRuns,
      now,
      OPERATIONS_HEALTH_THRESHOLDS.reservationWorker,
      snapshot.expiredReservations,
      '期限切れ ACTIVE reservation と期限処理 worker を監視しています。',
    );
    if (
      snapshot.expiredReservations >=
      OPERATIONS_HEALTH_THRESHOLDS.reservationExpiredBacklog.critical
    )
      return {
        ...item,
        status: 'CRITICAL',
        summary: '期限切れの ACTIVE reservation が蓄積しています。',
      };
    if (
      snapshot.expiredReservations >=
      OPERATIONS_HEALTH_THRESHOLDS.reservationExpiredBacklog.warning
    )
      return {
        ...item,
        status: 'WARNING',
        summary: '期限切れの ACTIVE reservation を確認してください。',
      };
    return item;
  }

  private emailHealth(snapshot: Snapshot, now: Date): OperationsHealthItem {
    const backlogCount =
      snapshot.email.pending +
      snapshot.email.stuckSending +
      snapshot.email.terminalTransactionalFailed;
    const item = workerHealth(
      snapshot.emailRuns,
      now,
      OPERATIONS_HEALTH_THRESHOLDS.emailWorker,
      backlogCount,
      'EmailOutbox worker と transactional delivery queue を監視しています。',
    );
    if (
      snapshot.email.terminalTransactionalFailed > 0 ||
      snapshot.email.stuckSending > 0
    )
      return {
        ...item,
        status: 'CRITICAL',
        summary:
          'transactional email の送信失敗または stuck SENDING を確認してください。',
      };
    if (
      snapshot.email.pending >=
      OPERATIONS_HEALTH_THRESHOLDS.emailPendingBacklog.critical
    )
      return {
        ...item,
        status: 'CRITICAL',
        summary: 'EmailOutbox の PENDING backlog が大きすぎます。',
      };
    if (
      snapshot.email.pending >=
        OPERATIONS_HEALTH_THRESHOLDS.emailPendingBacklog.warning ||
      snapshot.email.terminalNewsletterFailed > 0
    )
      return {
        ...item,
        status: 'WARNING',
        summary:
          'EmailOutbox backlog または newsletter contact sync の失敗があります。',
      };
    return item;
  }

  private paymentHealth(snapshot: Snapshot): OperationsHealthItem {
    const hasReview = snapshot.paymentReviewCount > 0;
    return {
      status: hasReview ? 'WARNING' : 'HEALTHY',
      lastSuccessAt: null,
      lastAttemptAt: toIso(snapshot.oldestPaymentReviewAt),
      failureCount: 0,
      stale: false,
      backlogCount: snapshot.paymentReviewCount,
      summary: hasReview
        ? 'REQUIRES_REVIEW payment は人工照合が必要です。自動で在庫を再確保しません。'
        : 'REQUIRES_REVIEW payment はありません。',
    };
  }
}
