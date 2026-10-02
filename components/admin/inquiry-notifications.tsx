'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { startAdminInquiryPolling } from '@/lib/admin-inquiry-polling';
import { BellIcon } from '@/components/bell-icon';

type Summary = {
  unreadInquiryCount: number;
  recent: Array<{
    id: string;
    publicId: string;
    orderNumber: string | null;
    customerName: string | null;
    preview: string;
    createdAt: string;
  }>;
};

export function InquiryNotifications() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch('/api/v1/admin/inquiries/unread-summary', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Summary unavailable');
        const payload = await response.json();
        if (active) {
          setSummary(payload.data);
          setUnavailable(false);
        }
      } catch {
        if (active) setUnavailable(true);
      }
    };
    const stop = startAdminInquiryPolling(refresh, document, window);
    return () => {
      active = false;
      controller.abort();
      stop();
    };
  }, []);
  return (
    <details className="relative" data-testid="admin-notifications">
      <summary className="cursor-pointer list-none border line bg-white px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2">
        <BellIcon className="mr-2 inline-block h-4 w-4 align-middle" />
        お問い合わせ通知
        {summary ? (
          <span
            className="ml-2 font-semibold text-[var(--accent)]"
            aria-live="polite"
            data-testid="admin-unread-count"
          >
            {summary.unreadInquiryCount}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-3.5rem))] border line bg-white p-5 shadow-sm">
        <p className="eyebrow">ADMIN NOTIFICATIONS</p>
        {unavailable ? (
          <p className="mt-3 text-sm">
            未読情報を取得できません。お問い合わせ一覧をご確認ください。
          </p>
        ) : null}
        {!unavailable && summary?.recent.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            未読のお問い合わせはありません。
          </p>
        ) : null}
        {summary?.recent.map((item) => (
          <Link
            key={item.id}
            href={`/admin/inquiries/${item.id}`}
            className="mt-3 block border-t line pt-3 text-sm"
          >
            <span className="font-medium">
              {item.orderNumber ?? item.publicId}
            </span>
            <span className="mt-1 block text-stone-600">
              {item.customerName ? `${item.customerName} 様` : 'お客様'}
              からのメッセージ
            </span>
            <span className="mt-1 block line-clamp-2">{item.preview}</span>
            <time className="mt-2 block text-xs text-stone-500">
              {new Date(item.createdAt).toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
              })}
            </time>
          </Link>
        ))}
        <Link href="/admin/inquiries" className="mt-4 block text-sm underline">
          お問い合わせ一覧へ
        </Link>
      </div>
    </details>
  );
}
