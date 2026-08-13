'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProductCard } from '@/components/product-card';
import { SEASON_COLLECTION_SLUGS } from '@/config/collections';

export type SeasonKey = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export type HomeProductCardItem = {
  id: string;
  slug: string;
  name: string;
  category: { name: string };
  producer: string | null;
  price: number;
  images: Array<{ imageUrl: string }>;
};

export type SeasonalCollection = {
  id: string;
  season: SeasonKey | null;
  products: Array<{ product: HomeProductCardItem }>;
};

const seasonLabels: Record<SeasonKey, string> = {
  SPRING: '春',
  SUMMER: '夏',
  AUTUMN: '秋',
  WINTER: '冬',
};

export function HomeSeasonalSection({
  collections,
  currentSeason,
}: {
  collections: SeasonalCollection[];
  currentSeason: SeasonKey;
}) {
  const [activeSeason, setActiveSeason] = useState(currentSeason);
  const seasonal = collections.find(
    (collection) => collection.season === activeSeason,
  );

  return (
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
              className={`px-4 py-3 ${season === activeSeason ? 'border-b-2 border-[#6d2227] text-[#6d2227]' : 'text-stone-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {seasonal ? (
        <>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {seasonal.products.map(({ product }) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Link
            href={`/collections/${SEASON_COLLECTION_SLUGS[activeSeason]}`}
            className="mt-8 inline-block border-b border-[#171412] pb-1 text-xs font-bold"
          >
            {seasonLabels[activeSeason]}のおすすめをすべて見る　→
          </Link>
        </>
      ) : (
        <p className="mt-10 text-sm text-stone-500">
          この季節のおすすめは準備中です。
        </p>
      )}
    </section>
  );
}
