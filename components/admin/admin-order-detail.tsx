'use client';

import { useCallback, useEffect, useState } from 'react';

type Shipment = {
  carrier: string;
  trackingNumber: string | null;
  status: string;
  shippedAt: string | null;
};
type Payment = {
  provider: string;
  providerPaymentId: string | null;
  status: string;
  amount: number;
  paidAt: string | null;
  failedAt: string | null;
};
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  shipmentStatus: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    subtotal: number;
  }[];
  customer: { name: string; email: string };
  payments: Payment[];
  shipments: Shipment[];
  shippingAddressSnapshot: {
    recipientName: string;
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
  };
};

const orderStatuses = [
  'PENDING',
  'PROCESSING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];
const shipmentStatuses = [
  'PENDING',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
];

export function AdminOrderDetail({
  orderId,
  canManage,
}: {
  orderId: string;
  canManage: boolean;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [nextOrderStatus, setNextOrderStatus] = useState('');
  const [carrier, setCarrier] = useState('SAGAWA');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shipmentStatus, setShipmentStatus] = useState('');
  const [shippedAt, setShippedAt] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/admin/orders/${orderId}`);
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error?.detail ?? '注文を読み込めませんでした。');
      return;
    }
    const loaded = payload.data as Order;
    setOrder(loaded);
    const shipment = loaded.shipments[0];
    if (shipment) {
      setCarrier(shipment.carrier);
      setTrackingNumber(shipment.trackingNumber ?? '');
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateOrderStatus() {
    if (!nextOrderStatus) return;
    const response = await fetch(`/api/v1/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextOrderStatus }),
    });
    const payload = await response.json();
    setMessage(
      response.ok
        ? '注文状態を更新しました。'
        : (payload.error?.detail ?? '更新できませんでした。'),
    );
    if (response.ok) {
      setNextOrderStatus('');
      await load();
    }
  }

  async function updateShipment() {
    const body: Record<string, string> = { carrier };
    if (trackingNumber.trim()) body.trackingNumber = trackingNumber.trim();
    if (shipmentStatus) body.status = shipmentStatus;
    if (shippedAt) body.shippedAt = shippedAt;
    const response = await fetch(`/api/v1/admin/orders/${orderId}/shipment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(
      response.ok
        ? '配送情報を更新しました。'
        : (payload.error?.detail ?? '配送情報を更新できませんでした。'),
    );
    if (response.ok) {
      setShipmentStatus('');
      await load();
    }
  }

  if (!order) return <main className="wrap py-16">読み込み中…</main>;
  const shipment = order.shipments[0];
  const payment =
    order.payments.find((entry) => entry.status === 'SUCCEEDED') ??
    order.payments[0];
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
      <section className="mt-10 border-t line pt-8">
        <h2 className="serif text-2xl">注文状態</h2>
        <p className="mt-3">状態：{order.status}</p>
        {canManage && (
          <div className="mt-4 flex max-w-md gap-3">
            <select
              className="input flex-1"
              aria-label="新しい注文状態"
              value={nextOrderStatus}
              onChange={(event) => setNextOrderStatus(event.target.value)}
            >
              <option value="">状態を変更</option>
              {orderStatuses
                .filter((status) => status !== order.status)
                .map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
            </select>
            <button
              className="btn bg-[#171412] text-white"
              onClick={updateOrderStatus}
            >
              更新
            </button>
          </div>
        )}
      </section>
      <section className="mt-10 border-t line pt-8">
        <h2 className="serif text-2xl">支払い情報</h2>
        {payment ? (
          <p className="mt-3 text-sm leading-7">
            Provider：{payment.provider}
            <br />
            Status：{payment.status}
            <br />
            Amount：¥{Number(payment.amount).toLocaleString()}
            <br />
            Provider payment ID：{payment.providerPaymentId ?? '—'}
            <br />
            Paid at：
            {payment.paidAt
              ? new Date(payment.paidAt).toLocaleString('ja-JP')
              : '—'}
            <br />
            Failed at：
            {payment.failedAt
              ? new Date(payment.failedAt).toLocaleString('ja-JP')
              : '—'}
          </p>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            支払い記録はありません。
          </p>
        )}
      </section>
      <section className="mt-10 border-t line pt-8">
        <h2 className="serif text-2xl">発貨処理</h2>
        <p className="mt-3 text-sm">
          配送状態：{shipment?.status ?? order.shipmentStatus}
        </p>
        {shipment?.shippedAt && (
          <p className="mt-2 text-sm">
            発送日：{new Date(shipment.shippedAt).toLocaleDateString('ja-JP')}
          </p>
        )}
        {shipment?.trackingNumber && (
          <p className="mt-2 text-sm">
            運送会社：{shipment.carrier} / 伝票番号：{shipment.trackingNumber}
          </p>
        )}
        {canManage && (
          <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs">配送会社</span>
              <select
                className="input mt-1 w-full"
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
              >
                <option value="SAGAWA">SAGAWA</option>
                <option value="YAMATO">YAMATO</option>
                <option value="JP_POST">JP_POST</option>
              </select>
            </label>
            <label>
              <span className="text-xs">運単番号</span>
              <input
                className="input mt-1 w-full"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
              />
            </label>
            <label>
              <span className="text-xs">発送日</span>
              <input
                type="datetime-local"
                className="input mt-1 w-full"
                value={shippedAt}
                onChange={(event) => setShippedAt(event.target.value)}
              />
            </label>
            <label>
              <span className="text-xs">配送状態</span>
              <select
                className="input mt-1 w-full"
                value={shipmentStatus}
                onChange={(event) => setShipmentStatus(event.target.value)}
              >
                <option value="">状態を変更</option>
                {shipmentStatuses
                  .filter((status) => status !== shipment?.status)
                  .map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="btn bg-[#171412] text-white sm:col-span-2"
              onClick={updateShipment}
            >
              配送情報を保存
            </button>
          </div>
        )}
        {!canManage && (
          <p className="mt-4 text-sm text-stone-500">
            STAFF 権限では配送情報を編集できません。
          </p>
        )}
      </section>
      {message && <p className="mt-5 text-sm">{message}</p>}
    </main>
  );
}
