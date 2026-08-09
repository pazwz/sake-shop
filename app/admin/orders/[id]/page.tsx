'use client';

import { useEffect, useState } from 'react';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    subtotal: number;
  }[];
  customer: { name: string; email: string };
  shippingAddressSnapshot: {
    recipientName: string;
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
  };
};
const statuses = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];

export default function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    void params.then(({ id }) =>
      fetch(`/api/v1/admin/orders/${id}`)
        .then((r) => r.json())
        .then((p) => setOrder(p.data ?? null)),
    );
  }, [params]);
  async function updateStatus() {
    if (!order || !nextStatus) return;
    const response = await fetch(`/api/v1/admin/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error?.message ?? '更新できませんでした。');
      return;
    }
    setOrder(payload.data);
    setNextStatus('');
    setMessage('状態を更新しました。');
  }
  if (!order) return <main className="wrap py-16">読み込み中…</main>;
  return (
    <main className="wrap py-16">
      <p className="eyebrow">{order.orderNumber}</p>
      <h1 className="serif mt-4 text-4xl">注文詳細</h1>
      <p className="mt-6">
        {order.customer.name} / {order.customer.email}
      </p>
      <p className="mt-3">
        {order.shippingAddressSnapshot.recipientName}　〒
        {order.shippingAddressSnapshot.postalCode}{' '}
        {order.shippingAddressSnapshot.prefecture}
        {order.shippingAddressSnapshot.city}
        {order.shippingAddressSnapshot.addressLine1}
      </p>
      <div className="mt-8 divide-y border-y line">
        {order.items.map((item) => (
          <p key={item.id} className="flex justify-between py-4">
            <span>
              {item.productName} × {item.quantity}
            </span>
            <span>¥{Number(item.subtotal).toLocaleString()}</span>
          </p>
        ))}
      </div>
      <p className="mt-8">状態：{order.status}</p>
      <div className="mt-4 flex max-w-md gap-3">
        <select
          className="input flex-1"
          aria-label="新しい注文状態"
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
        >
          <option value="">状態を変更</option>
          {statuses
            .filter((status) => status !== order.status)
            .map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
        </select>
        <button className="btn bg-[#171412] text-white" onClick={updateStatus}>
          更新
        </button>
      </div>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </main>
  );
}
