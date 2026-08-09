'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = async (formData: FormData) => {
    setSubmitting(true);
    setMessage('');
    const response = await fetch('/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });
    if (!response.ok) {
      setMessage('メールアドレスまたはパスワードが正しくありません。');
      setSubmitting(false);
      return;
    }
    router.push('/admin');
    router.refresh();
  };
  return (
    <main className="wrap flex min-h-[70vh] items-center justify-center py-16">
      <form action={login} className="w-full max-w-md border line bg-white p-8">
        <p className="eyebrow">KURA ADMIN</p>
        <h1 className="serif mt-4 text-4xl">管理者ログイン</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          許可された管理者のみがコンテンツを管理できます。
        </p>
        {message ? (
          <p className="mt-5 border border-[#6d2227] p-3 text-sm text-[#6d2227]">
            {message}
          </p>
        ) : null}
        <label className="mt-7 block text-sm">
          メールアドレス
          <input
            required
            type="email"
            name="email"
            className="mt-2 w-full border line p-3"
          />
        </label>
        <label className="mt-5 block text-sm">
          パスワード
          <input
            required
            type="password"
            name="password"
            minLength={8}
            className="mt-2 w-full border line p-3"
          />
        </label>
        <button
          disabled={submitting}
          className="btn mt-7 w-full bg-[#171412] text-white disabled:opacity-50"
        >
          {submitting ? '確認中…' : 'ログイン'}
        </button>
      </form>
    </main>
  );
}
