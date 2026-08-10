export const toExternalSlug = (prefix: string, code: string, id: string) => {
  const normalized = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${prefix}-${normalized || id.toLowerCase()}`;
};
