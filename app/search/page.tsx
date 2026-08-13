'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { searchProducts } from '@/lib/product-api';
import type { ProductListResult } from '@/types/product';

const INITIAL_RESULT: ProductListResult = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchCollection />
    </Suspense>
  );
}

function SearchCollection() {
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '');
  const [submittedKeyword, setSubmittedKeyword] = useState(
    searchParams.get('keyword') ?? '',
  );
  const [result, setResult] = useState<ProductListResult>(INITIAL_RESULT);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!submittedKeyword) return;

    setIsLoading(true);
    void searchProducts(
      new URLSearchParams({
        keyword: submittedKeyword,
        page: '1',
        limit: '20',
      }),
    )
      .then(setResult)
      .catch(() => setResult(INITIAL_RESULT))
      .finally(() => setIsLoading(false));
  }, [submittedKeyword]);

  return (
    <div className="wrap py-14 md:py-20">
      <p className="eyebrow">SEARCH THE COLLECTION</p>
      <h1 className="serif mt-4 text-5xl">商品を探す</h1>
      <form
        noValidate
        className="mt-12 flex gap-3 border-y line py-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedKeyword(keyword.trim());
        }}
      >
        <input
          className="input flex-1"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="商品名・蔵元・産地・商品コード"
        />
        <button className="btn">検索</button>
      </form>
      {isLoading ? (
        <p className="py-20 text-center text-sm text-stone-500">検索中です。</p>
      ) : null}
      {!isLoading && submittedKeyword && result.items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="serif text-2xl">該当する商品がありません</p>
          <p className="mt-3 text-sm text-stone-500">
            別のキーワードでお試しください。
          </p>
        </div>
      ) : null}
      {!isLoading && result.items.length > 0 ? (
        <div className="mt-10 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
