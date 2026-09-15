'use client';

import { useState } from 'react';

type Exclusion = {
  id: string;
  smaregiProductId: string;
  productCode: string | null;
  productNameSnapshot: string | null;
  reason: string;
  createdAt: string;
};

export function SmaregiProductExclusionsPanel({
  initialItems,
}: {
  initialItems: Exclusion[];
}) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const revoke = async (item: Exclusion) => {
    if (busyId || !window.confirm('EC販売対象外を解除しますか？ 次回同期から通常の同期対象になります。'))
      return;
    setBusyId(item.id);
    setMessage(null);
    try {
      const response = await fetch(
        '/api/v1/admin/integrations/smaregi/exclusions',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smaregiProductId: item.smaregiProductId }),
        },
      );
      const payload = (await response.json()) as { error?: { detail?: string } };
      if (!response.ok)
        throw new Error(payload.error?.detail ?? 'EC販売対象外を解除できませんでした。');
      setItems((current) => current.filter(({ id }) => id !== item.id));
      setMessage('EC販売対象外を解除しました。次回同期から通常の同期対象になります。');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'EC販売対象外を解除できませんでした。',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-12 border-y line py-7">
      <p className="eyebrow">EC CHANNEL EXCLUSIONS</p>
      <h2 className="serif mt-2 text-2xl">EC販売対象外</h2>
      <p className="mt-2 text-sm text-stone-600">
        スマレジには残し、LINXAS ECの同期対象から恒久的に除外した商品です。
      </p>
      {message ? <p className="mt-3 text-xs text-stone-600">{message}</p> : null}
      <div className="mt-5 divide-y border-y line text-sm">
        {items.map((item) => (
          <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={item.id}>
            <span>
              {[item.productCode, item.productNameSnapshot, `Smaregi ID ${item.smaregiProductId}`]
                .filter(Boolean)
                .join(' / ')}
            </span>
            <button
              type="button"
              className="text-xs text-[#6d2227] underline disabled:opacity-50"
              disabled={busyId !== null}
              onClick={() => void revoke(item)}
            >
              {busyId === item.id ? '解除中…' : 'EC販売対象外を解除'}
            </button>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">現在、除外中の商品はありません。</p>
        ) : null}
      </div>
    </section>
  );
}
