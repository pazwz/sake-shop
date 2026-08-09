import { notFound } from 'next/navigation';
import { formatPrice } from '@/lib/products';
import { OrderService } from '@/services/order.service';

export default async function OrderConfirmation({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  let order;

  try {
    order = await new OrderService().getByOrderNumber(
      (await params).orderNumber,
    );
  } catch {
    notFound();
  }

  const address = order.shippingAddressSnapshot as {
    recipientName: string;
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
    addressLine2?: string;
    phone: string;
  };

  return (
    <main className="wrap py-20">
      <p className="eyebrow">ORDER CONFIRMATION</p>
      <h1 className="serif mt-4 text-5xl">ご注文を承りました</h1>
      <p className="mt-6 text-sm">注文番号：{order.orderNumber}</p>
      <div className="mt-12 grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="serif text-2xl">ご注文商品</h2>
          <div className="mt-5 divide-y border-y line">
            {order.items.map((item) => (
              <p className="flex justify-between py-4 text-sm" key={item.id}>
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <span>{formatPrice(Number(item.subtotal))}</span>
              </p>
            ))}
          </div>
          <p className="mt-5 flex justify-between">
            <span>送料</span>
            <span>{formatPrice(Number(order.shippingFee))}</span>
          </p>
          <p className="mt-4 flex justify-between text-lg">
            <span>合計</span>
            <span>{formatPrice(Number(order.totalAmount))}</span>
          </p>
        </section>
        <section>
          <h2 className="serif text-2xl">配送先</h2>
          <p className="mt-5 text-sm leading-7">
            {address.recipientName}
            <br />〒{address.postalCode} {address.prefecture}
            {address.city}
            <br />
            {address.addressLine1} {address.addressLine2}
            <br />
            {address.phone}
            <br />
            状態：{order.status}
          </p>
        </section>
      </div>
    </main>
  );
}
