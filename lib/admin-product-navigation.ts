const ADMIN_PRODUCTS_PATH = '/admin/products';
const allowedReturnToParams = new Set([
  'q',
  'category',
  'ecStatus',
  'source',
  'imageStatus',
  'metadataStatus',
  'missingField',
  'page',
]);
const allowedImageStatuses = new Set(['all', 'with', 'without']);
const allowedEcStatuses = new Set([
  'all',
  'published',
  'preparing',
  'hidden',
  'excluded',
  'retired',
]);
const allowedMetadataStatuses = new Set([
  'all',
  'core_incomplete',
  'complete',
  'optional_incomplete',
]);
const allowedMissingFields = new Set([
  'all',
  'producer',
  'origin',
  'volume',
  'alcoholPercentage',
  'description',
  'image',
  'tastingNotes',
]);

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
        !allowedImageStatuses.has(url.searchParams.get('imageStatus') ?? '')) ||
      (url.searchParams.has('ecStatus') &&
        !allowedEcStatuses.has(url.searchParams.get('ecStatus') ?? '')) ||
      (url.searchParams.has('metadataStatus') &&
        !allowedMetadataStatuses.has(
          url.searchParams.get('metadataStatus') ?? '',
        )) ||
      (url.searchParams.has('missingField') &&
        !allowedMissingFields.has(url.searchParams.get('missingField') ?? ''))
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
