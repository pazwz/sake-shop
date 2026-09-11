'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  HeaderNavigationGroup,
  HeaderNavigationLink,
} from '@/types/navigation';
import { BrandLogo } from './brand-logo';
import { useCart } from './cart-provider';
import { useAuth } from './auth-provider';
import { useLanguage } from './language-provider';

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
  const megaTitle = active === 'features' ? '特集' : activeGroup?.label;
  const megaLinks = active === 'features' ? features : activeGroup?.links;

  return (
    <header
      onMouseLeave={() => setActive(null)}
      className="sticky top-0 z-40 bg-[#fffdf9]/95 backdrop-blur"
    >
      <div className="wrap flex h-[66px] items-center justify-between border-b line">
        <button
          onClick={openSearch}
          className="hidden text-xs font-semibold md:block"
        >
          ⌕　検索する
        </button>
        <button onClick={openSearch} className="text-sm md:hidden">
          ⌕
        </button>
        <Link
          href="/"
          aria-label="LINXAS ホーム"
          className="absolute left-1/2 -translate-x-1/2"
        >
          <BrandLogo variant="header" />
        </Link>
        <div className="ml-auto flex items-center gap-4 text-xs font-semibold">
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
            href={member ? '/mypage' : '/login'}
            className="hidden sm:inline"
          >
            {member ? 'MY PAGE' : 'LOGIN'}
          </Link>
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
            <button key={group.id} onMouseEnter={() => setActive(group.id)}>
              {group.label}
            </button>
          ))}
          <button onMouseEnter={() => setActive('features')}>特集</button>
          <Link href="/about">私たちについて</Link>
        </nav>
      </div>
      {megaTitle && megaLinks ? (
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
                <p className="font-semibold">{group.label}</p>
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
              <p className="font-semibold">特集</p>
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
              href={member ? '/mypage' : '/login'}
              onClick={() => setMobile(false)}
            >
              {member ? 'マイページ' : 'ログイン'}
            </Link>
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
        {links.length ? (
          <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}　→
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            現在ご案内できる商品カテゴリーはありません。
          </p>
        )}
      </div>
    </div>
  );
}
