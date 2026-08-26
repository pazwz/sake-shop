'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { getCategories, getProducts } from '@/lib/product-api';
import type { CategoryRecord, ProductListResult } from '@/types/product';
import { BrandLoader } from '@/components/brand-loader';
import { BrandEmptyState } from '@/components/brand-empty-state';
import { AgeNotice } from '@/components/age-notice';

const INITIAL_RESULT: ProductListResult = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsCollection />
    </Suspense>
  );
}

function ProductsCollection() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [result, setResult] = useState<ProductListResult>(INITIAL_RESULT);
  const [keyword, setKeyword] = useState(
    searchParams.get('keyword') ?? searchParams.get('q') ?? '',
  );
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'recommended');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    void getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ page: '1', limit: '20', sort });
    if (keyword) query.set('keyword', keyword);
    if (category) query.set('category', category);

    setIsLoading(true);
    setHasError(false);
    void getProducts(query)
      .then(setResult)
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  }, [category, keyword, sort]);

  return (
    <div className="wrap py-14 md:py-20">
      <p className="eyebrow">THE COLLECTION</p>
      <h1 className="serif mt-4 text-5xl">酒を選ぶ</h1>
      <div className="mt-12 grid gap-x-7 gap-y-6 border-y line py-7 md:grid-cols-3">
        <label className="text-xs">
          キーワード検索
          <input
            className="input mt-1"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="商品名・蔵元・産地"
          />
        </label>
        <label className="text-xs">
          カテゴリー
          <select
            className="input mt-1 block"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">すべて</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          並び順
          <select
            className="input mt-1 block"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recommended">おすすめ順</option>
            <option value="price_asc">価格が低い順</option>
            <option value="price_desc">価格が高い順</option>
            <option value="newest">新着順</option>
          </select>
        </label>
      </div>
      <p className="mt-8 text-xs text-stone-500">
        {result.pagination.total} ITEMS
      </p>
      <AgeNotice className="mt-3" />
      {isLoading ? <BrandLoader label="商品を読み込んでいます" /> : null}
      {hasError ? (
        <p className="py-20 text-center text-sm text-stone-500">
          商品を読み込めませんでした。時間をおいて再度お試しください。
        </p>
      ) : null}
      {!isLoading && !hasError && result.items.length === 0 ? (
        <BrandEmptyState
          title="該当する商品がありません"
          description="検索条件を少し変えて、もう一度お試しください。"
          href="/products"
          linkLabel="条件をリセット"
        />
      ) : null}
      {!isLoading && !hasError && result.items.length > 0 ? (
        <div className="mt-8 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
