export const PUBLIC_PRODUCT_DEFAULT_PAGE = 1;
export const PUBLIC_PRODUCT_DEFAULT_PER_PAGE = 24;
export const PUBLIC_PRODUCT_PER_PAGE_OPTIONS = [24, 48, 96] as const;
export const PUBLIC_PRODUCT_SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'newest',
] as const;

export type PublicProductPerPage =
  (typeof PUBLIC_PRODUCT_PER_PAGE_OPTIONS)[number];

export type PublicProductPageItem = number | 'ellipsis';

const parsePositiveInteger = (value: string | null | undefined) => {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getPublicProductPage = (value: string | null | undefined) =>
  parsePositiveInteger(value) ?? PUBLIC_PRODUCT_DEFAULT_PAGE;

export const getPublicProductPerPage = (
  value: string | null | undefined,
): PublicProductPerPage => {
  const parsed = parsePositiveInteger(value);
  return (
    PUBLIC_PRODUCT_PER_PAGE_OPTIONS.find((option) => option === parsed) ??
    PUBLIC_PRODUCT_DEFAULT_PER_PAGE
  );
};

export const getPublicProductSort = (value: string | null | undefined) =>
  PUBLIC_PRODUCT_SORT_OPTIONS.find((option) => option === value) ??
  'recommended';

export const buildPublicProductListHref = (
  currentSearch: string,
  updates: {
    page?: number;
    perPage?: number;
    keyword?: string;
    sort?: string;
  },
  options: { resetPage?: boolean } = {},
) => {
  const search = new URLSearchParams(currentSearch);

  if (options.resetPage) search.delete('page');

  if (updates.page !== undefined) {
    if (updates.page > PUBLIC_PRODUCT_DEFAULT_PAGE) {
      search.set('page', String(updates.page));
    } else {
      search.delete('page');
    }
  }

  if (updates.perPage !== undefined) {
    const perPage = getPublicProductPerPage(String(updates.perPage));
    if (perPage === PUBLIC_PRODUCT_DEFAULT_PER_PAGE) {
      search.delete('perPage');
    } else {
      search.set('perPage', String(perPage));
    }
  }

  if (updates.keyword !== undefined) {
    search.delete('keyword');
    const keyword = updates.keyword.trim();
    if (keyword) search.set('q', keyword);
    else search.delete('q');
  }

  if (updates.sort !== undefined) {
    if (updates.sort === 'recommended') search.delete('sort');
    else search.set('sort', updates.sort);
  }

  const query = search.toString();
  return query ? `/products?${query}` : '/products';
};

export const getPublicProductPageItems = (
  currentPage: number,
  totalPages: number,
): PublicProductPageItem[] => {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      ...Array.from({ length: 5 }, (_, index) => totalPages - 4 + index),
    ];
  }
  return [
    1,
    'ellipsis',
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    'ellipsis',
    totalPages,
  ];
};

export const getPublicProductRange = (
  page: number,
  perPage: number,
  totalItems: number,
) => ({
  start: totalItems === 0 ? 0 : (page - 1) * perPage + 1,
  end: Math.min(page * perPage, totalItems),
});

export const getPublicProductEffectivePage = (
  requestedPage: number,
  totalItems: number,
  perPage: number,
) => Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / perPage)));

export const getPublicProductPaginationState = (
  page: number,
  totalPages: number,
) => ({
  previousDisabled: page <= 1 || totalPages === 0,
  nextDisabled: page >= totalPages || totalPages === 0,
});
