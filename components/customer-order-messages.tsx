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

export const getCustomerMessageSenderName = (
  customerDisplayName: string | null | undefined,
) => {
  const name = customerDisplayName?.trim();
  return name ? `${name}様` : 'お客様';
};

export function CustomerOrderMessages({
  orderId,
  thread,
  customerDisplayName,
}: {
  orderId: string;
  thread: Thread | null;
  customerDisplayName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const customerSenderName = getCustomerMessageSenderName(customerDisplayName);
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
    <section className="mt-10 max-w-4xl border line bg-white p-5 md:p-7">
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
                    ? 'max-w-[88%] rounded-[14px] border border-[#ded8cf] border-l-2 border-l-[#9a696b] bg-[#fffdf9] px-5 py-4 md:max-w-[68%]'
                    : 'max-w-[88%] rounded-[14px] border border-[#e3ded6] bg-[#f4f1ec] px-5 py-4 text-[#1a1a1a] md:max-w-[68%]'
                }
              >
                <p
                  className={
                    message.direction === 'ADMIN'
                      ? 'text-xs font-semibold text-[#6d2227]'
                      : 'text-xs font-semibold text-stone-700'
                  }
                >
                  {message.direction === 'ADMIN'
                    ? 'カスタマーセンター'
                    : customerSenderName}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                  {message.body}
                </p>
                <time className="mt-2 block text-xs text-stone-500">
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
      <label className="mt-8 block border-t line pt-6 text-sm">
        メッセージ入力
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={5000}
          className="mt-3 min-h-28 w-full resize-y border border-[#ded8cf] bg-[#fffdf9] p-4 text-sm leading-7 outline-none transition focus:border-[#6d2227]"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={submit}
        className="btn btn-outline mt-4"
      >
        {busy ? '送信中...' : '送信する'}
      </button>
    </section>
  );
}
