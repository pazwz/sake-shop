import { AdminRole } from '@prisma/client';

export const developmentSeedAdmin = {
  email: 'owner@kura.local',
  name: 'KURA Development Owner',
  role: AdminRole.OWNER,
  isActive: true,
} as const;

export const developmentSeedAdminAccessAccounts = [
  {
    email: 'manager@kura.local',
    name: 'KURA Development Manager',
    role: AdminRole.MANAGER,
    isActive: true,
  },
  {
    email: 'staff@kura.local',
    name: 'KURA Development Staff',
    role: AdminRole.STAFF,
    isActive: true,
  },
  {
    email: 'disabled@kura.local',
    name: 'KURA Disabled Admin',
    role: AdminRole.MANAGER,
    isActive: false,
  },
] as const;

export const developmentSeedAdminWithoutPassword = {
  email: 'unconfigured@kura.local',
  name: 'KURA Unconfigured Admin',
  role: AdminRole.STAFF,
  isActive: true,
} as const;

export const developmentSeedCategories = [
  { slug: 'sake', name: '日本酒', displayOrder: 1 },
  { slug: 'whisky', name: 'ウイスキー', displayOrder: 2 },
  { slug: 'wine', name: 'ワイン', displayOrder: 3 },
] as const;

export const developmentSeedSubcategories = [
  {
    slug: 'junmai-daiginjo',
    name: '純米大吟醸',
    parentSlug: 'sake',
    displayOrder: 1,
  },
  {
    slug: 'junmai-ginjo',
    name: '純米吟醸',
    parentSlug: 'sake',
    displayOrder: 2,
  },
  {
    slug: 'single-malt',
    name: 'シングルモルト',
    parentSlug: 'whisky',
    displayOrder: 1,
  },
  { slug: 'red-wine', name: '赤ワイン', parentSlug: 'wine', displayOrder: 1 },
  { slug: 'white-wine', name: '白ワイン', parentSlug: 'wine', displayOrder: 2 },
] as const;

export const developmentSeedProducts = [
  {
    slug: 'dev-yukitsubaki-junmai-daiginjo',
    smaregiProductId: 'dev-smaregi-001',
    productCode: 'DEV-SAKE-001',
    categorySlug: 'junmai-daiginjo',
    name: '雪椿 純米大吟醸',
    producer: '雪椿酒造',
    origin: '新潟県',
    price: 6600,
    taxRate: 10,
    volume: '720ml',
    alcoholPercentage: 16,
    description: '新潟の清冽な水と米を用いた、華やかで端正な純米大吟醸です。',
    tastingNotes: '白桃、白い花、やわらかな米の旨味。',
    imageUrl:
      'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=1200&q=85',
    quantity: 18,
    reservedQuantity: 2,
  },
  {
    slug: 'dev-kaze-no-mori-akitsuho',
    smaregiProductId: 'dev-smaregi-002',
    productCode: 'DEV-SAKE-002',
    categorySlug: 'junmai-ginjo',
    name: '風の森 秋津穂 807',
    producer: '油長酒造',
    origin: '奈良県',
    price: 1870,
    taxRate: 10,
    volume: '720ml',
    alcoholPercentage: 16,
    description:
      '瑞々しい酸と軽快な旨味を楽しめる、食中酒にもおすすめの一本です。',
    tastingNotes: '青リンゴ、柑橘、フレッシュな酸味。',
    imageUrl:
      'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=1200&q=85',
    quantity: 12,
    reservedQuantity: 0,
  },
  {
    slug: 'dev-kokuryu-daiginjo',
    smaregiProductId: 'dev-smaregi-003',
    productCode: 'DEV-SAKE-003',
    categorySlug: 'junmai-daiginjo',
    name: '黒龍 大吟醸 龍',
    producer: '黒龍酒造',
    origin: '福井県',
    price: 13200,
    taxRate: 10,
    volume: '720ml',
    alcoholPercentage: 16,
    description: '繊細な香りと透明感のある余韻が印象的な大吟醸です。',
    tastingNotes: '洋梨、白い花、上品な米の甘み。',
    imageUrl:
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1200&q=85',
    quantity: 8,
    reservedQuantity: 1,
  },
  {
    slug: 'dev-hakushu-12-years',
    smaregiProductId: 'dev-smaregi-004',
    productCode: 'DEV-WHS-001',
    categorySlug: 'single-malt',
    name: '白州 12年',
    producer: '白州蒸溜所',
    origin: '山梨県',
    price: 15400,
    taxRate: 10,
    volume: '700ml',
    alcoholPercentage: 43,
    description:
      '森の蒸溜所ならではの、爽やかで穏やかなスモーキーさを持つシングルモルトです。',
    tastingNotes: '青りんご、ハーブ、淡いスモーク。',
    imageUrl:
      'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1200&q=85',
    quantity: 5,
    reservedQuantity: 1,
  },
  {
    slug: 'dev-yoichi-single-malt',
    smaregiProductId: 'dev-smaregi-005',
    productCode: 'DEV-WHS-002',
    categorySlug: 'single-malt',
    name: '余市 シングルモルト',
    producer: '余市蒸溜所',
    origin: '北海道',
    price: 7700,
    taxRate: 10,
    volume: '700ml',
    alcoholPercentage: 45,
    description:
      '力強い麦芽の香りと、しっかりした余韻を備えたシングルモルトです。',
    tastingNotes: '麦芽、ドライフルーツ、心地よいピート。',
    imageUrl:
      'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=1200&q=85',
    quantity: 9,
    reservedQuantity: 0,
  },
  {
    slug: 'dev-kanosuke-single-malt',
    smaregiProductId: 'dev-smaregi-006',
    productCode: 'DEV-WHS-003',
    categorySlug: 'single-malt',
    name: '嘉之助 シングルモルト',
    producer: '嘉之助蒸溜所',
    origin: '鹿児島県',
    price: 9900,
    taxRate: 10,
    volume: '700ml',
    alcoholPercentage: 48,
    description:
      '海辺の蒸溜所が生み出す、まろやかな口当たりのシングルモルトです。',
    tastingNotes: 'バニラ、潮風、ほのかなスモーク。',
    imageUrl:
      'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=1200&q=85',
    quantity: 11,
    reservedQuantity: 3,
  },
  {
    slug: 'dev-kenzo-estate-rindo-2020',
    smaregiProductId: 'dev-smaregi-007',
    productCode: 'DEV-WIN-001',
    categorySlug: 'red-wine',
    name: '紫鈴 rindo 2020',
    producer: 'ケンゾーエステート',
    origin: '山梨県',
    price: 16500,
    taxRate: 10,
    volume: '750ml',
    alcoholPercentage: 14,
    description: '豊かな果実味と滑らかなタンニンが調和する赤ワインです。',
    tastingNotes: 'カシス、黒胡椒、なめらかな余韻。',
    imageUrl:
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=85',
    quantity: 6,
    reservedQuantity: 0,
  },
  {
    slug: 'dev-obuse-chardonnay',
    smaregiProductId: 'dev-smaregi-008',
    productCode: 'DEV-WIN-002',
    categorySlug: 'white-wine',
    name: '小布施ワイナリー シャルドネ',
    producer: '小布施ワイナリー',
    origin: '長野県',
    price: 6380,
    taxRate: 10,
    volume: '750ml',
    alcoholPercentage: 12,
    description: '凛とした酸と果実の厚みを感じる、食卓に寄り添う白ワインです。',
    tastingNotes: 'レモン、白桃、ミネラル。',
    imageUrl:
      'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=85',
    quantity: 14,
    reservedQuantity: 2,
  },
  {
    slug: 'dev-tomi-red-2018',
    smaregiProductId: 'dev-smaregi-009',
    productCode: 'DEV-WIN-003',
    categorySlug: 'red-wine',
    name: '登美 赤 2018',
    producer: '登美の丘ワイナリー',
    origin: '山梨県',
    price: 11000,
    taxRate: 10,
    volume: '750ml',
    alcoholPercentage: 13,
    description: '熟した果実と樽香が重なる、落ち着いた表情の赤ワインです。',
    tastingNotes: 'ブラックチェリー、杉、長い余韻。',
    imageUrl:
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=85',
    quantity: 7,
    reservedQuantity: 1,
  },
] as const;

export const DEVELOPMENT_STORE_ID = 'development-store-tokyo';
