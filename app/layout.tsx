import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import './globals.css';
import { CartProvider } from '@/components/cart-provider';
import { AuthProvider } from '@/components/auth-provider';
import { LanguageProvider } from '@/components/language-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { BackToTop } from '@/components/back-to-top';
import { ScrollReveal } from '@/components/scroll-reveal';
import { CategoryService } from '@/services/category.service';
import { FeaturedCollectionService } from '@/services/collection.service';

export const metadata: Metadata = {
  title: 'リンクサス福岡 | LINXAS',
  description: 'つくり手の美意識を、食卓へ。',
  icons: { icon: '/icon.svg' },
};
const categoryService = new CategoryService();
const collectionService = new FeaturedCollectionService();
const getHeaderData = unstable_cache(
  () =>
    Promise.all([
      categoryService.getHeaderNavigation(),
      collectionService.getHeaderNavigation(),
    ]),
  ['linxas-header-navigation'],
  { revalidate: 300 },
);

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [navigation, features] = await getHeaderData();
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>
              <Header navigation={navigation} features={features} />
              <main>{children}</main>
              <Footer />
              <BackToTop />
              <ScrollReveal />
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
