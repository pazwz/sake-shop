import type { ProductIdentityType } from '@/types/product-identity';

export type ProductBrandIdentity = {
  canonicalName: string;
  aliases: {
    japanese?: string[];
    kana?: string[];
    romaji?: string[];
    english?: string[];
    chinese?: string[];
  };
  productAliases?: Record<string, string[]>;
  producerNames?: string[];
  officialDomains?: string[];
  identityType?: ProductIdentityType;
  vintageAwareProducts?: string[];
};

export const PRODUCT_BRAND_IDENTITIES: readonly ProductBrandIdentity[] = [
  {
    canonicalName: '産土',
    aliases: {
      japanese: ['産土'],
      kana: ['うぶすな'],
      romaji: ['Ubusuna'],
    },
    productAliases: {
      香子: ['香子', 'かばしこ', 'Kabashiko'],
    },
    producerNames: ['花の香酒造'],
    officialDomains: ['hananoka.co.jp'],
    identityType: 'SAKE',
  },
  {
    canonicalName: '而今',
    aliases: {
      japanese: ['而今'],
      kana: ['じこん'],
      romaji: ['Jikon'],
    },
    producerNames: ['木屋正酒造'],
    identityType: 'SAKE',
  },
  {
    canonicalName: '十四代',
    aliases: {
      japanese: ['十四代'],
      kana: ['じゅうよんだい'],
      romaji: ['Juyondai'],
    },
    identityType: 'SAKE',
  },
  {
    canonicalName: '新政',
    aliases: {
      japanese: ['新政'],
      kana: ['あらまさ'],
      romaji: ['Aramasa'],
    },
    identityType: 'SAKE',
  },
  {
    canonicalName: '獺祭',
    aliases: {
      japanese: ['獺祭'],
      kana: ['だっさい'],
      romaji: ['Dassai'],
    },
    identityType: 'SAKE',
  },
  {
    canonicalName: '鍋島',
    aliases: {
      japanese: ['鍋島'],
      kana: ['なべしま'],
      romaji: ['Nabeshima'],
    },
    identityType: 'SAKE',
  },
  {
    canonicalName: 'KENZO ESTATE',
    aliases: {
      japanese: [
        'ケンゾーエステート',
        'ケンゾー エステート',
        'ケンゾー・エステート',
        'ケンゾーエステイト',
      ],
      english: ['KENZO ESTATE', 'Kenzo Estate'],
    },
    productAliases: {
      あさつゆ: ['あさつゆ', 'asatsuyu'],
      明日香: ['明日香', 'asuka'],
      深穏: ['深穏', 'shinon'],
    },
    officialDomains: ['kenzoestate.jp', 'kenzoestate.com'],
    identityType: 'VINTAGE_WINE',
    vintageAwareProducts: [
      'あさつゆ',
      '明日香',
      '深穏',
      'asatsuyu',
      'asuka',
      'shinon',
    ],
  },
  {
    canonicalName: '山崎',
    aliases: {
      japanese: ['山崎'],
      english: ['Yamazaki', 'Suntory Yamazaki'],
    },
    producerNames: ['サントリー 山崎蒸溜所', 'Suntory'],
    officialDomains: ['suntory.co.jp', 'house.suntory.com'],
  },
  {
    canonicalName: '白州',
    aliases: {
      japanese: ['白州'],
      english: ['Hakushu', 'Suntory Hakushu'],
    },
    producerNames: ['サントリー 白州蒸溜所', 'Suntory'],
    officialDomains: ['suntory.co.jp', 'house.suntory.com'],
  },
  {
    canonicalName: '響',
    aliases: {
      japanese: ['響'],
      english: ['Hibiki', 'Suntory Hibiki'],
    },
    producerNames: ['サントリー', 'Suntory'],
    productAliases: {
      マスターズセレクト: [
        'マスターズ',
        'マスターズセレクト',
        'Masters Select',
      ],
    },
    officialDomains: ['suntory.co.jp', 'house.suntory.com'],
  },
  {
    canonicalName: 'キルケラン',
    aliases: {
      japanese: ['キルケラン'],
      english: ['Kilkerran'],
    },
    producerNames: ['Glengyle Distillery'],
    identityType: 'BATCH_RELEASE',
  },
  {
    canonicalName: 'ウィリアム ラルー ウェラー',
    aliases: {
      japanese: ['ウィリアム ラルー ウェラー', 'ウィリアム ラルウェラー'],
      english: ['William Larue Weller'],
    },
    identityType: 'BATCH_RELEASE',
  },
  {
    canonicalName: 'スタッグ',
    aliases: {
      japanese: ['スタッグ'],
      english: ['Stagg', 'Stagg Jr.'],
    },
    identityType: 'BATCH_RELEASE',
  },
  {
    canonicalName: 'ロングロウ',
    aliases: {
      japanese: ['ロングロウ'],
      english: ['Longrow'],
    },
    identityType: 'BATCH_RELEASE',
  },
  {
    canonicalName: 'モエ・エ・シャンドン',
    aliases: {
      japanese: ['モエ', 'モエ・エ・シャンドン'],
      english: ['Moet', 'Moët', 'Moet & Chandon', 'Moët & Chandon'],
    },
  },
  {
    canonicalName: 'ドン ペリニヨン',
    aliases: {
      japanese: ['ドンペリニヨン', 'ドン ペリニヨン'],
      english: ['Dom Perignon', 'Dom Pérignon'],
    },
    vintageAwareProducts: ['Luminous', 'ルミナス'],
  },
  {
    canonicalName: 'ルイ・ロデレール',
    aliases: {
      japanese: ['ルイロデレール', 'ルイ・ロデレール'],
      english: ['Louis Roederer'],
    },
    productAliases: {
      'クリスタル ロゼ': ['クリスタル ロゼ', 'Cristal Rosé', 'Cristal Rose'],
    },
    vintageAwareProducts: ['クリスタル ロゼ', 'Cristal Rosé', 'Cristal Rose'],
  },
  {
    canonicalName: 'エンジェル シャンパン',
    aliases: {
      japanese: ['エンジェル', 'エンジェル シャンパン'],
      english: ['ANGEL CHAMPAGNE', 'Angel Champagne'],
    },
  },
  {
    canonicalName: 'カヴァ・デ・オロ',
    aliases: {
      japanese: ['カヴァデオロ', 'カヴァ・デ・オロ'],
      english: ['Cava de Oro'],
    },
  },
] as const;

export const PRODUCT_IMAGE_DISCOVERY_SOURCE_PRIORITY = [
  'PRODUCER_OFFICIAL',
  'BRAND_OFFICIAL',
  'OFFICIAL_ARCHIVE',
  'OFFICIAL_SHOP',
  'IMPORTER_DISTRIBUTOR',
  'AMAZON',
  'RAKUTEN',
  'YAHOO_SHOPPING',
  'JAPANESE_SPECIALIST_RETAILER',
  'OVERSEAS_REGULAR_RETAILER',
  'IMAGE_SEARCH',
  'TAOBAO_TMALL_JD',
] as const;

export const GENERIC_PRODUCT_NAMES = [
  'マム',
  'ミニチュア',
  'ランボルギーニ',
  '酒',
  '赤',
  '白',
  'ワイン',
  'ウイスキー',
  '日本酒',
] as const;
