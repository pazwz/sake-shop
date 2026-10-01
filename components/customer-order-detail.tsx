import Link from 'next/link';
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  CUSTOMER_PAYMENT_METHOD_LABELS,
  CUSTOMER_PAYMENT_STATUS_LABELS,
  CUSTOMER_SHIPMENT_CARRIER_LABELS,
  CUSTOMER_SHIPMENT_STATUS_LABELS,
} from '@/config/customer-order';
import { formatPrice } from '@/lib/products';
import type { CustomerOrderDetail as OrderDetail } from '@/types/customer-order';
import { CustomerOrderItemImage } from '@/components/customer-order-item-image';

const date = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));

export function CustomerOrderDetail({ order }: { order: OrderDetail }) {
  const address = order.shippingAddress;
  const shipment = order.shipment;
  const paymentStatus = order.payment?.status ?? order.paymentStatus;
  const orderPath = `/account/orders/${encodeURIComponent(order.orderNumber)}`;
  return (
    <main className="wrap py-8 md:py-12">
      <Link
        href="/account/orders"
        className="text-sm underline underline-offset-4"
      >
        注文履歴へ戻る
      </Link>
      <header className="mt-8">
        <p className="eyebrow">Order detail</p>
        <h1 className="serif mt-3 text-3xl md:text-4xl">注文詳細</h1>
        <p className="mt-4 break-all text-sm" data-testid="order-number">
          注文番号：{order.orderNumber}
        </p>
        <p className="mt-2 text-sm text-black/60">
          注文日：{date(order.createdAt)}
        </p>
      </header>

      <section aria-label="ご注文状況" className="mt-7 border-y line py-5">
        <dl className="grid gap-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-black/60">ご注文状況</dt>
            <dd className="mt-2 font-medium text-[var(--accent)]">
              {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-black/60">お支払い状況</dt>
            <dd className="mt-2">
              {CUSTOMER_PAYMENT_STATUS_LABELS[paymentStatus]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-black/60">配送状況</dt>
            <dd className="mt-2">
              {
                CUSTOMER_SHIPMENT_STATUS_LABELS[
                  shipment?.status ?? order.shipmentStatus
                ]
              }
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="order-items-title" className="mt-8">
        <h2 id="order-items-title" className="serif text-xl">
          ご注文商品
        </h2>
        <ul className="mt-3 divide-y divide-[var(--line)] border-b line">
          {order.items.map((item, index) => (
            <li
              key={`${item.productId}:${index}`}
              className="flex gap-4 py-5 sm:gap-6"
            >
              <CustomerOrderItemImage
                imageUrl={item.imageUrl}
                alt={item.imageAlt ?? item.productName}
              />
              <div className="min-w-0 flex-1 sm:flex sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-medium">
                    {item.productName}
                  </h3>
                  <p className="mt-3 text-sm text-black/60">
                    数量：{item.quantity}
                  </p>
                  <p className="mt-1 text-sm text-black/60">
                    単価：{formatPrice(item.unitPrice)}（税込）
                  </p>
                </div>
                <p className="mt-3 shrink-0 text-sm sm:mt-0 sm:text-right">
                  <span className="mr-2 text-black/60">小計</span>
                  {formatPrice(item.subtotal)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="min-w-0">
          <section aria-labelledby="order-address-title">
            <h2 id="order-address-title" className="serif text-xl">
              お届け先
            </h2>
            {address ? (
              <address className="mt-4 break-words text-sm not-italic leading-7">
                <p>{address.recipientName} 様</p>
                <p>〒{address.postalCode}</p>
                <p>
                  {address.prefecture}
                  {address.city}
                  {address.addressLine1}
                </p>
                {address.addressLine2 ? <p>{address.addressLine2}</p> : null}
                <p className="mt-2">電話番号：{address.phone}</p>
              </address>
            ) : (
              <p className="mt-4 text-sm text-black/60">
                この注文のお届け先情報は記録されていません。
              </p>
            )}
          </section>
          <section
            aria-labelledby="order-shipment-title"
            className="mt-7 border-t line pt-6"
          >
            <h2 id="order-shipment-title" className="serif text-xl">
              配送情報
            </h2>
            {shipment ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-black/60">配送会社</dt>
                  <dd>
                    {CUSTOMER_SHIPMENT_CARRIER_LABELS[shipment.carrier] ??
                      '配送会社情報を確認中'}
                  </dd>
                </div>
                {shipment.trackingNumber ? (
                  <div>
                    <dt className="text-black/60">お問い合わせ番号</dt>
                    <dd className="mt-1 break-all">
                      {shipment.trackingNumber}
                    </dd>
                  </div>
                ) : (
                  <p className="text-black/60">
                    お問い合わせ番号はまだ登録されていません。
                  </p>
                )}
                {shipment.shippedAt ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-black/60">発送日</dt>
                    <dd>{date(shipment.shippedAt)}</dd>
                  </div>
                ) : null}
                {shipment.deliveredAt ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-black/60">お届け日</dt>
                    <dd>{date(shipment.deliveredAt)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-black/60">
                配送情報はまだ登録されていません。
              </p>
            )}
          </section>
        </div>
        <div className="min-w-0">
          <section aria-labelledby="order-payment-title">
            <h2 id="order-payment-title" className="serif text-xl">
              お支払い
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-black/60">お支払い方法</dt>
                <dd>
                  {order.paymentMethod
                    ? (CUSTOMER_PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                      'お支払い方法を確認中')
                    : 'お支払い方法の記録はありません'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-black/60">お支払い状況</dt>
                <dd>{CUSTOMER_PAYMENT_STATUS_LABELS[paymentStatus]}</dd>
              </div>
              {order.payment?.paidAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-black/60">お支払い日</dt>
                  <dd>{date(order.payment.paidAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section
            aria-labelledby="order-amount-title"
            className="mt-7 border-t line pt-6"
          >
            <h2 id="order-amount-title" className="serif text-xl">
              ご注文金額
            </h2>
            <dl className="mt-4 space-y-3 text-sm tabular-nums">
              <div className="flex justify-between gap-4">
                <dt>商品小計（税込）</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>送料</dt>
                <dd>{formatPrice(order.shippingFee)}</dd>
              </div>
              {order.discountAmount > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt>割引</dt>
                  <dd>−{formatPrice(order.discountAmount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t line pt-4 text-lg">
                <dt>合計（税込）</dt>
                <dd className="font-medium">
                  {formatPrice(order.totalAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-xs text-black/60">
                <dt>うち消費税</dt>
                <dd>{formatPrice(order.taxAmount)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="order-support-title"
        className="mt-9 border-t line pt-6"
      >
        <h2 id="order-support-title" className="serif text-xl">
          ご注文についてのお問い合わせ
        </h2>
        <p className="mt-3 text-sm text-black/60">
          この注文に関するご相談は、カスタマーセンターへお知らせください。
        </p>
        <Link
          href={`${orderPath}/messages`}
          className="btn btn-outline mt-5 inline-flex max-w-full text-center"
        >
          この注文について問い合わせる
        </Link>
      </section>
    </main>
  );
}
