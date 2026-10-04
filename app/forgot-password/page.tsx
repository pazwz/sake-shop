'use client';

import { useRef, useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const submissionLocked = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionLocked.current) return;
    submissionLocked.current = true;
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/v1/customer/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error('Password reset request failed.');
      setSent(true);
      setMessage('再設定メールを送信しました。メールをご確認ください。');
    } catch {
      submissionLocked.current = false;
      setMessage(
        '送信に失敗しました。しばらくしてからもう一度お試しください。',
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="wrap max-w-xl py-20">
      <p className="eyebrow">Account security</p>
      <h1 className="serif mt-4 text-4xl">パスワードをお忘れの方</h1>
      <form onSubmit={submit} aria-busy={submitting} className="mt-8 space-y-4">
        <input
          required
          type="email"
          aria-label="メールアドレス"
          autoComplete="email"
          disabled={submitting || sent}
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          disabled={submitting || sent}
          className="btn flex w-full items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting ? (
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 animate-spin rounded-full border border-current border-r-transparent motion-reduce:animate-none"
            />
          ) : null}
          {submitting ? '送信中…' : '再設定メールを送信'}
        </button>
      </form>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-5 text-sm leading-7"
      >
        {message}
      </p>
    </main>
  );
}
