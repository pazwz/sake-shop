export const PUBLIC_PRODUCT_NAVIGATION_IDS = [
  'sake',
  'whisky',
  'wine-champagne',
  'shochu',
  'brandy-spirits',
] as const;

export type PublicProductNavigationId =
  (typeof PUBLIC_PRODUCT_NAVIGATION_IDS)[number];

export type PublicProductNavigationDefinition = {
  id: PublicProductNavigationId;
  label: string;
  href: string;
  terms: readonly string[];
};

export const PUBLIC_PRODUCT_NAVIGATION = [
  {
    id: 'sake',
    label: '日本酒',
    href: '/products?group=sake',
    terms: ['日本酒', '純米', '吟醸', '大吟醸'],
  },
  {
    id: 'whisky',
    label: 'ウイスキー',
    href: '/products?group=whisky',
    terms: ['ウイスキー', 'スコッチ', 'バーボン', 'アメリカン'],
  },
  {
    id: 'wine-champagne',
    label: 'ワイン・シャンパン',
    href: '/products?group=wine-champagne',
    terms: ['ワイン', 'シャンパン', 'ロゼ'],
  },
  {
    id: 'shochu',
    label: '焼酎',
    href: '/products?group=shochu',
    terms: ['焼酎'],
  },
  {
    id: 'brandy-spirits',
    label: 'ブランデー・スピリッツ',
    href: '/products?group=brandy-spirits',
    terms: [
      'ブランデー',
      'ブランディ',
      'コニャック',
      'テキーラ',
      'メスカル',
      'スピリッツ',
      'ジン',
      'ラム',
      'ウォッカ',
    ],
  },
] as const satisfies readonly PublicProductNavigationDefinition[];

export const PUBLIC_FEATURE_NAVIGATION = {
  id: 'features',
  label: '特集',
  href: '/collections/seasonal',
} as const;

export const PUBLIC_EXPLORE_NAVIGATION = [
  ...PUBLIC_PRODUCT_NAVIGATION.map(({ id, label, href }) => ({
    id,
    label,
    href,
  })),
  PUBLIC_FEATURE_NAVIGATION,
] as const;

export const getPublicProductNavigation = (id: string | null | undefined) =>
  PUBLIC_PRODUCT_NAVIGATION.find((definition) => definition.id === id);

export const getPublicProductGroupSelectValue = (
  id: string | null | undefined,
) => getPublicProductNavigation(id)?.id ?? '';

export const buildPublicProductGroupHref = (
  currentSearch: string,
  nextGroup: string,
) => {
  const search = new URLSearchParams(currentSearch);
  const group = getPublicProductNavigation(nextGroup);

  if (group) search.set('group', group.id);
  else search.delete('group');

  search.delete('category');
  search.delete('subcategory');
  search.delete('page');

  const query = search.toString();
  return query ? `/products?${query}` : '/products';
};
