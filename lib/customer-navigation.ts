export const safeCustomerRedirect = (
  value: string | null,
  fallback = '/account',
) => (value?.startsWith('/') && !value.startsWith('//') ? value : fallback);
