import { unstable_cache } from 'next/cache';
import { CartProvider } from '@/components/cart-provider';
import { AuthProvider } from '@/components/auth-provider';
import { LanguageProvider } from '@/components/language-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { BackToTop } from '@/components/back-to-top';
import { ScrollReveal } from '@/components/scroll-reveal';
import { CategoryService } from '@/services/category.service';
import { FeaturedCollectionService } from '@/services/collection.service';

const getHeaderData = unstable_cache(
  () =>
    Promise.all([
      new CategoryService().getHeaderNavigation(),
      new FeaturedCollectionService().getHeaderNavigation(),
    ]),
  ['linxas-header-navigation'],
  { revalidate: 300 },
);

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [navigation, features] = await getHeaderData();
  return (
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
  );
}
