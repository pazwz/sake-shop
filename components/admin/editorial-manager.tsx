'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type EditorialItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  productCount: number;
};

type Feedback = { kind: 'success' | 'error'; text: string };

const errorDetail = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: { detail?: string } };
    return payload.error?.detail ?? fallback;
  } catch {
    return fallback;
  }
};

export function EditorialManager({
  items: initialItems,
  canEdit,
  maximum,
}: {
  items: EditorialItem[];
  canEdit: boolean;
  maximum: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const persistOrder = async (nextItems: EditorialItem[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(
        '/api/v1/admin/collections/editorial/order',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collectionIds: nextItems.map((item) => item.id),
          }),
        },
      );
      if (!response.ok) {
        setFeedback({
          kind: 'error',
          text: await errorDetail(response, '表示順を保存できませんでした。'),
        });
        return;
      }
      setItems(nextItems);
      setFeedback({ kind: 'success', text: '表示順を保存しました。' });
      router.refresh();
    } catch {
      setFeedback({
        kind: 'error',
        text: '通信エラーが発生しました。もう一度お試しください。',
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const nextItems = [...items];
    [nextItems[index], nextItems[target]] = [
      nextItems[target],
      nextItems[index],
    ];
    void persistOrder(nextItems);
  };

  const remove = async (id: string) => {
    if (busyRef.current || items.length <= 1) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/v1/admin/collections/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setFeedback({
          kind: 'error',
          text: await errorDetail(response, '特集記事を削除できませんでした。'),
        });
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmingId(null);
      setFeedback({ kind: 'success', text: '特集記事を削除しました。' });
      router.refresh();
    } catch {
      setFeedback({
        kind: 'error',
        text: '通信エラーが発生しました。もう一度お試しください。',
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="border line bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">EDITORIAL</p>
          <h2 className="serif mt-3 text-3xl">特集記事</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            トップページに表示する特集を1〜{maximum}件まで管理します。
          </p>
          <p className="mt-3 text-sm font-semibold text-[#6d2227]">
            現在表示中：{items.length}件
          </p>
        </div>
        {canEdit && items.length < maximum ? (
          <Link
            href="/admin/collections/new?type=EDITORIAL"
            className="btn btn-outline text-xs"
          >
            ＋ 特集記事を追加
          </Link>
        ) : null}
      </div>

      {feedback ? (
        <p
          className={`mt-5 border p-3 text-sm ${
            feedback.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-[#6d2227] bg-red-50 text-[#6d2227]'
          }`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="mt-6">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="grid items-center gap-5 border-t line py-5 sm:grid-cols-[112px_1fr_auto]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
              {item.imageUrl ? (
                <Image
                  fill
                  sizes="112px"
                  className="object-cover"
                  src={item.imageUrl}
                  alt=""
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[10px] text-stone-400">
                  画像なし
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-700">
                現在表示中 {index + 1}
              </span>
              <h3 className="serif mt-2 text-xl">{item.title}</h3>
              <p className="mt-2 text-xs text-stone-500">
                掲載商品 {item.productCount}件
              </p>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <button
                  type="button"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  className="border line px-3 py-2 text-xs disabled:opacity-30"
                  aria-label={`${item.title}を上へ移動`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  className="border line px-3 py-2 text-xs disabled:opacity-30"
                  aria-label={`${item.title}を下へ移動`}
                >
                  ↓
                </button>
                <Link
                  href={`/admin/collections/${item.id}`}
                  className="btn btn-outline text-xs"
                >
                  編集
                </Link>
                {items.length > 1 ? (
                  confirmingId === item.id ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span>削除しますか？</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(item.id)}
                        className="font-semibold text-[#6d2227] underline"
                      >
                        削除する
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                        className="text-stone-500 underline"
                      >
                        戻る
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingId(item.id)}
                      className="text-xs text-[#6d2227] underline"
                    >
                      削除
                    </button>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {items.length >= maximum ? (
        <p className="mt-3 text-xs text-stone-500">
          特集記事は最大{maximum}件まで表示できます。
        </p>
      ) : null}
    </section>
  );
}
