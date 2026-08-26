'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { FormFieldError } from '@/components/form-field-error';
import { focusFormField, invalidFieldClass } from '@/lib/form-validation';

type LoginErrors = { username?: string; password?: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username') ?? '');
    const password = String(formData.get('password') ?? '');
    const nextErrors: LoginErrors = {};
    if (!username.trim())
      nextErrors.username = 'ログインIDを入力してください。';
    if (!password) nextErrors.password = 'パスワードを入力してください。';
    if (nextErrors.username || nextErrors.password) {
      setErrors(nextErrors);
      const firstField = nextErrors.username ? 'username' : 'password';
      if (formRef.current) focusFormField(formRef.current, firstField);
      return;
    }
    setSubmitting(true);
    setMessage('');
    setErrors({});
    try {
      const response = await fetch('/api/v1/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        setMessage('ログインIDまたはパスワードが正しくありません。');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setMessage('通信に失敗しました。時間をおいてもう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="wrap flex min-h-[70vh] items-center justify-center py-16">
      <form
        ref={formRef}
        noValidate
        onSubmit={login}
        className="w-full max-w-md border line bg-white p-8"
      >
        <p className="flex items-center gap-2 text-xs tracking-[.18em] text-[#6d2227]">
          <BrandLogo variant="admin" /> ADMIN
        </p>
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
          ログインID
          <input
            required
            type="text"
            name="username"
            autoComplete="username"
            placeholder="admin_linxas"
            aria-invalid={Boolean(errors.username)}
            aria-describedby={
              errors.username ? 'admin-username-error' : undefined
            }
            className={`mt-2 w-full border line p-3 ${errors.username ? invalidFieldClass : ''}`}
            onChange={() =>
              setErrors((current) => ({ ...current, username: undefined }))
            }
          />
          <FormFieldError
            id="admin-username-error"
            message={errors.username}
          />
        </label>
        <label className="mt-5 block text-sm">
          パスワード
          <input
            required
            type="password"
            name="password"
            autoComplete="current-password"
            minLength={8}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'admin-password-error' : undefined
            }
            className={`mt-2 w-full border line p-3 ${errors.password ? invalidFieldClass : ''}`}
            onChange={() =>
              setErrors((current) => ({ ...current, password: undefined }))
            }
          />
          <FormFieldError id="admin-password-error" message={errors.password} />
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
