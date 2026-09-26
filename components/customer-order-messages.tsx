'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Thread = {
  id: string;
  status: string;
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    createdAt: Date | string;
    authorAdmin: { name: string } | null;
  }>;
};

export function CustomerOrderMessages({
  orderId,
  thread,
}: {
  orderId: string;
  thread: Thread | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!thread) return;
    void fetch(`/api/v1/my/inquiries/${thread.id}/read`, { method: 'POST' });
  }, [thread]);
  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        thread
          ? `/api/v1/my/inquiries/${thread.id}/messages`
          : `/api/v1/my/orders/${orderId}/inquiries`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(thread ? { body } : { message: body }),
        },
      );
      if (!response.ok)
        throw new Error(
          '送信できませんでした。時間をおいて再度お試しください。',
        );
      setBody('');
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '送信できませんでした。',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-10 border line bg-white p-5 md:p-7">
      <h2 className="serif text-2xl">この注文について問い合わせる</h2>
      {thread ? (
        <div className="mt-6 space-y-5" aria-label="メッセージ履歴">
          {thread.messages.map((message) => (
            <article
              key={message.id}
              data-message-direction={message.direction}
              className={
                message.direction === 'ADMIN'
                  ? 'flex justify-start'
                  : 'flex justify-end'
              }
            >
              <div
                className={
                  message.direction === 'ADMIN'
                    ? 'max-w-[88%] border border-stone-200 bg-[#fffdf9] px-4 py-3 md:max-w-[72%]'
                    : 'max-w-[88%] bg-[#6d2227] px-4 py-3 text-white md:max-w-[72%]'
                }
              >
                <p
                  className={
                    message.direction === 'ADMIN'
                      ? 'text-xs font-semibold text-[#6d2227]'
                      : 'text-xs font-semibold text-white/85'
                  }
                >
                  {message.direction === 'ADMIN' ? 'カスタマーセンター' : 'お客様'}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                  {message.body}
                </p>
                <time
                  className={
                    message.direction === 'ADMIN'
                      ? 'mt-2 block text-xs text-stone-500'
                      : 'mt-2 block text-xs text-white/70'
                  }
                >
                  {new Date(message.createdAt).toLocaleString('ja-JP')}
                </time>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-stone-600">
          ご注文に関するご質問やご相談をお送りください。回答はこのページでご確認いただけます。
        </p>
      )}
      <label className="mt-6 block text-sm">
        メッセージ入力
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={5000}
          className="mt-2 min-h-32 w-full border line p-3"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={submit}
        className="btn mt-4 bg-[#171412] text-white"
      >
        {busy ? '送信中...' : '送信する'}
      </button>
    </section>
  );
}
