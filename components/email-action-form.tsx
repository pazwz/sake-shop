'use client';

import { useState } from 'react';

export function EmailActionForm({
  action,
  token,
}: {
  action: 'verify' | 'reset';
  token: string;
}) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(
        action === 'verify'
          ? '/api/v1/customer/verify-email'
          : '/api/v1/customer/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            ...(action === 'reset' ? { password } : {}),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.detail ?? '処理に失敗しました。');
        return;
      }
      setMessage(
        action === 'verify'
          ? 'メールアドレスを確認しました。'
          : 'パスワードを変更しました。新しいパスワードでログインしてください。',
      );
    } catch {
      setError('通信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="mt-8 space-y-4">
      {action === 'reset' ? (
        <input
          className="input"
          type="password"
          minLength={10}
          placeholder="新しいパスワード（10文字以上）"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      ) : null}
      <button
        className="btn"
        onClick={submit}
        disabled={submitting || (action === 'reset' && password.length < 10)}
      >
        {submitting
          ? '処理中…'
          : action === 'verify'
            ? 'メールアドレスを確認'
            : 'パスワードを再設定'}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
