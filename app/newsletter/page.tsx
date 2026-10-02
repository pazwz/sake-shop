import type { Metadata } from 'next';
import Link from 'next/link';
import { NewsletterSubscriptionForm } from '@/components/newsletter-subscription-form';

export const metadata: Metadata = {
  title: 'メールマガジン登録',
  description: 'LINXASの新入荷や季節のおすすめをメールでお届けします。',
};

export default function NewsletterPage() {
  return (
    <main className="wrap max-w-xl py-14 md:py-20">
      <p className="eyebrow">Newsletter</p>
      <h1 className="serif mt-4 text-3xl md:text-4xl">メールマガジン登録</h1>
      <p className="mt-6 text-sm leading-7 text-stone-600">
        新入荷や季節のおすすめ、LINXASからのお知らせをお届けします。会員登録は不要です。
      </p>
      <NewsletterSubscriptionForm />
      <Link
        href="/"
        className="mt-8 inline-block text-xs underline underline-offset-4"
      >
        トップページへ戻る
      </Link>
    </main>
  );
}
