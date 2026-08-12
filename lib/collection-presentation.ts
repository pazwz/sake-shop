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
