'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { FormFieldError } from '@/components/form-field-error';
import {
  focusFormField,
  invalidFieldClass,
  isValidEmail,
} from '@/lib/form-validation';

type LoginErrors = { email?: string; password?: string; form?: string };

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: LoginErrors = {};
    if (!email.trim()) nextErrors.email = 'メールアドレスを入力してください。';
    else if (!isValidEmail(email))
      nextErrors.email = 'メールアドレスの形式が正しくありません。';
    if (!password) nextErrors.password = 'パスワードを入力してください。';
    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      const firstField = nextErrors.email ? 'email' : 'password';
      if (formRef.current) focusFormField(formRef.current, firstField);
      return;
    }

    const result = login(email.trim(), password);
    if (!result.ok) {
      setErrors({
        form: 'メールアドレスまたはパスワードが正しくありません。',
      });
      return;
    }
    router.push(params.get('redirect') || '/mypage');
  };

  return (
    <div className="wrap max-w-xl py-16 md:py-24">
      <p className="eyebrow">Member login</p>
      <h1 className="serif mt-4 text-5xl">ログイン</h1>
      <p className="mt-6 text-sm leading-7 text-stone-600">
        ご注文履歴や配送状況は、マイページからご確認いただけます。
      </p>
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        className="mt-10 space-y-6"
      >
        <label className="block text-xs">
          メールアドレス
          <input
            required
            type="email"
            name="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            className={`input mt-2 ${errors.email ? invalidFieldClass : ''}`}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
          />
          <FormFieldError id="login-email-error" message={errors.email} />
        </label>
        <label className="block text-xs">
          パスワード
          <input
            required
            type="password"
            name="password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'login-password-error' : undefined
            }
            className={`input mt-2 ${errors.password ? invalidFieldClass : ''}`}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />
          <FormFieldError id="login-password-error" message={errors.password} />
        </label>
        <FormFieldError id="login-form-error" message={errors.form} />
        <button className="btn w-full">ログインする</button>
      </form>
      <div className="mt-10 border-t line pt-7">
        <p className="text-sm">会員登録がお済みでない方</p>
        <Link
          href={`/register${params.get('redirect') ? `?redirect=${params.get('redirect')}` : ''}`}
          className="btn btn-outline mt-4"
        >
          新規会員登録
        </Link>
      </div>
    </div>
  );
}
