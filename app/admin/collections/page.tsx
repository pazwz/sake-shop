import { AdminRole } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import { seasonLabels } from '@/lib/collection-presentation';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { FeaturedCollectionService } from '@/services/collection.service';

const collectionService = new FeaturedCollectionService();

type CollectionItem = Awaited<
  ReturnType<FeaturedCollectionService['getAdminCollections']>
>[number];

function EditLink({ id, canEdit }: { id: string; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <Link
      href={`/admin/collections/${id}`}
      className="btn btn-outline justify-self-start text-xs sm:justify-self-end"
    >
      編集
    </Link>
  );
}

function CurrentContent({
  collection,
  canEdit,
  emptyHref,
}: {
  collection: CollectionItem | null;
  canEdit: boolean;
  emptyHref: string;
}) {
  if (!collection) {
    return (
      <div className="mt-6 border-t line py-6">
        <p className="text-sm text-stone-500">現在表示中の内容はありません。</p>
        {canEdit ? (
          <Link
            href={emptyHref}
            className="mt-4 inline-block text-xs font-semibold underline"
          >
            設定する
          </Link>
        ) : null}
      </div>
    );
  }

  const imageUrl = collection.desktopImageUrl ?? collection.mobileImageUrl;
  return (
    <div className="mt-6 grid items-center gap-4 border-t line py-5 sm:grid-cols-[120px_1fr_auto]">
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        {imageUrl ? (
          <Image
            fill
            sizes="120px"
            className="object-cover"
            src={imageUrl}
            alt=""
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[10px] text-stone-400">
            画像なし
          </span>
        )}
      </div>
      <div>
        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800">
          現在表示中
        </span>
        <h3 className="serif mt-3 text-xl">{collection.title}</h3>
        <p className="mt-2 text-xs text-stone-500">
          掲載商品 {collection.products.length}件
        </p>
      </div>
      <EditLink id={collection.id} canEdit={canEdit} />
    </div>
  );
}

function ProductArea({
  title,
  description,
  collection,
  fallback,
  canEdit,
  type,
}: {
  title: string;
  description: string;
  collection: CollectionItem | null;
  fallback: CollectionItem | null;
  canEdit: boolean;
  type: 'SHOPKEEPER' | 'GIFT';
}) {
  return (
    <section className="border line bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">HOMEPAGE AREA</p>
          <h2 className="serif mt-3 text-3xl">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            {description}
          </p>
        </div>
        {canEdit ? (
          <Link
            href={
              collection
                ? `/admin/collections/${collection.id}`
                : fallback
                  ? `/admin/collections/${fallback.id}`
                  : `/admin/collections/new?type=${type}`
            }
            className="btn bg-[#171412] text-xs text-white"
          >
            {collection ? '編集' : '設定する'}
          </Link>
        ) : null}
      </div>
      <div className="mt-6 bg-[#faf8f4] p-5">
        <p className="text-xs text-stone-500">現在の掲載商品</p>
        <p className="serif mt-2 text-3xl">
          {collection?.products.length ?? 0}件
        </p>
      </div>
      {collection?.products.length ? (
        <ul className="mt-5 space-y-2 text-sm text-stone-700">
          {collection.products.map(({ product }) => (
            <li key={product.id}>・{product.name}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-stone-500">掲載商品はありません。</p>
      )}
    </section>
  );
}

function FixedContentList({
  title,
  eyebrow,
  description,
  collections,
  canEdit,
  type,
  limit,
}: {
  title: string;
  eyebrow: string;
  description: string;
  collections: CollectionItem[];
  canEdit: boolean;
  type: 'EDITORIAL' | 'STORY';
  limit: number;
}) {
  return (
    <section className="border line bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="serif mt-3 text-3xl">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">{description}</p>
          <p className="mt-3 text-sm font-semibold text-[#6d2227]">
            現在表示中：{collections.length}件
          </p>
        </div>
        {canEdit && collections.length < limit ? (
          <Link
            href={`/admin/collections/new?type=${type}`}
            className="text-xs font-semibold underline"
          >
            追加
          </Link>
        ) : null}
      </div>
      <div className="mt-6">
        {collections.map((collection, index) => (
          <div
            key={collection.id}
            className="grid items-center gap-4 border-t line py-5 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <span className="text-xs font-semibold text-emerald-700">
                現在表示中 {index + 1}
              </span>
              <h3 className="serif mt-2 text-xl">{collection.title}</h3>
            </div>
            <EditLink id={collection.id} canEdit={canEdit} />
          </div>
        ))}
        {collections.length === 0 ? (
          <p className="border-t line py-6 text-sm text-stone-500">
            現在表示中の内容はありません。
          </p>
        ) : null}
      </div>
      {collections.length >= limit ? (
        <p className="mt-3 text-xs text-stone-500">
          トップページでは{limit}件まで表示できます。
        </p>
      ) : null}
    </section>
  );
}

export default async function AdminCollectionsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const canEdit =
    admin.role === AdminRole.OWNER || admin.role === AdminRole.MANAGER;
  const management = await collectionService.getAdminHomeManagement();

  return (
    <main className="wrap py-16">
      <div>
        <Link href="/admin" className="text-xs text-stone-500">
          ← 管理トップ
        </Link>
        <p className="eyebrow mt-5">HOMEPAGE CMS</p>
        <h1 className="serif mt-3 text-5xl">ホームページ管理</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
          現在トップページに表示している画像、文章、商品を管理します。
        </p>
      </div>

      {!canEdit ? (
        <p className="mt-8 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          閲覧のみ可能です。変更は OWNER または MANAGER に依頼してください。
        </p>
      ) : null}

      <div className="mt-12 space-y-10">
        <section className="border line bg-white p-6 md:p-8">
          <p className="eyebrow">MAIN VISUAL</p>
          <h2 className="serif mt-3 text-3xl">メインビジュアル</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            トップページ最上部に表示するメイン画像です。現在表示する内容を編集します。
          </p>
          <CurrentContent
            collection={management.hero}
            canEdit={canEdit}
            emptyHref={
              management.fallbacks.hero
                ? `/admin/collections/${management.fallbacks.hero.id}`
                : '/admin/collections/new?type=HERO'
            }
          />
        </section>

        <section className="border line bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">SEASONAL FEATURE</p>
              <h2 className="serif mt-3 text-3xl">季節の特集</h2>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                季節ごとのおすすめ商品を設定します。メインビジュアルとは別のコンテンツです。
              </p>
            </div>
            <p className="rounded-full bg-[#6d2227] px-4 py-2 text-xs text-white">
              現在の季節：{seasonLabels[management.currentSeason]}
            </p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {management.seasonal.map(({ season, collection, fallback }) => (
              <div key={season} className="border line p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="serif text-2xl">{seasonLabels[season]}</p>
                    <p className="mt-2 text-sm text-stone-600">
                      {collection?.title ?? '未設定'}
                    </p>
                    {collection ? (
                      <p className="mt-2 text-xs font-semibold text-emerald-700">
                        現在表示する設定 · 掲載商品 {collection.products.length}
                        件
                      </p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <Link
                      href={
                        collection || fallback
                          ? `/admin/collections/${(collection ?? fallback)?.id}`
                          : `/admin/collections/new?type=SEASONAL&season=${season}`
                      }
                      className="text-xs font-semibold underline"
                    >
                      {collection || fallback ? '編集' : '設定'}
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductArea
            title="店主のおすすめ"
            description={`現在トップページに表示する商品を最大${HOME_CONTENT_LIMITS.shopkeeperProducts}件まで設定します。`}
            collection={management.shopkeeper}
            fallback={management.fallbacks.shopkeeper}
            canEdit={canEdit}
            type="SHOPKEEPER"
          />
          <ProductArea
            title="ギフト"
            description={`現在トップページに表示する商品を最大${HOME_CONTENT_LIMITS.giftProducts}件まで設定します。`}
            collection={management.gift}
            fallback={management.fallbacks.gift}
            canEdit={canEdit}
            type="GIFT"
          />
        </div>

        <FixedContentList
          title="特集記事"
          eyebrow="EDITORIAL"
          description="トップページに表示する特集記事を編集します。"
          collections={management.editorial}
          canEdit={canEdit}
          type="EDITORIAL"
          limit={HOME_CONTENT_LIMITS.editorial}
        />
        <FixedContentList
          title="ストーリー"
          eyebrow="STORY"
          description="トップページに表示する2件のストーリーを編集します。"
          collections={management.story}
          canEdit={canEdit}
          type="STORY"
          limit={HOME_CONTENT_LIMITS.story}
        />
      </div>
    </main>
  );
}
