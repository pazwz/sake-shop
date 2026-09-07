const ADMIN_PRODUCTS_PATH = '/admin/products';
const allowedReturnToParams = new Set([
  'q',
  'category',
  'ecStatus',
  'source',
  'imageStatus',
  'page',
]);
const allowedImageStatuses = new Set(['all', 'with', 'without']);

export const sanitizeAdminProductsReturnTo = (value: string | undefined) => {
  if (!value || value.startsWith('//')) return ADMIN_PRODUCTS_PATH;

  try {
    const url = new URL(value, 'https://admin-navigation.invalid');
    if (
      url.origin !== 'https://admin-navigation.invalid' ||
      url.pathname !== ADMIN_PRODUCTS_PATH ||
      url.hash ||
      [...url.searchParams.keys()].some(
        (key) => !allowedReturnToParams.has(key),
      ) ||
      (url.searchParams.has('imageStatus') &&
        !allowedImageStatuses.has(url.searchParams.get('imageStatus') ?? ''))
    ) {
      return ADMIN_PRODUCTS_PATH;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return ADMIN_PRODUCTS_PATH;
  }
};

export const createAdminProductEditHref = (
  productId: string,
  returnTo: string,
) =>
  `/admin/products/${encodeURIComponent(productId)}?${new URLSearchParams({ returnTo })}`;
