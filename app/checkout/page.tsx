'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/cart-provider';
import { useAuth } from '@/components/auth-provider';
import { formatPrice } from '@/lib/products';
import { FormFieldError } from '@/components/form-field-error';
import {
  focusFormField,
  invalidFieldClass,
  isValidEmail,
} from '@/lib/form-validation';

const fields = [
  ['name', '氏名'],
  ['postalCode', '郵便番号'],
  ['prefecture', '都道府県'],
  ['city', '市区町村'],
  ['addressLine1', '番地・建物名'],
  ['phone', '電話番号'],
  ['email', 'メールアドレス'],
] as const;

type FieldName = (typeof fields)[number][0];
type CheckoutErrors = Partial<Record<FieldName | 'age', string>>;

export default function Checkout() {
  const { items, clear } = useCart();
  const { member, ready } = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [age, setAge] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypay'>('card');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine1: '',
    phone: '',
    email: '',
  });

  if (!ready || !member)
    return <div className="wrap py-20">ログイン後にご注文いただけます。</div>;
  if (!items.length)
    return <div className="wrap py-20">バッグに商品がありません。</div>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: CheckoutErrors = {};
    fields.forEach(([key, label]) => {
      if (!form[key].trim()) nextErrors[key] = `${label}を入力してください。`;
    });
    if (form.email.trim() && !isValidEmail(form.email)) {
      nextErrors.email = 'メールアドレスの形式が正しくありません。';
    }
    if (!age) nextErrors.age = '年齢確認に同意してください。';
    const firstField =
      fields.find(([key]) => nextErrors[key])?.[0] ??
      (nextErrors.age ? 'age' : null);
    if (firstField) {
      setFieldErrors(nextErrors);
      if (formRef.current) focusFormField(formRef.current, firstField);
      return;
    }
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const orderResponse = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(({ product, quantity }) => ({
            productId: String(product.id),
            quantity,
          })),
          customer: { email: form.email, name: form.name, phone: form.phone },
          address: {
            postalCode: form.postalCode,
            prefecture: form.prefecture,
            city: form.city,
            addressLine1: form.addressLine1,
            recipientName: form.name,
            phone: form.phone,
          },
          ageConfirmed: age,
          shippingMethod: 'development-standard',
          paymentMethod,
        }),
      });
      const orderPayload = await orderResponse.json();
      if (!orderResponse.ok)
        throw new Error(
          orderPayload.error?.detail ?? '注文を作成できませんでした。',
        );

      const provider = paymentMethod === 'card' ? 'STERA' : 'PAYPAY';
      const paymentResponse = await fetch('/api/v1/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderPayload.data.id,
          provider,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const paymentPayload = await paymentResponse.json();
      if (!paymentResponse.ok)
        throw new Error(
          paymentPayload.error?.detail ?? '決済を開始できませんでした。',
        );

      const webhookResponse = await fetch('/api/v1/payments/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-payment-signature': 'mock-development-signature',
        },
        body: JSON.stringify({
          provider,
          providerPaymentId: paymentPayload.data.providerPaymentId,
          eventId: crypto.randomUUID(),
          status: 'SUCCEEDED',
        }),
      });
      const webhookPayload = await webhookResponse.json();
      if (!webhookResponse.ok)
        throw new Error(
          webhookPayload.error?.detail ?? 'デモ決済を完了できませんでした。',
        );
      clear();
      router.push(`/orders/${orderPayload.data.orderNumber}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof TypeError
          ? '通信に失敗しました。時間をおいてもう一度お試しください。'
          : submissionError instanceof Error
            ? submissionError.message
            : '注文を処理できませんでした。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="wrap py-16">
      <p className="eyebrow">CHECKOUT</p>
      <h1 className="serif mt-4 text-5xl">お届け先</h1>
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_.7fr]"
      >
        <div className="space-y-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map(([key, label]) => (
              <label
                key={key}
                className={
                  key === 'addressLine1' || key === 'email'
                    ? 'sm:col-span-2'
                    : ''
                }
              >
                <span className="text-xs">{label}</span>
                <input
                  required
                  name={key}
                  type={
                    key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'
                  }
                  aria-invalid={Boolean(fieldErrors[key])}
                  aria-describedby={
                    fieldErrors[key] ? `checkout-${key}-error` : undefined
                  }
                  className={`input mt-2 ${fieldErrors[key] ? invalidFieldClass : ''}`}
                  value={form[key]}
                  onChange={(event) => {
                    setForm({ ...form, [key]: event.target.value });
                    setFieldErrors((current) => ({
                      ...current,
                      [key]: undefined,
                    }));
                  }}
                />
                <FormFieldError
                  id={`checkout-${key}-error`}
                  message={fieldErrors[key]}
                />
              </label>
            ))}
          </div>
          <section className="border-t line pt-8">
            <h2 className="serif text-2xl">お支払い方法</h2>
            <div className="mt-5 grid gap-3">
              <label className="border p-5">
                <input
                  type="radio"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />{' '}
                <span className="ml-2 text-sm">
                  クレジットカード（開発用デモ）
                </span>
              </label>
              <label className="border p-5">
                <input
                  type="radio"
                  checked={paymentMethod === 'paypay'}
                  onChange={() => setPaymentMethod('paypay')}
                />{' '}
                <span className="ml-2 text-sm">PayPay（開発用デモ）</span>
              </label>
            </div>
          </section>
          <label className="flex gap-3 border-t line pt-8 text-sm">
            <input
              type="checkbox"
              name="age"
              checked={age}
              aria-invalid={Boolean(fieldErrors.age)}
              aria-describedby={
                fieldErrors.age ? 'checkout-age-error' : undefined
              }
              onChange={(event) => {
                setAge(event.target.checked);
                setFieldErrors((current) => ({ ...current, age: undefined }));
              }}
            />
            <span>
              私は20歳以上です。
              <FormFieldError
                id="checkout-age-error"
                message={fieldErrors.age}
              />
            </span>
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            disabled={submitting}
            className="btn disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {submitting ? '処理中…' : '注文とデモ決済を確定する'}
          </button>
        </div>
        <aside className="h-fit bg-[#e8e1d5] p-7">
          <p className="serif text-xl">ご注文内容</p>
          {items.map((line) => (
            <p
              className="mt-4 flex justify-between text-sm"
              key={line.product.id}
            >
              <span>
                {line.product.name} × {line.quantity}
              </span>
              <span>{formatPrice(line.product.price * line.quantity)}</span>
            </p>
          ))}
          <p className="mt-6 text-xs text-stone-600">
            決済は開発用 Mock Adapter
            を使用します。カード情報は送信・保存されません。
          </p>
        </aside>
      </form>
    </main>
  );
}
