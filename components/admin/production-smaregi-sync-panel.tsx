'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmaregiProductionSyncStatus } from '@/types/smaregi-production-sync';

type ApiPayload = {
  success: boolean;
  error: { detail: string } | null;
};

const statusLabel = (status: SmaregiProductionSyncStatus) => {
  if (!status.status) return '未実行';
  if (status.outcome === 'SUCCESS_WITH_WARNINGS') return '完了（警告あり）';
  if (status.outcome === 'SKIPPED_ALREADY_RUNNING')
    return '実行中のためスキップ';
  if (status.status === 'SUCCESS') return '完了';
  if (status.status === 'FAILED') return '失敗';
  return '実行中';
};

export function ProductionSmaregiSyncPanel({
  status,
  canSync,
}: {
  status: SmaregiProductionSyncStatus;
  canSync: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const synchronize = async () => {
    if (running) return;
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch('/api/v1/admin/integrations/smaregi/sync', {
        method: 'POST',
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.success) {
        setMessage(payload.error?.detail ?? 'スマレジ同期に失敗しました。');
        return;
      }
      setMessage('スマレジ同期が完了しました。');
      router.refresh();
    } catch {
      setMessage('スマレジ同期に失敗しました。');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      className="mt-10 border-y line py-6"
      aria-labelledby="smaregi-sync-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="eyebrow">SMAREGI SYNC</p>
          <h2 id="smaregi-sync-title" className="serif mt-2 text-2xl">
            スマレジ同期
          </h2>
          <p className="mt-2 text-xs text-stone-500">
            最終同期：
            {status.completedAt
              ? new Date(status.completedAt).toLocaleString('ja-JP')
              : '未実行'}
            {' ／ '}
            状態：{statusLabel(status)}
          </p>
        </div>
        {canSync ? (
          <button
            type="button"
            className="btn bg-[#171412] text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={running}
            onClick={() => void synchronize()}
          >
            {running ? '同期中…' : '今すぐ同期'}
          </button>
        ) : (
          <p className="text-xs text-stone-500">閲覧のみ可能です。</p>
        )}
      </div>
      {status.summary ? (
        <p className="mt-4 text-xs leading-6 text-stone-600">
          商品 作成 {status.summary.productsCreated} / 更新{' '}
          {status.summary.productsUpdated}、在庫 作成{' '}
          {status.summary.inventoryCreated} / 更新{' '}
          {status.summary.inventoryUpdated} / ゼロ更新{' '}
          {status.summary.inventoryZeroed}、警告 {status.summary.warningsCount}
          （税設定保留 {status.summary.productsDeferred}、隔離{' '}
          {status.summary.productsQuarantined}、新規孤立在庫{' '}
          {status.summary.newOrphanCount}、既知孤立在庫{' '}
          {status.summary.knownOrphanCount}、負在庫{' '}
          {status.summary.negativeCount}）
        </p>
      ) : null}
      {status.errorMessage ? (
        <p className="mt-3 text-sm text-red-700">{status.errorMessage}</p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-stone-700" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
