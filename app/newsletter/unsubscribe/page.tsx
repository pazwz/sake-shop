import type { Metadata } from 'next';
import {
  NewsletterUnsubscribeConfirmation,
  type NewsletterUnsubscribeState,
} from '@/components/newsletter-unsubscribe-confirmation';
import { NewsletterService } from '@/services/newsletter.service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'メールマガジンの配信停止',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const input = (await searchParams).token;
  const token = typeof input === 'string' ? input : '';
  let state: NewsletterUnsubscribeState = 'invalid';
  if (token) {
    try {
      state = await new NewsletterService().getUnsubscribeState(token);
    } catch {
      state = 'unavailable';
    }
  }
  return (
    <main className="wrap max-w-xl py-14 md:py-20">
      <p className="eyebrow">Newsletter</p>
      <h1 className="serif mt-4 text-3xl md:text-4xl">
        メールマガジンの配信停止
      </h1>
      <NewsletterUnsubscribeConfirmation
        initialState={state}
        token={state === 'confirm' ? token : ''}
      />
    </main>
  );
}
