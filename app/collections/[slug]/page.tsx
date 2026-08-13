import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { SEASON_COLLECTION_SLUGS } from '@/config/collections';
import { seasonLabels } from '@/lib/collection-presentation';
import { FeaturedCollectionService } from '@/services/collection.service';

const collectionService = new FeaturedCollectionService();

export const dynamic = 'force-dynamic';

type PublicCollection = NonNullable<
  Awaited<ReturnType<FeaturedCollectionService['getPublicCollectionDetail']>>
>;

function CollectionImage({
  collection,
  sizes,
  className = 'object-cover',
}: {
  collection: Pick<
    PublicCollection,
    'title' | 'desktopImageUrl' | 'mobileImageUrl'
  >;
  sizes: string;
  className?: string;
}) {
  const imageUrl = collection.desktopImageUrl ?? collection.mobileImageUrl;
  if (!imageUrl) return null;

  const mobileSource = collection.mobileImageUrl
    ? getImageProps({
        src: collection.mobileImageUrl,
        alt: collection.title,
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
        className={className}
        src={imageUrl}
        alt={collection.title}
      />
    </picture>
  );
}

const productCardItem = ({
  product,
}: PublicCollection['products'][number]) => ({
  id: product.id,
  slug: product.slug,
  name: product.name,
  producer: product.producer,
  price: Number(product.price.toString()),
  category: { name: product.category.name },
  images: product.images.map(({ imageUrl }) => ({ imageUrl })),
});

async function SeasonalIndex() {
  const collections = await collectionService.getPublicSeasonalCollections();

  return (
    <main>
      <section className="bg-[#3d3028] text-white">
        <div className="wrap py-24 md:py-36">
          <p className="eyebrow text-[#e7cf9f]">SEASONAL JOURNAL</p>
          <h1 className="serif mt-6 text-5xl md:text-7xl">季節を味わう</h1>
          <p className="mt-7 max-w-xl text-sm leading-8 text-stone-200">
            四季の移ろいに寄り添うお酒を、季節ごとの特集としてご紹介します。
          </p>
        </div>
      </section>

      <section className="wrap py-20 md:py-28">
        <div className="grid gap-x-8 gap-y-14 md:grid-cols-2">
          {collections.map((collection) => {
            if (!collection.season) return null;
            const slug = SEASON_COLLECTION_SLUGS[collection.season];
            return (
              <Link
                key={collection.id}
                href={`/collections/${slug}`}
                className="group block"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[#f3f0ea]">
                  <CollectionImage
                    collection={collection}
                    sizes="(max-width: 767px) 100vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.02]"
                  />
                </div>
                <p className="eyebrow mt-6 text-[#6d2227]">
                  {seasonLabels[collection.season]}
                </p>
                <h2 className="serif mt-3 text-4xl">{collection.title}</h2>
                {collection.description ? (
                  <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
                    {collection.description}
                  </p>
                ) : null}
                <span className="mt-5 inline-block border-b border-[#171412] pb-1 text-xs font-semibold">
                  特集を見る　→
                </span>
              </Link>
            );
          })}
        </div>
        {collections.length === 0 ? (
          <p className="py-20 text-center text-sm text-stone-500">
            現在ご案内できる季節の特集はありません。
          </p>
        ) : null}
      </section>
    </main>
  );
}

function CollectionDetail({ collection }: { collection: PublicCollection }) {
  const products = collection.products.map(productCardItem);
  const hasImage = collection.desktopImageUrl ?? collection.mobileImageUrl;

  return (
    <main>
      <section
        className={`relative overflow-hidden ${
          hasImage
            ? 'h-[58vh] min-h-[440px] bg-stone-200'
            : 'bg-[#3d3028] py-28 text-white'
        }`}
      >
        {hasImage ? (
          <>
            <CollectionImage collection={collection} sizes="100vw" />
            <div className="absolute inset-0 bg-black/20" />
          </>
        ) : (
          <div className="wrap">
            <p className="eyebrow text-[#e7cf9f]">KURA COLLECTION</p>
          </div>
        )}
      </section>

      <section className="wrap py-16 text-center md:py-24">
        <p className="eyebrow text-[#6d2227]">KURA COLLECTION</p>
        {collection.subtitle ? (
          <p className="mt-5 text-xs tracking-[.18em] text-stone-500">
            {collection.subtitle}
          </p>
        ) : null}
        <h1 className="serif mt-5 text-5xl md:text-6xl">{collection.title}</h1>
        {collection.description ? (
          <p className="mx-auto mt-8 max-w-2xl whitespace-pre-line text-sm leading-8 text-stone-600">
            {collection.description}
          </p>
        ) : null}
      </section>

      <section className="wrap border-t line py-16 md:py-24">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">SELECTION</p>
            <h2 className="serif mt-4 text-4xl">この特集のお酒</h2>
          </div>
          <p className="text-xs text-stone-500">{products.length} items</p>
        </div>
        {products.length ? (
          <div className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-sm text-stone-500">
            現在掲載できる商品はありません
          </p>
        )}
      </section>

      <div className="wrap pb-20 text-center">
        <Link
          href="/"
          className="inline-block border-b border-[#171412] pb-1 text-xs"
        >
          トップページへ戻る　→
        </Link>
      </div>
    </main>
  );
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === 'seasonal') return <SeasonalIndex />;

  const collection = await collectionService.getPublicCollectionDetail(slug);
  if (!collection) notFound();

  return <CollectionDetail collection={collection} />;
}
