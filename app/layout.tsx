import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://linxas-fukuoka.com'),
  title: `リンクサス福岡 | ${siteConfig.brandName}`,
  applicationName: siteConfig.brandName,
  description: `${siteConfig.brandName} — つくり手の美意識を、食卓へ。`,
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: siteConfig.brandName,
    title: `リンクサス福岡 | ${siteConfig.brandName}`,
    description: `${siteConfig.brandName} — つくり手の美意識を、食卓へ。`,
  },
  icons: { icon: '/icon.svg' },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
