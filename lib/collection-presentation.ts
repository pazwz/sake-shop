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

export const statusLabels: Record<string, string> = {
  PUBLISHED: '公開中',
  DRAFT: '下書き',
  ARCHIVED: 'アーカイブ',
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

export const getEffectiveStatusLabel = ({
  status,
  publishStartAt,
  publishEndAt,
  now = new Date(),
}: {
  status: string;
  publishStartAt: Date | string | null;
  publishEndAt: Date | string | null;
  now?: Date;
}) => {
  if (status !== 'PUBLISHED') return statusLabels[status] ?? status;
  if (publishStartAt && new Date(publishStartAt) > now) return '公開予定';
  if (publishEndAt && new Date(publishEndAt) <= now) return '公開終了';
  return '公開中';
};
