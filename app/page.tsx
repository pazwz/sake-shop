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
      <p className="eyebrow">KURA</p>
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
  preload = false,
}: {
  desktopUrl: string | null;
  mobileUrl?: string | null;
  alt: string;
  sizes: string;
  preload?: boolean;
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
    <picture>
      {mobileSource ? (
        <source media="(max-width: 767px)" srcSet={mobileSource} />
      ) : null}
      <Image
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
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
  const editorial = home.editorial[0];
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
      <section className="relative h-[82vh] min-h-[620px] overflow-hidden bg-[#3d3028]">
        <CollectionImage
          desktopUrl={hero.desktopImageUrl}
          mobileUrl={hero.mobileImageUrl}
          sizes="100vw"
          preload
          alt={hero.title}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="wrap relative flex h-full items-end pb-20 text-white">
          <div className="max-w-2xl">
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

      <section className="wrap grid gap-10 py-24 md:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="eyebrow">SHOPKEEPER&apos;S CHOICE</p>
          <h2 className="serif mt-5 text-4xl">店主のおすすめ</h2>
          <p className="mt-6 text-sm leading-8 text-stone-600">
            造り手の哲学と、食卓の時間まで想像しながら選びました。
          </p>
          <Link
            href={COLLECTION_PATHS.shopkeeper}
            className="mt-7 inline-block border-b border-[#171412] pb-1 text-xs"
          >
            選び抜いた一本へ　→
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {shopkeeperProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {editorial ? (
        <section className="grid min-h-[540px] md:grid-cols-2">
          <div className="relative min-h-80 bg-stone-100">
            <CollectionImage
              desktopUrl={editorial.desktopImageUrl}
              mobileUrl={editorial.mobileImageUrl}
              sizes="(max-width: 767px) 100vw, 50vw"
              alt={editorial.title}
            />
          </div>
          <div className="flex items-center bg-[#3d3028] px-10 py-20 text-white md:px-20">
            <div>
              <p className="eyebrow text-[#e7cf9f]">EDITORIAL FEATURE</p>
              <h2 className="serif mt-6 text-5xl leading-tight">
                {editorial.title}
              </h2>
              {editorial.description ? (
                <p className="mt-7 max-w-md text-sm leading-8 text-stone-200">
                  {editorial.description}
                </p>
              ) : null}
              <Link
                className="mt-8 inline-block border-b border-[#e7cf9f] pb-1 text-xs text-[#e7cf9f]"
                href={COLLECTION_PATHS.editorial}
              >
                特集へ　→
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="wrap py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">GIFT RECOMMENDATIONS</p>
            <h2 className="serif mt-4 text-4xl">贈り物におすすめ</h2>
          </div>
          <Link
            href={COLLECTION_PATHS.gift}
            className="inline-block border-b border-[#171412] pb-1 text-xs font-semibold"
          >
            ギフトの特集を見る　→
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {giftProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="bg-[#f3f0ea]">
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
                  <span className="mt-5 block text-xs text-[#6d2227]">
                    特集を見る　→
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
