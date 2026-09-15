'use client';

import { useState } from 'react';

type Item = {
  id: string;
  type: string;
  smaregiProductId: string | null;
  productCode: string | null;
  productName: string | null;
  storeId: string | null;
  storeName: string | null;
  reason: string | null;
  changes: unknown;
};

type DetailResponse = {
  items: Item[];
  page: number;
  totalPages: number;
  total: number;
};

const formatChanges = (changes: unknown) =>
  changes && typeof changes === 'object'
    ? Object.entries(changes as Record<string, unknown>)
        .map(([field, value]) => {
          if (!value || typeof value !== 'object') return `${field}: ${String(value)}`;
          const change = value as Record<string, unknown>;
          if ('from' in change || 'to' in change)
            return `${field}: ${String(change.from ?? '—')} → ${String(change.to ?? '—')}`;
          if ('before' in change || 'after' in change)
            return `${field}: ${String(change.before ?? '—')} → ${String(change.after ?? '—')}`;
          return `${field}: ${JSON.stringify(value)}`;
        })
        .join('、')
    : null;

export function SmaregiSyncLogDetails({ syncLogId }: { syncLogId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/admin/integrations/smaregi/sync/${syncLogId}/items?page=${page}&limit=50`,
      );
      const payload = (await response.json()) as {
        data?: DetailResponse;
        error?: { detail?: string };
      };
      if (!response.ok || !payload.data)
        throw new Error(payload.error?.detail ?? '同期明細を取得できませんでした。');
      setData(payload.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : '同期明細を取得できませんでした。',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        className="text-xs text-[#6d2227] underline"
        disabled={loading}
        onClick={() => void load(data ? data.page : 1)}
      >
        {loading ? '明細を読み込み中…' : data ? '明細を更新' : '同期明細を見る'}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      {data ? (
        <div className="mt-3 divide-y border-y line text-xs">
          {data.items.map((item) => (
            <div className="grid gap-1 py-3 md:grid-cols-[140px_1fr]" key={item.id}>
              <span className="font-semibold text-[#6d2227]">{item.type}</span>
              <span>
                {[item.productCode, item.productName, item.smaregiProductId]
                  .filter(Boolean)
                  .join(' / ')}
                {item.storeName || item.storeId
                  ? ` ／ ${item.storeName ?? `Store ${item.storeId}`}`
                  : ''}
                {item.reason ? ` ／ ${item.reason}` : ''}
                {formatChanges(item.changes)
                  ? ` ／ ${formatChanges(item.changes)}`
                  : ''}
              </span>
            </div>
          ))}
          {data.items.length === 0 ? (
            <p className="py-3 text-stone-500">記録対象の変更はありません。</p>
          ) : null}
          {data.totalPages > 1 ? (
            <div className="flex items-center gap-3 py-3">
              <button
                type="button"
                className="underline disabled:text-stone-300"
                disabled={loading || data.page === 1}
                onClick={() => void load(data.page - 1)}
              >
                前へ
              </button>
              <span>{data.page} / {data.totalPages}</span>
              <button
                type="button"
                className="underline disabled:text-stone-300"
                disabled={loading || data.page === data.totalPages}
                onClick={() => void load(data.page + 1)}
              >
                次へ
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
