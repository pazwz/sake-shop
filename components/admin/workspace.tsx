'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminUserStatus } from '@/components/admin/admin-user-status';
import { InquiryNotifications } from '@/components/admin/inquiry-notifications';
import { BrandLogo } from '@/components/brand-logo';
import type { AdminRole } from '@prisma/client';
import { isDeveloper } from '@/lib/admin-access';

const links = [
  ['/admin', 'ダッシュボード'],
  ['/admin/products', '商品管理'],
  ['/admin/orders', '注文管理'],
  ['/admin/collections', 'ホームページ管理'],
  ['/admin/collections/all', '特集・ストーリー'],
  ['/admin/inquiries', 'お問い合わせ'],
  ['/admin/announcements', 'サイトのお知らせ'],
  ['/admin/newsletters', 'ニュースレター'],
  ['/admin/integrations/smaregi', 'スマレジ連携・同期'],
  ['/admin/operations', '運用状態'],
  ['/admin/email-preview', 'メールプレビュー'],
] as const;

export function AdminWorkspace({
  admin,
  children,
}: {
  admin: { name: string; role: AdminRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const visible = links.filter(
    ([href]) =>
      !['/admin/operations', '/admin/email-preview'].includes(href) ||
      isDeveloper(admin.role),
  );
  const current =
    [...visible]
      .reverse()
      .find(
        ([href]) =>
          pathname === href ||
          (href !== '/admin' && pathname.startsWith(`${href}/`)),
      ) ?? visible[0];
  const nav = (
    <nav
      aria-label="管理画面ナビゲーション"
      className="flex flex-wrap gap-2 py-4"
    >
      {visible.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current[0] === href ? 'page' : undefined}
          className={`px-3 py-2 text-sm ${current[0] === href ? 'border-b-2 border-[var(--accent)] font-semibold text-[var(--accent)]' : 'text-stone-600 hover:text-[var(--ink)]'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div
      className="min-h-screen bg-[var(--paper)]"
      data-testid="admin-workspace"
    >
      <header className="border-b line bg-white">
        <div className="wrap flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href="/admin" className="flex items-center gap-3">
            <BrandLogo variant="admin" />
            <span className="text-xs font-semibold tracking-[.16em] text-[var(--accent)]">
              ADMINISTRATION
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <InquiryNotifications />
            <AdminUserStatus admin={admin} />
            {isDeveloper(admin.role) ? (
              <span className="text-xs text-stone-500">開発者</span>
            ) : null}
          </div>
        </div>
        <div className="wrap hidden md:block">{nav}</div>
        <details className="wrap md:hidden">
          <summary className="cursor-pointer py-3 text-sm">
            管理メニュー
          </summary>
          {nav}
        </details>
      </header>
      <div className="wrap pt-6">
        <nav
          aria-label="パンくずリスト"
          className="flex flex-wrap items-center gap-3 text-xs text-stone-600"
        >
          <Link href="/admin" className="underline">
            管理画面トップへ
          </Link>
          {pathname !== '/admin' ? (
            <>
              <span aria-hidden="true">/</span>
              <Link href={current[0]}>{current[1]}</Link>
              {pathname !== current[0] ? (
                <>
                  <span aria-hidden="true">/</span>
                  <span>詳細</span>
                </>
              ) : null}
            </>
          ) : null}
        </nav>
      </div>
      {children}
    </div>
  );
}
