'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
        <div className="mt-6 space-y-4" aria-label="メッセージ履歴">
          {thread.messages.map((message) => (
            <article
              key={message.id}
              className={
                message.direction === 'ADMIN'
                  ? 'border-l-2 border-[#6f1831] pl-4'
                  : 'border-l-2 border-stone-300 pl-4'
              }
            >
              <p className="text-xs font-medium text-[#6f1831]">
                {message.direction === 'ADMIN'
                  ? `LINXAS${message.authorAdmin ? ` / ${message.authorAdmin.name}` : ''}`
                  : 'お客様'}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                {message.body}
              </p>
              <time className="mt-2 block text-xs text-stone-500">
                {new Date(message.createdAt).toLocaleString('ja-JP')}
              </time>
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
