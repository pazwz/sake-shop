import Link from 'next/link';
import { siteConfig } from '@/config/site';

export default function ContactPage() {
  return (
    <main className="wrap py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="eyebrow">Support guide</p>
        <h1 className="serif mt-4 text-5xl">お問い合わせについて</h1>
        <p className="mt-7 text-sm leading-8 text-stone-600">
          ご注文に関するお問い合わせは、MY
          PAGEの注文履歴から対象のご注文を選択してお送りください。サイト内のメッセージでご案内いたします。
        </p>
        <div className="mt-10 grid gap-px bg-stone-200 sm:grid-cols-2">
          <Link href="/account/orders" className="bg-white p-6 text-sm">
            <strong>MY PAGE・注文履歴</strong>
            <span className="mt-2 block text-stone-500">
              ご注文後のお問い合わせはこちら
            </span>
          </Link>
          <Link href="/shipping-returns" className="bg-white p-6 text-sm">
            <strong>配送・返品について</strong>
            <span className="mt-2 block text-stone-500">
              配送、送料、返品のご案内
            </span>
          </Link>
          <Link href="/terms" className="bg-white p-6 text-sm">
            <strong>利用ガイド</strong>
            <span className="mt-2 block text-stone-500">
              ご利用にあたってのご案内
            </span>
          </Link>
          <Link href="/about" className="bg-white p-6 text-sm">
            <strong>店舗情報</strong>
            <span className="mt-2 block text-stone-500">
              店舗・営業時間のご案内
            </span>
          </Link>
        </div>
        <div className="mt-10 border-t line pt-6 text-sm leading-8 text-stone-600">
          <p className="font-medium text-[#171412]">お電話でのお問い合わせ</p>
          <a className="underline" href={siteConfig.phone.href}>
            {siteConfig.phone.display}
          </a>
          <p>営業時間　{siteConfig.businessHours}</p>
        </div>
      </div>
    </main>
  );
}
