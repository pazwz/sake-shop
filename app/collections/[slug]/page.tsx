import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { BrandEmptyState } from '@/components/brand-empty-state';
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
  fetchPriority,
}: {
  collection: Pick<
    PublicCollection,
    'title' | 'desktopImageUrl' | 'mobileImageUrl'
  >;
  sizes: string;
  className?: string;
  fetchPriority?: 'high';
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
    <picture className="absolute inset-0">
      {mobileSource ? (
        <source media="(max-width: 767px)" srcSet={mobileSource} />
      ) : null}
      <Image
        fill
        sizes={sizes}
        className={className}
        src={imageUrl}
        alt={collection.title}
        fetchPriority={fetchPriority}
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
    <div>
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
                data-reveal
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
    </div>
  );
}

function CollectionDetail({ collection }: { collection: PublicCollection }) {
  const products = collection.products.map(productCardItem);
  const hasImage = collection.desktopImageUrl ?? collection.mobileImageUrl;
  const isEditorial = collection.type === 'EDITORIAL';
  const isStory = collection.type === 'STORY';
  const eyebrow = isEditorial
    ? 'KURA EDITORIAL'
    : isStory
      ? 'KURA STORY'
      : 'KURA COLLECTION';
  const selectionTitle = isStory
    ? '物語に寄り添うお酒'
    : isEditorial
      ? '編集部が選んだお酒'
      : 'この特集のお酒';

  return (
    <div
      className={
        isStory ? 'story-detail' : isEditorial ? 'editorial-detail' : ''
      }
    >
      <section
        className={`collection-hero relative overflow-hidden ${
          hasImage
            ? isStory
              ? 'mx-auto mt-12 h-[54vh] min-h-[400px] max-w-[1120px] bg-stone-200 md:mt-20'
              : 'h-[64vh] min-h-[480px] bg-stone-200'
            : 'bg-[#3d3028] py-28 text-white'
        }`}
      >
        {hasImage ? (
          <>
            <CollectionImage
              collection={collection}
              sizes={isStory ? '(max-width: 1120px) 100vw, 1120px' : '100vw'}
              className={`collection-hero-media object-cover ${isEditorial ? 'object-[center_42%]' : 'object-center'}`}
              fetchPriority="high"
            />
            {isEditorial ? (
              <div className="absolute inset-0 bg-black/25" />
            ) : null}
            {isEditorial ? (
              <div className="wrap relative flex h-full items-end pb-14 text-white md:pb-20">
                <div className="max-w-4xl" data-reveal>
                  <p className="eyebrow text-[#e7cf9f]">{eyebrow}</p>
                  <h1 className="serif mt-5 text-5xl leading-tight md:text-7xl">
                    {collection.title}
                  </h1>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="wrap">
            <p className="eyebrow text-[#e7cf9f]">{eyebrow}</p>
          </div>
        )}
      </section>

      <section
        className={`wrap py-16 md:py-24 ${isStory ? 'max-w-4xl text-left' : 'text-center'}`}
        data-reveal
      >
        <p className="eyebrow text-[#6d2227]">{eyebrow}</p>
        {collection.subtitle ? (
          <p className="mt-5 text-xs tracking-[.18em] text-stone-500">
            {collection.subtitle}
          </p>
        ) : null}
        {!isEditorial || !hasImage ? (
          <h1
            className={`serif mt-5 text-5xl md:text-6xl ${isStory ? 'leading-tight' : ''}`}
          >
            {collection.title}
          </h1>
        ) : null}
        {collection.description ? (
          <p
            className={`${isStory ? 'mr-auto max-w-3xl text-base leading-9' : 'mx-auto max-w-2xl text-sm leading-8'} mt-8 whitespace-pre-line text-stone-600`}
          >
            {collection.description}
          </p>
        ) : null}
      </section>

      <section className="wrap border-t line py-16 md:py-24" data-reveal>
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">SELECTION</p>
            <h2 className="serif mt-4 text-4xl">{selectionTitle}</h2>
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
          <BrandEmptyState
            title="現在掲載できる商品はありません"
            description="次の一本をご紹介できるまで、もうしばらくお待ちください。"
            href="/products"
            linkLabel="商品一覧を見る"
          />
        )}
      </section>

      <div className="wrap pb-20 text-center">
        <Link href="/" className="brand-link inline-flex">
          トップページへ戻る <i aria-hidden="true">→</i>
        </Link>
      </div>
    </div>
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
