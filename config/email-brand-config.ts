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
  legalLinks: [
    { label: 'プライバシーポリシー', href: '/privacy' },
    { label: '特定商取引法に基づく表記', href: '/legal/tokusho' },
    { label: '利用規約', href: '/terms' },
  ],
  ageNotice: '20歳未満の方への酒類の販売はいたしません。',
  sentOnlyNotice:
    'このメールは送信専用です。\nお問い合わせはサイト内のお問い合わせ窓口をご利用ください。',
} as const;
