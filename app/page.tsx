import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { HomeCategoryGrid } from '@/components/home-category-grid';
import {
  HomeSeasonalSection,
  type HomeProductCardItem,
  type SeasonKey,
  type SeasonalCollection,
} from '@/components/home-seasonal-section';
import { ProductCard } from '@/components/product-card';
import { COLLECTION_PATHS } from '@/config/collections';
import { serializeForJson } from '@/lib/serialization';
import { FeaturedCollectionService } from '@/services/collection.service';

type HomeCollection = {
  id: string;
  title: string;
  description: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  season: SeasonKey | null;
  products: Array<{
    product: {
      id: string;
      slug: string;
      name: string;
      producer: string | null;
      price: { toString(): string };
      category: { name: string };
      images: Array<{ imageUrl: string }>;
    };
  }>;
};

const collectionService = new FeaturedCollectionService();

export const dynamic = 'force-dynamic';

const productsFor = (collections: HomeCollection[]): HomeProductCardItem[] =>
  collections.flatMap((collection) =>
    collection.products.map(({ product }) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      producer: product.producer,
      price: Number(product.price.toString()),
      category: { name: product.category.name },
      images: product.images.map(({ imageUrl }) => ({ imageUrl })),
    })),
  );

function EmptyHome() {
  return (
    <section className="wrap py-32 text-center">
      <p className="eyebrow">LINXAS</p>
      <h1 className="serif mt-5 text-4xl">現在ご案内できる特集はありません</h1>
      <p className="mt-5 text-sm text-stone-600">
        新しい特集を準備しています。商品一覧からお酒をお選びください。
      </p>
      <Link className="btn btn-outline mt-8" href="/products">
        商品一覧へ
      </Link>
    </section>
  );
}

function CollectionImage({
  desktopUrl,
  mobileUrl,
  alt,
  sizes,
  fetchPriority,
  className = 'object-cover',
}: {
  desktopUrl: string | null;
  mobileUrl?: string | null;
  alt: string;
  sizes: string;
  fetchPriority?: 'high';
  className?: string;
}) {
  const fallbackUrl = desktopUrl ?? mobileUrl;
  if (!fallbackUrl) return null;

  const mobileSource = mobileUrl
    ? getImageProps({
        src: mobileUrl,
        alt,
        fill: true,
        sizes: '100vw',
      }).props.srcSet
    : null;

  return (
    <picture className="absolute inset-0">
      {mobileSource ? (
        <source media="(max-width: 767px)" srcSet={mobileSource} />
      ) : null}
      <Image
        fill
        sizes={sizes}
        fetchPriority={fetchPriority}
        className={className}
        src={fallbackUrl}
        alt={alt}
      />
    </picture>
  );
}

export default async function Home() {
  const home = await collectionService.getHome();
  if (home.hero.length === 0) return <EmptyHome />;

  const hero = home.hero[0];
  const shopkeeperProducts = productsFor(home.shopkeeper);
  const giftProducts = productsFor(home.gift);
  const editorials = home.editorial;
  const stories = home.story;
  const seasonalCollections: SeasonalCollection[] = serializeForJson(
    home.seasonal.map((collection) => ({
      id: collection.id,
      season: collection.season,
      products: productsFor([collection]).map((product) => ({ product })),
    })),
  );

  return (
    <>
      <section className="home-hero relative h-[82vh] min-h-[620px] overflow-hidden bg-[#3d3028]">
        <CollectionImage
          desktopUrl={hero.desktopImageUrl}
          mobileUrl={hero.mobileImageUrl}
          sizes="100vw"
          fetchPriority="high"
          alt={hero.title}
          className="hero-media object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="wrap relative flex h-full items-end pb-20 text-white">
          <div className="hero-copy max-w-2xl">
            <p className="eyebrow text-[#eed9aa]">SEASONAL JOURNAL</p>
            <h1 className="serif mt-6 text-5xl leading-tight md:text-7xl">
              {hero.title}
            </h1>
            {hero.description ? (
              <p className="mt-6 max-w-md text-sm leading-8 text-stone-100">
                {hero.description}
              </p>
            ) : null}
            <Link
              className="btn mt-9 bg-white text-[#171412] hover:bg-[#ead9b7]"
              href={COLLECTION_PATHS.seasonal}
            >
              季節を味わう
            </Link>
          </div>
        </div>
      </section>

      <HomeSeasonalSection
        collections={seasonalCollections}
        currentSeason={home.currentSeason}
      />

      <HomeCategoryGrid />

      <section
        className="wrap grid gap-10 py-24 md:grid-cols-[.8fr_1.2fr]"
        data-reveal
      >
        <div>
          <p className="eyebrow">SHOPKEEPER&apos;S CHOICE</p>
          <h2 className="serif mt-5 text-4xl">店主のおすすめ</h2>
          <p className="mt-6 text-sm leading-8 text-stone-600">
            造り手の哲学と、食卓の時間まで想像しながら選びました。
          </p>
          <Link
            href={COLLECTION_PATHS.shopkeeper}
            className="brand-link mt-7 inline-flex"
          >
            選び抜いた一本へ <i aria-hidden="true">→</i>
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {shopkeeperProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {editorials.length ? (
        <section
          className="editorial-showcase bg-[#3d3028] py-20 text-white md:py-28"
          data-reveal
        >
          <div className="wrap">
            <p className="eyebrow text-[#e7cf9f]">EDITORIAL FEATURES</p>
            <h2 className="serif mt-5 text-4xl md:text-5xl">今月の特集</h2>
            <div
              className={`editorial-layout editorial-layout-${editorials.length} mt-12`}
            >
              {editorials.map((editorial, index) => (
                <article
                  key={editorial.id}
                  className={`editorial-item editorial-item-${index + 1}`}
                >
                  <Link
                    href={COLLECTION_PATHS.editorial(editorial.id)}
                    className="group block"
                  >
                    <div className="editorial-image relative overflow-hidden bg-stone-800">
                      <CollectionImage
                        desktopUrl={editorial.desktopImageUrl}
                        mobileUrl={editorial.mobileImageUrl}
                        sizes={
                          index === 0
                            ? '(max-width: 767px) 100vw, 66vw'
                            : '(max-width: 767px) 100vw, 34vw'
                        }
                        alt={editorial.title}
                      />
                    </div>
                    <p className="mt-6 text-[10px] font-semibold tracking-[.22em] text-[#e7cf9f]">
                      FEATURE {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3
                      className={`serif mt-3 leading-tight ${index === 0 ? 'text-4xl md:text-5xl' : 'text-3xl'}`}
                    >
                      {editorial.title}
                    </h3>
                    {editorial.description ? (
                      <p className="mt-5 max-w-xl text-sm leading-8 text-stone-200">
                        {editorial.description}
                      </p>
                    ) : null}
                    <span className="brand-link brand-link-light mt-6 inline-flex">
                      特集を見る <i aria-hidden="true">→</i>
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="wrap py-24" data-reveal>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">GIFT RECOMMENDATIONS</p>
            <h2 className="serif mt-4 text-4xl">贈り物におすすめ</h2>
          </div>
          <Link href={COLLECTION_PATHS.gift} className="brand-link inline-flex">
            ギフトの特集を見る <i aria-hidden="true">→</i>
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {giftProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="story-showcase bg-[#f3f0ea]" data-reveal>
        <div className="wrap py-24">
          <p className="eyebrow">STORIES</p>
          <div className="mt-5 grid gap-8 md:grid-cols-2">
            {stories.map((story) => (
              <Link
                key={story.id}
                href={COLLECTION_PATHS.story(story.id)}
                className="grid gap-6 sm:grid-cols-2"
              >
                <div className="relative aspect-[4/3] bg-stone-100">
                  <CollectionImage
                    desktopUrl={story.desktopImageUrl}
                    mobileUrl={story.mobileImageUrl}
                    sizes="(max-width: 639px) 100vw, (max-width: 767px) 50vw, 25vw"
                    alt={story.title}
                  />
                </div>
                <div className="self-center">
                  <h3 className="serif text-3xl">{story.title}</h3>
                  {story.description ? (
                    <p className="mt-4 text-sm leading-7 text-stone-600">
                      {story.description}
                    </p>
                  ) : null}
                  <span className="brand-link mt-5 inline-flex">
                    物語を読む <i aria-hidden="true">→</i>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
