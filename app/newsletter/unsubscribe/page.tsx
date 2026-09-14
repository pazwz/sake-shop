'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function Form() {
  const token = useSearchParams().get('token') ?? '';
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      setMessage(
        response.ok
          ? 'メール配信を停止しました。'
          : (payload.error?.detail ?? '配信停止に失敗しました。'),
      );
    } catch {
      setMessage('通信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="wrap max-w-xl py-20">
      <p className="eyebrow">Newsletter</p>
      <h1 className="serif mt-4 text-4xl">メール配信停止</h1>
      <button
        className="btn mt-8"
        disabled={!token || submitting}
        onClick={submit}
      >
        {submitting ? '処理中…' : '配信を停止する'}
      </button>
      {message ? <p className="mt-5 text-sm">{message}</p> : null}
    </main>
  );
}

export default function NewsletterUnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <Form />
    </Suspense>
  );
}
