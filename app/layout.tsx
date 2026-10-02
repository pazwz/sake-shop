import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'リンクサス福岡 | LINXAS',
  description: 'つくり手の美意識を、食卓へ。',
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
