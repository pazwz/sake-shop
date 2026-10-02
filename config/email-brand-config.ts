import { PUBLIC_PRODUCT_NAVIGATION } from '@/config/public-navigation';
import { siteConfig } from '@/config/site';

export const EMAIL_SITE_URL = 'https://linxas-fukuoka.com';

export const toEmailPublicUrl = (url: string) =>
  url.startsWith('/') && !url.startsWith('//')
    ? `${EMAIL_SITE_URL}${url}`
    : url;

export const emailBrandConfig = {
  brandName: siteConfig.brandName,
  storeName: siteConfig.storeName,
  locationLabel: siteConfig.locationLabel,
  phone: siteConfig.phone,
  businessHours: siteConfig.businessHours,
  instagramUrl: siteConfig.instagramUrl,
  serviceLinks: [
    { label: '配送・返品について', href: '/shipping-returns' },
    { label: 'お支払いについて', href: '/legal/tokusho' },
  ],
  legalLinks: [
    { label: '特定商取引法に基づく表記', href: '/legal/tokusho' },
    { label: 'プライバシーポリシー', href: '/privacy' },
    { label: '利用規約', href: '/terms' },
  ],
  shopLinks: [
    { label: '商品一覧', href: '/products' },
    ...PUBLIC_PRODUCT_NAVIGATION,
    { label: '特集（トップページ）', href: '/' },
  ],
  ageNotices: [
    '20歳未満の者の飲酒は法律で禁止されています。',
    '20歳未満の者に対しては酒類を販売いたしません。',
  ],
  sentOnlyNotice:
    'このメールは送信専用です。お問い合わせはサイト内のお問い合わせ窓口をご利用ください。',
} as const;
