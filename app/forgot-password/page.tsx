'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/customer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      setMessage(
        payload.data?.message ??
          payload.error?.detail ??
          'ご登録のメールアドレスであれば、再設定メールを送信します。',
      );
    } catch {
      setMessage('通信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="wrap max-w-xl py-20">
      <p className="eyebrow">Account security</p>
      <h1 className="serif mt-4 text-4xl">パスワードをお忘れの方</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input
          required
          type="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          disabled={submitting}
          className="btn w-full disabled:opacity-60"
        >
          {submitting ? '送信中…' : '再設定メールを送信'}
        </button>
      </form>
      {message ? <p className="mt-5 text-sm leading-7">{message}</p> : null}
    </main>
  );
}
