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

type RegisterErrors = {
  name?: string;
  email?: string;
  password?: string;
  form?: string;
};

export default function Register() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: RegisterErrors = {};
    if (!name.trim()) nextErrors.name = 'お名前を入力してください。';
    if (!email.trim()) nextErrors.email = 'メールアドレスを入力してください。';
    else if (!isValidEmail(email))
      nextErrors.email = 'メールアドレスの形式が正しくありません。';
    if (!password) nextErrors.password = 'パスワードを入力してください。';
    else if (password.length < 8)
      nextErrors.password = 'パスワードは8文字以上で入力してください。';
    const firstField = (['name', 'email', 'password'] as const).find(
      (field) => nextErrors[field],
    );
    if (firstField) {
      setErrors(nextErrors);
      if (formRef.current) focusFormField(formRef.current, firstField);
      return;
    }

    const result = register(name.trim(), email.trim(), password);
    if (!result.ok) {
      setErrors({ form: result.message || '会員登録に失敗しました。' });
      return;
    }
    router.push(params.get('redirect') || '/mypage');
  };

  const fieldClass = (message?: string) =>
    `input mt-2 ${message ? invalidFieldClass : ''}`;

  return (
    <div className="wrap max-w-xl py-16 md:py-24">
      <p className="eyebrow">Become a member</p>
      <h1 className="serif mt-4 text-5xl">会員登録</h1>
      <p className="mt-6 text-sm leading-7 text-stone-600">
        LINXASの会員になると、ご注文履歴と配送状況をいつでもご確認いただけます。
      </p>
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        className="mt-10 space-y-6"
      >
        <label className="block text-xs">
          お名前
          <input
            required
            name="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'register-name-error' : undefined}
            className={fieldClass(errors.name)}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
          />
          <FormFieldError id="register-name-error" message={errors.name} />
        </label>
        <label className="block text-xs">
          メールアドレス
          <input
            required
            type="email"
            name="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            className={fieldClass(errors.email)}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
          />
          <FormFieldError id="register-email-error" message={errors.email} />
        </label>
        <label className="block text-xs">
          パスワード（8文字以上）
          <input
            required
            minLength={8}
            type="password"
            name="password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'register-password-error' : undefined
            }
            className={fieldClass(errors.password)}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />
          <FormFieldError
            id="register-password-error"
            message={errors.password}
          />
        </label>
        <FormFieldError id="register-form-error" message={errors.form} />
        <button className="btn w-full">会員登録する</button>
      </form>
      <p className="mt-8 text-xs text-stone-500">
        これはデモサイトです。登録情報はこのブラウザ内だけに保存されます。
      </p>
      <p className="mt-5 text-sm">
        すでに会員の方は{' '}
        <Link href="/login" className="underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
