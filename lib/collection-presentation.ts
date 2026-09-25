import { getPublicCollectionPath } from '@/config/collections';

export const collectionTypeLabels: Record<string, string> = {
  HERO: 'メインビジュアル',
  SEASONAL: '季節の特集',
  SHOPKEEPER: '店主のおすすめ',
  GIFT: 'ギフト',
  EDITORIAL: '特集記事',
  STORY: 'ストーリー',
};

export const seasonLabels: Record<string, string> = {
  SPRING: '春',
  SUMMER: '夏',
  AUTUMN: '秋',
  WINTER: '冬',
};

export const getCollectionAreaLabel = (
  type: string,
  season?: string | null,
) => {
  if (type === 'SEASONAL' && season) {
    return `季節の特集（${seasonLabels[season] ?? season}）`;
  }
  return collectionTypeLabels[type] ?? 'ホームページコンテンツ';
};

type CollectionPlacement = {
  type: string;
  affectedArea: string;
  publicPath: string | null;
  productSelectionAffectsProductGrid: boolean;
  productSelectionDescription: string;
};

export const getCollectionPlacement = (
  type: string,
  season?: string | null,
  id = 'collection',
): CollectionPlacement => {
  const seasonLabel = season ? (seasonLabels[season] ?? season) : null;
  const publicPath = getPublicCollectionPath({
    id,
    type,
    season: season as 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER' | null,
  });

  if (type === 'HERO') {
    return {
      type: 'HERO',
      affectedArea: 'トップページ「メインビジュアル」',
      publicPath: null,
      productSelectionAffectsProductGrid: false,
      productSelectionDescription:
        '商品設定はトップページの「季節のおすすめ」には反映されません。',
    };
  }

  if (type === 'SEASONAL') {
    return {
      type: `SEASONAL${seasonLabel ? ` / ${seasonLabel}` : ''}`,
      affectedArea: `トップページ「季節のおすすめ${seasonLabel ? `（${seasonLabel}）` : ''}」`,
      publicPath,
      productSelectionAffectsProductGrid: true,
      productSelectionDescription:
        '選択した商品はトップページと季節の特集ページに表示されます。',
    };
  }

  return {
    type: collectionTypeLabels[type] ?? type,
    affectedArea:
      type === 'SHOPKEEPER'
        ? 'トップページ「店主のおすすめ」'
        : type === 'GIFT'
          ? 'トップページ「ギフトにおすすめ」'
          : type === 'EDITORIAL'
            ? 'トップページ「今月の特集」'
            : type === 'STORY'
              ? 'トップページ「ストーリー」'
              : 'ホームページコンテンツ',
    publicPath,
    productSelectionAffectsProductGrid: true,
    productSelectionDescription:
      '選択した商品はこのコンテンツの公開ページに表示されます。',
  };
};
