import Link from 'next/link';
import { getSafeOrderConfirmationNumber } from '@/lib/order-confirmation';

export default async function OrderCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string | string[] }>;
}) {
  const orderNumber = getSafeOrderConfirmationNumber(
    (await searchParams).orderNumber,
  );

  return (
    <main className="wrap py-20">
      <p className="eyebrow">ORDER CONFIRMATION</p>
      <h1 className="serif mt-4 text-4xl sm:text-5xl">
        ご注文を承りました
      </h1>
      {orderNumber ? (
        <p className="mt-6 text-sm">注文番号：{orderNumber}</p>
      ) : null}
      <p className="mt-6 max-w-2xl text-sm leading-7 text-stone-600">
        ご注文ありがとうございます。注文内容の確認方法は、安全なログイン機能の準備後にご案内します。
      </p>
      <Link className="btn-secondary mt-8 inline-flex" href="/">
        トップページへ戻る
      </Link>
    </main>
  );
}
