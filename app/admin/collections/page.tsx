import { AdminRole } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getEffectiveStatusLabel,
  seasonLabels,
} from '@/lib/collection-presentation';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { FeaturedCollectionService } from '@/services/collection.service';

const collectionService = new FeaturedCollectionService();

type CollectionItem = Awaited<
  ReturnType<FeaturedCollectionService['getAdminCollections']>
>[number];

const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(value)
    : null;

const scheduleLabel = (collection: CollectionItem) => {
  const start = formatDate(collection.publishStartAt);
  const end = formatDate(collection.publishEndAt);
  if (start && end) return `${start} 〜 ${end}`;
  if (start) return `${start} から`;
  if (end) return `${end} まで`;
  return '公開期間の指定なし';
};

function StatusBadge({ collection }: { collection: CollectionItem }) {
  const label = getEffectiveStatusLabel(collection);
  const active = label === '公開中';
  const scheduled = label === '公開予定';
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
        active
          ? 'bg-emerald-100 text-emerald-800'
          : scheduled
            ? 'bg-amber-100 text-amber-800'
            : 'bg-stone-100 text-stone-600'
      }`}
    >
      {label}
    </span>
  );
}

function CollectionRow({
  collection,
  canEdit,
  hideTitle = false,
}: {
  collection: CollectionItem;
  canEdit: boolean;
  hideTitle?: boolean;
}) {
  const imageUrl = collection.desktopImageUrl ?? collection.mobileImageUrl;
  return (
    <div className="grid items-center gap-4 border-t line py-5 sm:grid-cols-[96px_1fr_auto]">
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
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge collection={collection} />
          <span className="text-xs text-stone-500">
            {scheduleLabel(collection)}
          </span>
        </div>
        {!hideTitle ? (
          <h3 className="serif mt-2 text-xl">{collection.title}</h3>
        ) : null}
        <p className="mt-2 text-xs text-stone-500">
          掲載商品 {collection.products.length}件
        </p>
      </div>
      {canEdit ? (
        <Link
          href={`/admin/collections/${collection.id}`}
          className="btn btn-outline justify-self-start text-xs sm:justify-self-end"
        >
          編集
        </Link>
      ) : null}
    </div>
  );
}

function AreaSummary({
  title,
  description,
  area,
  canEdit,
  type,
}: {
  title: string;
  description: string;
  area: {
    records: CollectionItem[];
    activeRecords: CollectionItem[];
    visibleProducts: CollectionItem['products'];
  };
  canEdit: boolean;
  type: 'SHOPKEEPER' | 'GIFT';
}) {
  const primary = area.activeRecords[0] ?? area.records[0];
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
              primary
                ? `/admin/collections/${primary.id}`
                : `/admin/collections/new?type=${type}`
            }
            className="btn bg-[#171412] text-xs text-white"
          >
            {primary ? '編集' : '設定する'}
          </Link>
        ) : null}
      </div>
      <div className="mt-6 grid gap-4 bg-[#faf8f4] p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-stone-500">現在トップページに掲載</p>
          <p className="serif mt-2 text-3xl">{area.visibleProducts.length}件</p>
        </div>
        <div>
          <p className="text-xs text-stone-500">有効な内容設定</p>
          <p className="serif mt-2 text-3xl">{area.activeRecords.length}件</p>
        </div>
      </div>
      {area.visibleProducts.length ? (
        <p className="mt-4 text-sm text-stone-600">
          表示商品：
          {area.visibleProducts.map(({ product }) => product.name).join('、')}
        </p>
      ) : (
        <p className="mt-4 text-sm text-stone-500">現在掲載中の商品はありません。</p>
      )}
      {area.activeRecords.length > 1 ? (
        <p className="mt-4 border-l-2 border-amber-500 pl-3 text-xs leading-6 text-stone-600">
          公開中の内容が{area.activeRecords.length}
          件あります。トップページでは表示順に商品をまとめ、重複を除いて先頭3件を表示します。
        </p>
      ) : null}
      {area.records.length > 1 ? (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-stone-600">
            内容候補を確認（{area.records.length}件）
          </summary>
          <div className="mt-3">
            {area.records.map((record) => (
              <CollectionRow
                key={record.id}
                collection={record}
                canEdit={canEdit}
                hideTitle
              />
            ))}
          </div>
        </details>
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
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Link href="/admin" className="text-xs text-stone-500">
            ← 管理トップ
          </Link>
          <p className="eyebrow mt-5">HOMEPAGE CMS</p>
          <h1 className="serif mt-3 text-5xl">ホームページ管理</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            トップページの画像、文章、掲載商品、公開期間を管理します。
          </p>
        </div>
        {canEdit ? (
          <Link
            href="/admin/collections/new"
            className="btn bg-[#171412] text-white"
          >
            コンテンツを追加
          </Link>
        ) : null}
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
            トップページ最上部の大型ビジュアルです。現在公開中、公開予定、下書き、過去の内容を候補として管理できます。
          </p>
          <div className="mt-6">
            {management.hero.map((collection) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                canEdit={canEdit}
              />
            ))}
            {management.hero.length === 0 ? (
              <p className="border-t line py-6 text-sm text-stone-500">
                メインビジュアルはまだ設定されていません。
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <Link
              href="/admin/collections/new?type=HERO"
              className="mt-5 inline-block text-xs font-semibold underline"
            >
              メインビジュアル候補を追加
            </Link>
          ) : null}
        </section>

        <section className="border line bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">SEASONAL FEATURE</p>
              <h2 className="serif mt-3 text-3xl">季節の特集</h2>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                春・夏・秋・冬ごとのおすすめ商品を管理します。
              </p>
            </div>
            <p className="rounded-full bg-[#6d2227] px-4 py-2 text-xs text-white">
              現在：{seasonLabels[management.currentSeason]}
            </p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {management.seasonal.map(({ season, records }) => {
              const primary = records[0];
              return (
                <div key={season} className="border line p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="serif text-2xl">{seasonLabels[season]}</p>
                      {primary ? (
                        <>
                          <p className="mt-2 text-sm">{primary.title}</p>
                          <p className="mt-2 text-xs text-stone-500">
                            掲載商品 {primary.products.length}件 ·{' '}
                            {getEffectiveStatusLabel(primary)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-stone-500">未設定</p>
                      )}
                    </div>
                    {canEdit ? (
                      <Link
                        href={
                          primary
                            ? `/admin/collections/${primary.id}`
                            : `/admin/collections/new?type=SEASONAL&season=${season}`
                        }
                        className="text-xs font-semibold underline"
                      >
                        {primary ? '編集' : '設定'}
                      </Link>
                    ) : null}
                  </div>
                  {records.length > 1 ? (
                    <p className="mt-3 text-xs text-amber-700">
                      内容候補が{records.length}件あります。
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <AreaSummary
            title="店主のおすすめ"
            description="店主が選んだ商品をトップページに最大3件表示します。"
            area={management.shopkeeper}
            canEdit={canEdit}
            type="SHOPKEEPER"
          />
          <AreaSummary
            title="ギフト"
            description="贈り物としておすすめする商品をトップページに最大3件表示します。"
            area={management.gift}
            canEdit={canEdit}
            type="GIFT"
          />
        </div>

        {[
          {
            title: '特集記事',
            eyebrow: 'EDITORIAL',
            description: '読み物として紹介する特集コンテンツです。',
            type: 'EDITORIAL',
            records: management.editorial,
          },
          {
            title: 'ストーリー',
            eyebrow: 'STORY',
            description: '酒蔵や造り手、季節にまつわるストーリーです。',
            type: 'STORY',
            records: management.story,
          },
        ].map((section) => (
          <section key={section.type} className="border line bg-white p-6 md:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h2 className="serif mt-3 text-3xl">{section.title}</h2>
                <p className="mt-3 text-sm text-stone-600">
                  {section.description}
                </p>
              </div>
              {canEdit ? (
                <Link
                  href={`/admin/collections/new?type=${section.type}`}
                  className="text-xs font-semibold underline"
                >
                  追加
                </Link>
              ) : null}
            </div>
            <div className="mt-6">
              {section.records.map((collection) => (
                <CollectionRow
                  key={collection.id}
                  collection={collection}
                  canEdit={canEdit}
                />
              ))}
              {section.records.length === 0 ? (
                <p className="border-t line py-6 text-sm text-stone-500">
                  まだ登録されていません。
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
