'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PUBLIC_FEATURE_NAVIGATION } from '@/config/public-navigation';
import type {
  HeaderNavigationGroup,
  HeaderNavigationLink,
} from '@/types/navigation';
import { BrandLogo } from './brand-logo';
import { useCart } from './cart-provider';
import { useAuth } from './auth-provider';
import { useLanguage } from './language-provider';
import { BellIcon } from './bell-icon';

export function Header({
  navigation,
  features,
}: {
  navigation: HeaderNavigationGroup[];
  features: HeaderNavigationLink[];
}) {
  const { count } = useCart();
  const { member } = useAuth();
  const { locale, setLocale } = useLanguage();
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  useEffect(() => { if (!member) { setUnreadNotifications(0); return; } void fetch('/api/v1/customer/notifications/summary').then((response) => response.ok ? response.json() : null).then((payload) => setUnreadNotifications(payload?.data?.unreadTotal ?? 0)).catch(() => setUnreadNotifications(0)); }, [member]);
  const openSearch = () => {
    setActive(null);
    setMobile(false);
    setSearch(true);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(`/products?q=${encodeURIComponent(query)}`);
    setSearch(false);
  };
  const activeGroup = navigation.find(({ id }) => id === active);
  const megaTitle =
    active === 'features'
      ? PUBLIC_FEATURE_NAVIGATION.label
      : activeGroup?.label;
  const megaLinks = active === 'features' ? features : activeGroup?.links;

  return (
    <header
      onMouseLeave={() => setActive(null)}
      className="sticky top-0 z-40 bg-[#fffdf9]/95 backdrop-blur"
    >
      <div className="wrap grid grid-cols-[auto_1fr] items-center gap-y-2 border-b line pb-3 pt-4 lg:flex lg:h-[66px] lg:justify-between lg:py-0">
        <button
          onClick={openSearch}
          className="row-start-2 hidden text-xs font-semibold md:block"
        >
          ⌕　検索する
        </button>
        <button onClick={openSearch} className="row-start-2 text-sm md:hidden">
          ⌕
        </button>
        <Link
          href="/"
          aria-label="LINXAS FUKUOKA ホーム"
          className="col-span-2 row-start-1 justify-self-center whitespace-nowrap lg:absolute lg:left-1/2 lg:-translate-x-1/2"
        >
          <BrandLogo variant="header" />
        </Link>
        <div className="row-start-2 ml-auto flex items-center gap-3 text-xs font-semibold md:gap-4">
          <select
            aria-label="Language"
            className="hidden bg-transparent text-[#6d2227] outline-none md:block"
            value={locale}
            onChange={(event) => setLocale(event.target.value as typeof locale)}
          >
            <option value="ja">JP</option>
            <option value="en">EN</option>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
          </select>
          <Link
            href={member ? '/account' : '/login'}
            className="hidden sm:inline"
          >
            {member ? 'MY PAGE' : 'LOGIN'}
          </Link>
          {member ? (
            <Link
              href="/account/notifications"
              aria-label="お知らせ"
              className="relative inline-flex h-5 w-5 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6d2227]"
            >
              <BellIcon className="h-4 w-4" />
              {unreadNotifications ? (
                <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-[#6d2227] px-1 text-center text-[10px] leading-4 text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              ) : null}
            </Link>
          ) : null}
          <Link href="/cart">BAG ({count})</Link>
          <button className="lg:hidden" onClick={() => setMobile(!mobile)}>
            MENU
          </button>
        </div>
      </div>
      <div className="hidden h-[48px] border-b line lg:block">
        <nav className="wrap flex h-full items-center justify-center gap-7 text-[11px] font-bold tracking-[.08em] xl:gap-10 xl:text-xs xl:tracking-[.12em]">
          <Link href="/products">商品一覧</Link>
          {navigation.map((group) => (
            <Link
              key={group.id}
              href={group.href}
              onMouseEnter={() =>
                setActive(group.links.length ? group.id : null)
              }
            >
              {group.label}
            </Link>
          ))}
          <Link
            href={PUBLIC_FEATURE_NAVIGATION.href}
            onMouseEnter={() => setActive(features.length ? 'features' : null)}
          >
            {PUBLIC_FEATURE_NAVIGATION.label}
          </Link>
          <Link href="/about">私たちについて</Link>
        </nav>
      </div>
      {megaTitle && megaLinks?.length ? (
        <Mega title={megaTitle} links={megaLinks} />
      ) : null}
      {mobile ? (
        <div className="border-b line bg-[#fffdf9] lg:hidden">
          <nav className="wrap grid grid-cols-2 gap-5 py-5 text-sm">
            <Link href="/products" onClick={() => setMobile(false)}>
              商品一覧
            </Link>
            {navigation.map((group) => (
              <div key={group.id}>
                <Link
                  href={group.href}
                  onClick={() => setMobile(false)}
                  className="font-semibold"
                >
                  {group.label}
                </Link>
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobile(false)}
                    className="mt-2 block text-xs text-stone-600"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
            <div>
              <Link
                href={PUBLIC_FEATURE_NAVIGATION.href}
                onClick={() => setMobile(false)}
                className="font-semibold"
              >
                {PUBLIC_FEATURE_NAVIGATION.label}
              </Link>
              {features.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobile(false)}
                  className="mt-2 block text-xs text-stone-600"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link href="/about" onClick={() => setMobile(false)}>
              私たちについて
            </Link>
            <Link
              href={member ? '/account' : '/login'}
              onClick={() => setMobile(false)}
            >
              {member ? 'マイページ' : 'ログイン'}
            </Link>
            {member ? (
              <Link
                href="/account/notifications"
                onClick={() => setMobile(false)}
                className="flex items-center gap-2"
              >
                <BellIcon className="h-4 w-4" />
                お知らせ{unreadNotifications ? `（${unreadNotifications > 9 ? '9+' : unreadNotifications}）` : ''}
              </Link>
            ) : null}
          </nav>
        </div>
      ) : null}
      {search ? (
        <div className="border-b line bg-[#fffdf9]">
          <div className="wrap py-8 md:py-10">
            <div className="flex items-center justify-between gap-8">
              <p className="eyebrow">SEARCH THE COLLECTION</p>
              <button
                type="button"
                onClick={() => setSearch(false)}
                className="text-sm"
              >
                閉じる　×
              </button>
            </div>
            <form
              noValidate
              onSubmit={submit}
              className="mt-8 grid items-end gap-5 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <label className="block">
                <span className="sr-only">商品を検索</span>
                <input
                  autoFocus
                  aria-label="商品を検索"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className="w-full border-b-2 border-[#171412] bg-transparent pb-4 text-2xl outline-none md:text-3xl"
                  placeholder="商品名・蔵元・産地を検索"
                />
              </label>
              <button className="btn md:min-w-32">検索する</button>
            </form>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Mega({
  title,
  links,
}: {
  title: string;
  links: HeaderNavigationLink[];
}) {
  return (
    <div className="absolute inset-x-0 top-[114px] z-30 border-b line bg-[#fffdf9] shadow-sm">
      <div className="wrap grid gap-8 py-9 md:grid-cols-[.65fr_1.35fr]">
        <div>
          <p className="eyebrow">EXPLORE</p>
          <p className="serif mt-4 text-3xl">{title}</p>
        </div>
        <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}　→
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
