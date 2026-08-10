'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SmaregiSyncActions() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const synchronize = async (target: 'products' | 'inventory') => {
    setRunning(target);
    setMessage(null);
    const response = await fetch(`/api/v1/system/sync/${target}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'FULL' }),
    });
    const payload = (await response.json()) as {
      success: boolean;
      error: { detail: string } | null;
    };
    setMessage(
      payload.success
        ? `${target} sync completed.`
        : (payload.error?.detail ?? `${target} sync failed.`),
    );
    setRunning(null);
    router.refresh();
  };

  return (
    <div className="mt-8">
      <div className="flex gap-3">
        <button
          className="btn bg-[#171412] text-white disabled:opacity-50"
          type="button"
          disabled={running !== null}
          onClick={() => void synchronize('products')}
        >
          Sync Products
        </button>
        <button
          className="btn border border-[#171412] disabled:opacity-50"
          type="button"
          disabled={running !== null}
          onClick={() => void synchronize('inventory')}
        >
          Sync Inventory
        </button>
      </div>
      {message ? (
        <p className="mt-4 text-sm text-stone-600">{message}</p>
      ) : null}
    </div>
  );
}
