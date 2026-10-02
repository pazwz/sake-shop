'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function NewsletterSubscriptionForm() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [completed, setCompleted] = useState(false);

  return (
    <form
      className="mt-10 space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!consent || working || completed) return;
        setWorking(true);
        setStatus('');
        try {
          const response = await fetch('/api/v1/newsletter/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, consent: true }),
          });
          if (!response.ok) {
            setStatus(
              '登録できませんでした。入力内容を確認して、もう一度お試しください。',
            );
            return;
          }
          setCompleted(true);
          setStatus('メールマガジンの登録を受け付けました。');
        } catch {
          setStatus('通信に失敗しました。もう一度お試しください。');
        } finally {
          setWorking(false);
        }
      }}
    >
      <label className="block text-xs">
        メールアドレス
        <input
          className="input mt-2"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          disabled={working || completed}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="flex items-start gap-3 text-sm leading-7">
        <input
          className="mt-2"
          type="checkbox"
          required
          checked={consent}
          disabled={working || completed}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>メールマガジンの配信に同意します。</span>
      </label>
      <p className="text-xs leading-6 text-stone-500">
        個人情報の取り扱いは
        <Link href="/privacy" className="underline underline-offset-4">
          プライバシーポリシー
        </Link>
        をご確認ください。配信メールからいつでも配信を停止できます。
      </p>
      <button
        className="btn"
        disabled={!consent || !email.trim() || working || completed}
      >
        {working ? '登録中…' : completed ? '登録受付済み' : '登録する'}
      </button>
      <p role="status" aria-live="polite" className="text-sm leading-7">
        {status}
      </p>
    </form>
  );
}
