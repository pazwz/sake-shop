import { AdminRole, CollectionStatus, CollectionType } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { FeaturedCollectionService } from '@/services/collection.service';

const collectionService = new FeaturedCollectionService();

const typeLabels: Record<string, string> = {
  [CollectionType.EDITORIAL]: '特集記事',
  [CollectionType.STORY]: 'ストーリー',
};

const statusLabels: Record<string, string> = {
  [CollectionStatus.PUBLISHED]: '公開中',
  [CollectionStatus.DRAFT]: '下書き',
  [CollectionStatus.ARCHIVED]: 'アーカイブ',
};

export default async function AdminContentCollectionsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const canEdit =
    admin.role === AdminRole.OWNER || admin.role === AdminRole.MANAGER;
  const collections = await collectionService.getAdminContentCollections();

  return (
    <main className="wrap py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Link href="/admin/collections" className="text-xs text-stone-500">
            ← ホームページ管理
          </Link>
          <p className="eyebrow mt-5">COLLECTION CONTENT</p>
          <h1 className="serif mt-3 text-5xl">特集・ストーリー管理</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            トップページの表示件数にかかわらず、登録済みの特集記事とストーリーを管理します。
          </p>
        </div>
        <Link href="/admin/collections" className="btn btn-outline text-xs">
          トップページ管理
        </Link>
      </div>

      {!canEdit ? (
        <p className="mt-8 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          閲覧のみ可能です。変更は OWNER または MANAGER に依頼してください。
        </p>
      ) : null}

      <div className="mt-12 overflow-hidden border line bg-white">
        <div className="hidden grid-cols-[96px_140px_1fr_100px_90px] gap-5 border-b line bg-[#faf8f4] px-6 py-4 text-xs text-stone-500 md:grid">
          <span>画像</span>
          <span>種類</span>
          <span>タイトル</span>
          <span>状態</span>
          <span />
        </div>
        {collections.map((collection) => {
          const imageUrl =
            collection.desktopImageUrl ?? collection.mobileImageUrl;
          return (
            <article
              key={collection.id}
              className="grid gap-4 border-b line px-6 py-5 last:border-b-0 md:grid-cols-[96px_140px_1fr_100px_90px] md:items-center md:gap-5"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                {imageUrl ? (
                  <Image
                    fill
                    sizes="96px"
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
              <p className="text-xs font-semibold text-[#6d2227]">
                {typeLabels[collection.type] ?? collection.type}
              </p>
              <div>
                <h2 className="serif text-xl">{collection.title}</h2>
                <p className="mt-2 text-xs text-stone-500">
                  掲載商品 {collection._count.products}件
                </p>
              </div>
              <p className="text-xs text-stone-600">
                {statusLabels[collection.status] ?? collection.status}
              </p>
              {canEdit ? (
                <Link
                  href={`/admin/collections/${collection.id}`}
                  className="btn btn-outline justify-self-start text-xs md:justify-self-end"
                >
                  編集
                </Link>
              ) : null}
            </article>
          );
        })}
        {collections.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-stone-500">
            管理できる特集・ストーリーはありません。
          </p>
        ) : null}
      </div>
    </main>
  );
}
