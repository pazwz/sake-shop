'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProductCard, type ProductCardItem } from '@/components/product-card';
import { useLanguage } from '@/components/language-provider';
import { categories } from '@/lib/products';

type SeasonKey = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
type HomeProduct = ProductCardItem & { images: Array<{ imageUrl: string }> };
type HomeCollection = {
  id: string;
  title: string;
  description: string | null;
  desktopImageUrl: string | null;
  season: SeasonKey | null;
  products: Array<{ product: HomeProduct }>;
};
type HomeData = {
  currentSeason: SeasonKey;
  hero: HomeCollection[];
  seasonal: HomeCollection[];
  shopkeeper: HomeCollection[];
  gift: HomeCollection[];
  editorial: HomeCollection[];
  story: HomeCollection[];
};

const seasonLabels: Record<SeasonKey, string> = {
  SPRING: '春',
  SUMMER: '夏',
  AUTUMN: '秋',
  WINTER: '冬',
};

const productsFor = (collections: HomeCollection[]) =>
  collections.flatMap((collection) =>
    collection.products.map(({ product }) => ({
      ...product,
      price: Number(product.price),
    })),
  );

function EmptyHome() {
  return (
    <section className="wrap py-32 text-center">
      <p className="eyebrow">KURA</p>
      <h1 className="serif mt-5 text-4xl">現在ご案内できる特集はありません</h1>
      <p className="mt-5 text-sm text-stone-600">
        新しい特集を準備しています。商品一覧からお酒をお選びください。
      </p>
      <Link className="btn btn-outline mt-8" href="/products">
        商品一覧へ
      </Link>
    </section>
  );
}

export default function Home() {
  const { categoryLabel } = useLanguage();
  const [home, setHome] = useState<HomeData | null>(null);
  const [activeSeason, setActiveSeason] = useState<SeasonKey | null>(null);

  useEffect(() => {
    const loadHome = async () => {
      const response = await fetch('/api/v1/home');
      const payload = (await response.json()) as {
        success: boolean;
        data: HomeData | null;
      };

      if (response.ok && payload.success && payload.data) {
        setHome(payload.data);
        setActiveSeason(payload.data.currentSeason);
      }
    };

    void loadHome();
  }, []);

  if (!home || home.hero.length === 0) return <EmptyHome />;

  const currentSeason = activeSeason ?? home.currentSeason;
  const seasonal = home.seasonal.find(
    (collection) => collection.season === currentSeason,
  );
  const hero = home.hero[0];
  const shopkeeperProducts = productsFor(home.shopkeeper).slice(0, 3);
  const giftProducts = productsFor(home.gift).slice(0, 3);
  const editorial = home.editorial[0];
  const stories = home.story.slice(0, 2);

  return (
    <>
      <section className="relative h-[82vh] min-h-[620px] overflow-hidden">
        {hero.desktopImageUrl ? (
          <Image
            fill
            sizes="100vw"
            loading="eager"
            className="object-cover"
            src={hero.desktopImageUrl}
            alt={hero.title}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="wrap relative flex h-full items-end pb-20 text-white">
          <div className="max-w-2xl">
            <p className="eyebrow text-[#eed9aa]">SEASONAL JOURNAL</p>
            <h1 className="serif mt-6 text-5xl leading-tight md:text-7xl">
              {hero.title}
            </h1>
            {hero.description ? (
              <p className="mt-6 max-w-md text-sm leading-8 text-stone-100">
                {hero.description}
              </p>
            ) : null}
            <Link
              className="btn mt-9 bg-white text-[#171412] hover:bg-[#ead9b7]"
              href="/products"
            >
              季節を味わう
            </Link>
          </div>
        </div>
      </section>

      <section className="wrap py-20 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">SEASONAL RECOMMENDATIONS</p>
            <h2 className="serif mt-4 text-4xl">季節のおすすめ</h2>
          </div>
          <div className="flex border-b line text-sm font-semibold">
            {Object.entries(seasonLabels).map(([season, label]) => (
              <button
                key={season}
                type="button"
                onClick={() => setActiveSeason(season as SeasonKey)}
                className={`px-4 py-3 ${season === currentSeason ? 'border-b-2 border-[#6d2227] text-[#6d2227]' : 'text-stone-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {seasonal ? (
          <>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {productsFor([seasonal]).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Link
              href="/products"
              className="mt-8 inline-block border-b border-[#171412] pb-1 text-xs font-bold"
            >
              {seasonLabels[currentSeason]}のおすすめをすべて見る　→
            </Link>
          </>
        ) : null}
      </section>

      <section className="border-y line bg-[#faf8f4]">
        <div className="wrap py-20">
          <p className="eyebrow">Explore by category</p>
          <div className="mt-10 grid grid-cols-2 border-l line md:grid-cols-3">
            {categories.map((category, index) => (
              <Link
                key={category}
                href={`/products?category=${encodeURIComponent(category)}`}
                className="group border-b border-r line p-7 md:p-10"
              >
                <span className="text-xs text-stone-500">0{index + 1}</span>
                <p className="serif mt-10 text-2xl group-hover:text-[#6d2227]">
                  {categoryLabel(category)}
                </p>
                <span className="mt-3 block text-xs text-[#6d2227]">
                  選ぶ　→
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap grid gap-10 py-24 md:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="eyebrow">SHOPKEEPER&apos;S CHOICE</p>
          <h2 className="serif mt-5 text-4xl">店主のおすすめ</h2>
          <p className="mt-6 text-sm leading-8 text-stone-600">
            造り手の哲学と、食卓の時間まで想像しながら選びました。
          </p>
          <Link
            href="/products"
            className="mt-7 inline-block border-b border-[#171412] pb-1 text-xs"
          >
            選び抜いた一本へ　→
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {shopkeeperProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {editorial ? (
        <section className="grid min-h-[540px] md:grid-cols-2">
          <div className="relative min-h-80">
            {editorial.desktopImageUrl ? (
              <Image
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
                src={editorial.desktopImageUrl}
                alt={editorial.title}
              />
            ) : null}
          </div>
          <div className="flex items-center bg-[#3d3028] px-10 py-20 text-white md:px-20">
            <div>
              <p className="eyebrow text-[#e7cf9f]">EDITORIAL FEATURE</p>
              <h2 className="serif mt-6 text-5xl leading-tight">
                {editorial.title}
              </h2>
              {editorial.description ? (
                <p className="mt-7 max-w-md text-sm leading-8 text-stone-200">
                  {editorial.description}
                </p>
              ) : null}
              <Link
                className="mt-8 inline-block border-b border-[#e7cf9f] pb-1 text-xs text-[#e7cf9f]"
                href="/products"
              >
                特集へ　→
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="wrap py-24">
        <p className="eyebrow">GIFT RECOMMENDATIONS</p>
        <h2 className="serif mt-4 text-4xl">贈り物におすすめ</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {giftProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="bg-[#f3f0ea]">
        <div className="wrap py-24">
          <p className="eyebrow">STORIES</p>
          <div className="mt-5 grid gap-8 md:grid-cols-2">
            {stories.map((story) => (
              <Link
                key={story.id}
                href="/products"
                className="grid gap-6 sm:grid-cols-2"
              >
                <div className="relative aspect-[4/3]">
                  {story.desktopImageUrl ? (
                    <Image
                      fill
                      sizes="(max-width: 639px) 100vw, (max-width: 767px) 50vw, 25vw"
                      className="object-cover"
                      src={story.desktopImageUrl}
                      alt={story.title}
                    />
                  ) : null}
                </div>
                <div className="self-center">
                  <h3 className="serif text-3xl">{story.title}</h3>
                  {story.description ? (
                    <p className="mt-4 text-sm leading-7 text-stone-600">
                      {story.description}
                    </p>
                  ) : null}
                  <span className="mt-5 block text-xs text-[#6d2227]">
                    特集を見る　→
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
