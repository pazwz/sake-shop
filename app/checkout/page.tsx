'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/cart-provider';
import { useAuth } from '@/components/auth-provider';
import { formatPrice } from '@/lib/products';
export default function Checkout() {
  const { items, clear } = useCart();
  const { member, ready } = useAuth();
  const router = useRouter();
  const [age, setAge] = useState(false);
  const [error, setError] = useState('');
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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/v1/orders', {
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
        paymentMethod: 'card',
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.detail || '注文を作成できませんでした。');
      return;
    }
    clear();
    router.push(`/orders/${payload.data.orderNumber}`);
  };
  return (
    <main className="wrap py-16">
      <p className="eyebrow">CHECKOUT</p>
      <h1 className="serif mt-4 text-5xl">お届け先</h1>
      <form
        onSubmit={submit}
        className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_.7fr]"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {Object.entries(form).map(([key, value]) => (
            <label
              key={key}
              className={
                key === 'addressLine1' || key === 'email' ? 'sm:col-span-2' : ''
              }
            >
              <span className="text-xs">{key}</span>
              <input
                required
                className="input mt-2"
                value={value}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <label className="sm:col-span-2 flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={age}
              onChange={(event) => setAge(event.target.checked)}
            />
            私は20歳以上です。
          </label>
          {error ? (
            <p className="sm:col-span-2 text-sm text-red-700">{error}</p>
          ) : null}
          <button
            disabled={!age || !items.length}
            className="btn sm:col-span-2"
          >
            注文を確定する
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
            送料は開発用の暫定設定です。注文金額はサーバーで再計算されます。
          </p>
        </aside>
      </form>
    </main>
  );
}
