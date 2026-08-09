'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customer: { name: string; email: string };
};
const statuses = [
  '',
  'PENDING',
  'PAID',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    if (keyword) query.set('keyword', keyword);
    if (status) query.set('status', status);
    void fetch(`/api/v1/admin/orders?${query.toString()}`)
      .then((r) => r.json())
      .then((p) => setOrders(p.data ?? []));
  }, [keyword, status]);

  return (
    <main className="wrap py-16">
      <p className="eyebrow">ADMIN ORDERS</p>
      <h1 className="serif mt-4 text-5xl">注文管理</h1>
      <div className="mt-8 flex max-w-xl gap-3">
        <input
          className="input flex-1"
          placeholder="注文番号を検索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className="input w-48"
          aria-label="注文状態で絞り込む"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">すべての状態</option>
          {statuses.slice(1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-8 divide-y border-y line">
        {orders.map((order) => (
          <Link
            className="flex justify-between py-5"
            key={order.id}
            href={`/admin/orders/${order.id}`}
          >
            <span>
              {order.orderNumber}
              <small className="ml-3 text-stone-500">
                {order.customer.name}
              </small>
            </span>
            <span>
              {order.status}　¥{Number(order.totalAmount).toLocaleString()}
            </span>
          </Link>
        ))}
        {!orders.length && (
          <p className="py-8 text-sm text-stone-500">
            該当する注文はありません。
          </p>
        )}
      </div>
    </main>
  );
}
