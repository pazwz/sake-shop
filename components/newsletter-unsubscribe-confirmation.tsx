'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export type NewsletterUnsubscribeState =
  | 'confirm'
  | 'already'
  | 'invalid'
  | 'unavailable';

export function NewsletterUnsubscribeConfirmation({
  initialState,
  token,
}: {
  initialState: NewsletterUnsubscribeState;
  token: string;
}) {
  const [state, setState] = useState<NewsletterUnsubscribeState | 'success'>(
    initialState,
  );
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <>
      <p role="status" aria-live="polite" className="mt-6 text-sm leading-7">
        {state === 'confirm'
          ? '配信停止をご希望の場合は、下のボタンでお手続きください。'
          : state === 'success'
            ? 'メールマガジンの配信を停止しました'
            : state === 'already'
              ? 'すでに配信停止手続きが完了しています'
              : state === 'invalid'
                ? 'このリンクは無効、または有効期限が切れています'
                : '現在、配信設定を確認できません。時間をおいてもう一度お試しください。'}
      </p>
      {state === 'confirm' ? (
        <button
          type="button"
          className="btn mt-8"
          disabled={working}
          onClick={async () => {
            if (working) return;
            setWorking(true);
            setStatus('');
            try {
              const response = await fetch('/api/v1/newsletter/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
              });
              if (!response.ok) {
                if (response.status === 400 || response.status === 401)
                  setState('invalid');
                else
                  setStatus(
                    '配信停止できませんでした。時間をおいてもう一度お試しください。',
                  );
                return;
              }
              setState('success');
            } catch {
              setStatus('通信に失敗しました。もう一度お試しください。');
            } finally {
              setWorking(false);
            }
          }}
        >
          {working ? '処理中…' : '配信停止する'}
        </button>
      ) : null}
      <p role="status" aria-live="polite" className="mt-4 text-sm leading-7">
        {status}
      </p>
      <p className="mt-8 text-xs leading-6 text-stone-500">
        配信停止後も、本人確認・パスワード再設定・ご注文に関する重要なメールは届きます。
      </p>
      <div className="mt-8 flex gap-6 text-xs">
        <Link href="/" className="underline underline-offset-4">
          トップページへ戻る
        </Link>
        <Link href="/contact" className="underline underline-offset-4">
          お問い合わせ
        </Link>
      </div>
    </>
  );
}
