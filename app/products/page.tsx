'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { getProducts } from '@/lib/product-api';
import type { ProductListResult } from '@/types/product';
import { BrandLoader } from '@/components/brand-loader';
import { BrandEmptyState } from '@/components/brand-empty-state';
import { AgeNotice } from '@/components/age-notice';
import { ProductPagination } from '@/components/product-pagination';
import {
  buildPublicProductGroupHref,
  getPublicProductGroupSelectValue,
  PUBLIC_PRODUCT_NAVIGATION,
} from '@/config/public-navigation';
import {
  buildPublicProductListHref,
  getPublicProductPage,
  getPublicProductPerPage,
  getPublicProductSort,
  PUBLIC_PRODUCT_DEFAULT_PER_PAGE,
} from '@/config/public-product-pagination';

const INITIAL_RESULT: ProductListResult = {
  items: [],
  pagination: {
    page: 1,
    limit: PUBLIC_PRODUCT_DEFAULT_PER_PAGE,
    total: 0,
    totalPages: 0,
  },
};

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsCollection />
    </Suspense>
  );
}

function ProductsCollection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const routeCategory = searchParams.get('category') ?? '';
  const routeGroup = getPublicProductGroupSelectValue(
    searchParams.get('group'),
  );
  const routeKeyword =
    searchParams.get('keyword') ?? searchParams.get('q') ?? '';
  const rawPage = searchParams.get('page');
  const rawPerPage = searchParams.get('perPage');
  const routePage = getPublicProductPage(rawPage);
  const routePerPage = getPublicProductPerPage(rawPerPage);
  const routeSort = getPublicProductSort(searchParams.get('sort'));
  const [result, setResult] = useState<ProductListResult>(INITIAL_RESULT);
  const [keyword, setKeyword] = useState(routeKeyword);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const resultTopRef = useRef<HTMLParagraphElement>(null);
  const loadedPageRef = useRef<number | null>(null);

  useEffect(() => setKeyword(routeKeyword), [routeKeyword]);

  useEffect(() => {
    if (keyword === routeKeyword) return;
    const timeout = window.setTimeout(() => {
      router.replace(
        buildPublicProductListHref(
          currentSearch,
          { keyword },
          { resetPage: true },
        ),
        { scroll: false },
      );
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [currentSearch, keyword, routeKeyword, router]);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      page: String(routePage),
      limit: String(routePerPage),
      sort: routeSort,
    });
    if (routeKeyword) query.set('keyword', routeKeyword);
    if (routeCategory) query.set('category', routeCategory);
    if (routeGroup) query.set('group', routeGroup);

    setIsLoading(true);
    setHasError(false);
    void getProducts(query)
      .then((nextResult) => {
        if (!active) return;
        setResult(nextResult);
        const shouldNormalizePage =
          nextResult.pagination.page !== routePage ||
          (rawPage !== null &&
            (routePage === 1 || rawPage !== String(routePage)));
        const shouldNormalizePerPage =
          rawPerPage !== null &&
          (routePerPage === PUBLIC_PRODUCT_DEFAULT_PER_PAGE ||
            rawPerPage !== String(routePerPage));
        if (shouldNormalizePage || shouldNormalizePerPage) {
          router.replace(
            buildPublicProductListHref(currentSearch, {
              page: nextResult.pagination.page,
              perPage: routePerPage,
            }),
            { scroll: false },
          );
        }
        if (
          loadedPageRef.current !== null &&
          loadedPageRef.current !== nextResult.pagination.page
        ) {
          resultTopRef.current?.scrollIntoView({ block: 'start' });
        }
        loadedPageRef.current = nextResult.pagination.page;
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    routeCategory,
    routeGroup,
    routeKeyword,
    routePage,
    routePerPage,
    routeSort,
    rawPage,
    rawPerPage,
    router,
    currentSearch,
  ]);

  return (
    <div className="storefront-results">
      <div className="storefront-results-inner">
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
              value={routeGroup}
              onChange={(event) =>
                router.push(
                  buildPublicProductGroupHref(
                    currentSearch,
                    event.target.value,
                  ),
                )
              }
            >
              <option value="">すべて</option>
              {PUBLIC_PRODUCT_NAVIGATION.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            並び順
            <select
              className="input mt-1 block"
              value={routeSort}
              onChange={(event) =>
                router.push(
                  buildPublicProductListHref(
                    currentSearch,
                    { sort: event.target.value },
                    { resetPage: true },
                  ),
                  { scroll: false },
                )
              }
            >
              <option value="recommended">おすすめ順</option>
              <option value="price_asc">価格が低い順</option>
              <option value="price_desc">価格が高い順</option>
              <option value="newest">新着順</option>
            </select>
          </label>
        </div>
        <p
          ref={resultTopRef}
          className="mt-8 scroll-mt-32 text-xs text-stone-500"
        >
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
          <div className="product-results-grid mt-10">
            {result.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : null}
        {!isLoading && !hasError ? (
          <ProductPagination
            pagination={result.pagination}
            currentSearch={currentSearch}
          />
        ) : null}
      </div>
    </div>
  );
}
