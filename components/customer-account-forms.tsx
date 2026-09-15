'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';

const readError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  return payload?.error?.detail ?? fallback;
};

export function CustomerProfileForm({
  name: initialName,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  return (
    <form
      className="mt-10 max-w-xl space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setWorking(true);
        setStatus('');
        try {
          const response = await fetch('/api/v1/customer/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          if (!response.ok) {
            setStatus(
              await readError(response, '会員情報を更新できませんでした。'),
            );
            return;
          }
          setStatus('会員情報を更新しました。');
          await refresh();
          router.refresh();
        } catch {
          setStatus('通信に失敗しました。もう一度お試しください。');
        } finally {
          setWorking(false);
        }
      }}
    >
      <label className="block text-xs">
        お名前
        <input
          required
          maxLength={100}
          className="input mt-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block text-xs">
        メールアドレス
        <input className="input mt-2 bg-stone-50" value={email} readOnly />
        <span className="mt-2 block text-stone-500">
          メールアドレスの変更は現在受け付けていません。
        </span>
      </label>
      <button className="btn" disabled={working || !name.trim()}>
        {working ? '保存中…' : '保存する'}
      </button>
      {status ? <p className="text-sm leading-7">{status}</p> : null}
    </form>
  );
}

export function CustomerPasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const valid =
    currentPassword.length > 0 &&
    newPassword.length >= 10 &&
    newPassword === newPasswordConfirmation;
  return (
    <form
      className="mt-10 max-w-xl space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid) return;
        setWorking(true);
        setStatus('');
        try {
          const response = await fetch('/api/v1/customer/password', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentPassword,
              newPassword,
              newPasswordConfirmation,
            }),
          });
          if (!response.ok) {
            setStatus(
              await readError(response, 'パスワードを変更できませんでした。'),
            );
            return;
          }
          setCurrentPassword('');
          setNewPassword('');
          setNewPasswordConfirmation('');
          setStatus(
            'パスワードを変更しました。この端末では引き続きログインできます。',
          );
          router.refresh();
        } catch {
          setStatus('通信に失敗しました。もう一度お試しください。');
        } finally {
          setWorking(false);
        }
      }}
    >
      {[
        ['現在のパスワード', currentPassword, setCurrentPassword],
        ['新しいパスワード（10文字以上）', newPassword, setNewPassword],
        [
          '新しいパスワード（確認）',
          newPasswordConfirmation,
          setNewPasswordConfirmation,
        ],
      ].map(([label, value, setter]) => (
        <label key={label as string} className="block text-xs">
          {label as string}
          <input
            required
            type="password"
            minLength={label === '現在のパスワード' ? 1 : 10}
            className="input mt-2"
            value={value as string}
            onChange={(event) =>
              (setter as React.Dispatch<React.SetStateAction<string>>)(
                event.target.value,
              )
            }
          />
        </label>
      ))}
      {newPasswordConfirmation && newPassword !== newPasswordConfirmation ? (
        <p className="text-sm text-red-700">パスワードが一致しません。</p>
      ) : null}
      <button className="btn" disabled={working || !valid}>
        {working ? '変更中…' : 'パスワードを変更'}
      </button>
      {status ? <p className="text-sm leading-7">{status}</p> : null}
    </form>
  );
}

export function CustomerNewsletterPreference({
  initialSubscribed,
}: {
  initialSubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const update = async (next: boolean) => {
    setWorking(true);
    setStatus('');
    try {
      const response = await fetch('/api/v1/customer/preferences/newsletter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: next }),
      });
      if (!response.ok) {
        setStatus(
          await readError(response, 'メール配信設定を更新できませんでした。'),
        );
        return;
      }
      setSubscribed(next);
      setStatus(
        next
          ? 'メールマガジンを購読しました。'
          : 'メールマガジンを配信停止しました。',
      );
    } catch {
      setStatus('通信に失敗しました。もう一度お試しください。');
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="mt-10 max-w-xl border-y line py-8">
      <p className="text-xs text-stone-500">メールマガジン</p>
      <p className="serif mt-3 text-2xl">
        現在：{subscribed ? '購読中' : '配信停止中'}
      </p>
      <p className="mt-4 text-sm leading-7 text-stone-600">
        配信停止後も、本人確認・パスワード再設定・ご注文に関する重要なメールは届きます。
      </p>
      <button
        type="button"
        className="btn mt-6"
        disabled={working}
        onClick={() => update(!subscribed)}
      >
        {working ? '更新中…' : subscribed ? '配信停止' : '購読する'}
      </button>
      {status ? <p className="mt-4 text-sm leading-7">{status}</p> : null}
    </div>
  );
}

export type AddressFormValue = {
  id?: string;
  recipientName: string;
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string | null;
  phone: string;
  isDefault: boolean;
};

const EMPTY_ADDRESS: AddressFormValue = {
  recipientName: '',
  postalCode: '',
  prefecture: '福岡県',
  city: '',
  addressLine1: '',
  addressLine2: '',
  phone: '',
  isDefault: false,
};

export function CustomerAddressForm({
  initial,
}: {
  initial?: AddressFormValue;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? EMPTY_ADDRESS);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const set = (field: keyof AddressFormValue, fieldValue: string | boolean) =>
    setValue((current) => ({ ...current, [field]: fieldValue }));
  return (
    <form
      className="mt-10 grid max-w-2xl gap-6 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setWorking(true);
        setStatus('');
        try {
          const response = await fetch(
            initial?.id
              ? `/api/v1/customer/addresses/${encodeURIComponent(initial.id)}`
              : '/api/v1/customer/addresses',
            {
              method: initial?.id ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recipientName: value.recipientName,
                postalCode: value.postalCode,
                prefecture: value.prefecture,
                city: value.city,
                addressLine1: value.addressLine1,
                addressLine2: value.addressLine2 || undefined,
                phone: value.phone,
                isDefault: value.isDefault,
              }),
            },
          );
          if (!response.ok) {
            setStatus(
              await readError(response, 'お届け先を保存できませんでした。'),
            );
            return;
          }
          router.push('/account/addresses');
          router.refresh();
        } catch {
          setStatus('通信に失敗しました。もう一度お試しください。');
        } finally {
          setWorking(false);
        }
      }}
    >
      {[
        ['recipientName', '氏名'],
        ['postalCode', '郵便番号'],
        ['prefecture', '都道府県'],
        ['city', '市区町村'],
        ['addressLine1', '町名・番地'],
        ['addressLine2', '建物名（任意）'],
        ['phone', '電話番号'],
      ].map(([field, label]) => (
        <label
          key={field}
          className={`block text-xs ${field === 'addressLine1' || field === 'addressLine2' ? 'sm:col-span-2' : ''}`}
        >
          {label}
          <input
            required={field !== 'addressLine2'}
            className="input mt-2"
            value={String(value[field as keyof AddressFormValue] ?? '')}
            onChange={(event) =>
              set(field as keyof AddressFormValue, event.target.value)
            }
          />
        </label>
      ))}
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={value.isDefault}
          onChange={(event) => set('isDefault', event.target.checked)}
        />
        デフォルトのお届け先にする
      </label>
      <div className="sm:col-span-2">
        <button className="btn" disabled={working}>
          {working ? '保存中…' : '保存する'}
        </button>
        {status ? <p className="mt-4 text-sm text-red-700">{status}</p> : null}
      </div>
    </form>
  );
}

export function CustomerAddressDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <button
        type="button"
        className="text-xs underline disabled:opacity-60"
        disabled={working}
        onClick={async () => {
          setWorking(true);
          setError('');
          try {
            const response = await fetch(
              `/api/v1/customer/addresses/${encodeURIComponent(id)}`,
              { method: 'DELETE' },
            );
            if (!response.ok) {
              setError(await readError(response, '削除できませんでした。'));
              return;
            }
            router.refresh();
          } catch {
            setError('通信に失敗しました。');
          } finally {
            setWorking(false);
          }
        }}
      >
        {working ? '削除中…' : '削除'}
      </button>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
