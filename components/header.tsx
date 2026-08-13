'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { categories } from '@/lib/products';
import { useCart } from './cart-provider';
import { useAuth } from './auth-provider';
import { useLanguage } from './language-provider';
const menu: Record<
  string,
  { sub: string[]; taste: string[]; region: string[]; image: string }
> = {
  日本酒: {
    sub: ['純米酒', '純米吟醸', '大吟醸', '本醸造', 'スパークリング'],
    taste: ['辛口', '甘口', 'フルーティー', '濃醇', 'すっきり'],
    region: ['新潟県', '山形県', '秋田県', '兵庫県'],
    image: 'photo-1569529465841-dfecdab7503b',
  },
  ウイスキー: {
    sub: ['シングルモルト', 'ブレンデッド'],
    taste: ['スモーキー', '華やか', 'リッチ'],
    region: ['北海道', '山梨県', '鹿児島県'],
    image: 'photo-1584916201218-f4242ceb4809',
  },
  焼酎: {
    sub: ['芋焼酎', '麦焼酎', '米焼酎'],
    taste: ['濃厚', 'すっきり', '香ばしい'],
    region: ['鹿児島県', '宮崎県', '熊本県'],
    image: 'photo-1527281400683-1aae777175f8',
  },
  ワイン: {
    sub: ['赤ワイン', '白ワイン', 'ロゼ'],
    taste: ['フルボディ', '辛口', '果実味'],
    region: ['山梨県', '長野県', '北海道'],
    image: 'photo-1510812431401-41d2bd2722f3',
  },
  シャンパン: {
    sub: ['ブリュット', 'ロゼ', 'ヴィンテージ'],
    taste: ['エレガント', 'リッチ'],
    region: ['フランス'],
    image: 'photo-1568213816046-0ee1c42bd559',
  },
  リキュール: {
    sub: ['梅酒', 'ジン', '果実酒'],
    taste: ['甘口', 'ボタニカル'],
    region: ['京都府', '大阪府', '和歌山県'],
    image: 'photo-1513558161293-cdaf765ed2fd',
  },
};
export function Header() {
  const { count } = useCart();
  const { member } = useAuth();
  const { locale, setLocale, categoryLabel } = useLanguage();
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    router.push(`/products?q=${encodeURIComponent(query)}`);
    setSearch(false);
  };
  return (
    <header
      onMouseLeave={() => setActive(null)}
      className="sticky top-0 z-40 bg-[#fffdf9]/95 backdrop-blur"
    >
      <div className="wrap flex h-[66px] items-center justify-between border-b line">
        <button
          onClick={() => setSearch(true)}
          className="hidden text-xs font-semibold md:block"
        >
          ⌕　検索する
        </button>
        <button onClick={() => setSearch(true)} className="text-sm md:hidden">
          ⌕
        </button>
        <Link
          href="/"
          className="serif absolute left-1/2 -translate-x-1/2 text-3xl tracking-[.2em]"
        >
          KURA
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
        <nav className="wrap flex h-full items-center justify-center gap-10 text-xs font-bold tracking-[.12em]">
          <Link href="/products">商品一覧</Link>
          {categories.map((category) => (
            <button key={category} onMouseEnter={() => setActive(category)}>
              {categoryLabel(category)}
            </button>
          ))}
          <Link href="/about">私たちについて</Link>
        </nav>
      </div>
      {active && <Mega category={active} />}{' '}
      {mobile && (
        <div className="border-b line bg-[#fffdf9] lg:hidden">
          <nav className="wrap grid grid-cols-2 gap-4 py-5 text-sm">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/products?category=${encodeURIComponent(category)}`}
                onClick={() => setMobile(false)}
              >
                {categoryLabel(category)}
              </Link>
            ))}
            <Link href="/products">商品一覧</Link>
            <Link href="/about">私たちについて</Link>
            <Link
              href={member ? '/mypage' : '/login'}
              onClick={() => setMobile(false)}
            >
              {member ? 'マイページ' : 'ログイン'}
            </Link>
          </nav>
        </div>
      )}
      {search && (
        <div className="fixed inset-0 z-50 bg-[#fffdf9]">
          <div className="wrap pt-10">
            <div className="flex justify-between">
              <p className="eyebrow">SEARCH THE COLLECTION</p>
              <button onClick={() => setSearch(false)} className="text-sm">
                閉じる　×
              </button>
            </div>
            <form
              noValidate
              onSubmit={submit}
              className="mx-auto mt-[18vh] max-w-3xl"
            >
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full border-b-2 border-[#171412] bg-transparent pb-5 text-3xl outline-none"
                placeholder="商品名・蔵元・産地を検索"
              />
              <button className="btn mt-7">検索する</button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
function Mega({ category }: { category: string }) {
  const data = menu[category];
  return (
    <div className="absolute inset-x-0 top-[114px] z-30 border-b line bg-[#fffdf9] shadow-sm">
      <div className="wrap grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-8 py-9">
        <Column
          title="種類"
          category={category}
          values={data.sub}
          keyName="subcategory"
        />
        <Column
          title="味わい"
          category={category}
          values={data.taste}
          keyName="taste"
        />
        <Column
          title="産地"
          category={category}
          values={data.region}
          keyName="origin"
        />
        <Link
          href={`/products?category=${encodeURIComponent(category)}`}
          className="group relative min-h-44 overflow-hidden"
        >
          <Image
            fill
            sizes="(max-width: 1023px) 0px, 28vw"
            className="object-cover transition group-hover:scale-105"
            src={`https://images.unsplash.com/${data.image}?auto=format&fit=crop&w=800&q=80`}
            alt="特集"
          />
          <div className="absolute inset-0 bg-black/25" />
          <p className="absolute bottom-5 left-5 text-sm font-semibold text-white">
            {category}のおすすめ　→
          </p>
        </Link>
      </div>
    </div>
  );
}
function Column({
  title,
  category,
  values,
  keyName,
}: {
  title: string;
  category: string;
  values: string[];
  keyName: string;
}) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <div className="mt-4 grid gap-3 text-sm">
        {values.map((value) => (
          <Link
            key={value}
            href={`/products?category=${encodeURIComponent(category)}&${keyName}=${encodeURIComponent(value)}`}
          >
            {value}
          </Link>
        ))}
        <Link
          className="mt-2 text-xs text-[#6d2227]"
          href={`/products?category=${encodeURIComponent(category)}`}
        >
          価格帯・おすすめを見る　→
        </Link>
      </div>
    </div>
  );
}
