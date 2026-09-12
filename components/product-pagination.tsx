'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  buildPublicProductListHref,
  getPublicProductPageItems,
  getPublicProductPaginationState,
  getPublicProductRange,
  PUBLIC_PRODUCT_PER_PAGE_OPTIONS,
} from '@/config/public-product-pagination';
import type { ProductListResult } from '@/types/product';

type Pagination = ProductListResult['pagination'];

const PageLink = ({
  currentSearch,
  page,
  children,
  current = false,
}: {
  currentSearch: string;
  page: number;
  children: React.ReactNode;
  current?: boolean;
}) => (
  <Link
    href={buildPublicProductListHref(currentSearch, { page })}
    scroll={false}
    aria-current={current ? 'page' : undefined}
    className={`inline-flex min-h-9 min-w-9 items-center justify-center border-b text-xs transition-colors ${
      current
        ? 'border-[#6d2227] text-[#6d2227]'
        : 'border-transparent hover:border-[#171412]'
    }`}
  >
    {children}
  </Link>
);

const DirectionLink = ({
  currentSearch,
  page,
  disabled,
  children,
}: {
  currentSearch: string;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) =>
  disabled ? (
    <span
      aria-disabled="true"
      className="inline-flex min-h-9 items-center text-xs text-stone-300"
    >
      {children}
    </span>
  ) : (
    <Link
      href={buildPublicProductListHref(currentSearch, { page })}
      scroll={false}
      className="inline-flex min-h-9 items-center text-xs transition-colors hover:text-[#6d2227]"
    >
      {children}
    </Link>
  );

function PerPageSelect({
  currentSearch,
  perPage,
}: {
  currentSearch: string;
  perPage: number;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-3 text-xs text-stone-500">
      表示件数
      <select
        aria-label="表示件数"
        className="border-b line bg-transparent px-2 py-2 text-[#171412] outline-none"
        value={perPage}
        onChange={(event) =>
          router.push(
            buildPublicProductListHref(
              currentSearch,
              { perPage: Number(event.target.value) },
              { resetPage: true },
            ),
            { scroll: false },
          )
        }
      >
        {PUBLIC_PRODUCT_PER_PAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProductPagination({
  pagination,
  currentSearch,
}: {
  pagination: Pagination;
  currentSearch: string;
}) {
  const { page, limit: perPage, total, totalPages } = pagination;
  const range = getPublicProductRange(page, perPage, total);
  const pageItems = getPublicProductPageItems(page, totalPages);
  const { previousDisabled, nextDisabled } = getPublicProductPaginationState(
    page,
    totalPages,
  );

  if (total === 0) return null;

  return (
    <nav
      aria-label="商品一覧のページ"
      className="mt-16 border-t line pt-8 md:mt-20"
    >
      <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-8 md:grid">
        <p className="text-xs text-stone-500">
          {range.start}–{range.end} / {total} ITEMS
        </p>
        <div className="flex items-center gap-3">
          <DirectionLink
            currentSearch={currentSearch}
            page={page - 1}
            disabled={previousDisabled}
          >
            ← 前へ
          </DirectionLink>
          <div className="flex items-center gap-1">
            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  aria-hidden="true"
                  className="inline-flex min-w-7 justify-center text-stone-400"
                >
                  …
                </span>
              ) : (
                <PageLink
                  key={item}
                  currentSearch={currentSearch}
                  page={item}
                  current={item === page}
                >
                  {item}
                </PageLink>
              ),
            )}
          </div>
          <DirectionLink
            currentSearch={currentSearch}
            page={page + 1}
            disabled={nextDisabled}
          >
            次へ →
          </DirectionLink>
        </div>
        <div className="justify-self-end">
          <PerPageSelect currentSearch={currentSearch} perPage={perPage} />
        </div>
      </div>

      <div className="grid gap-6 md:hidden">
        <div className="flex items-center justify-between">
          <DirectionLink
            currentSearch={currentSearch}
            page={page - 1}
            disabled={previousDisabled}
          >
            ←
          </DirectionLink>
          <span className="text-xs">
            {page} / {totalPages}
          </span>
          <DirectionLink
            currentSearch={currentSearch}
            page={page + 1}
            disabled={nextDisabled}
          >
            →
          </DirectionLink>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-500">
            {range.start}–{range.end} / {total} ITEMS
          </p>
          <PerPageSelect currentSearch={currentSearch} perPage={perPage} />
        </div>
      </div>
    </nav>
  );
}
