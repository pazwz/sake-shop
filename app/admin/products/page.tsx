import { AdminRole } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminProductEditHref } from '@/lib/admin-product-navigation';
import { ProductionSmaregiSyncPanel } from '@/components/admin/production-smaregi-sync-panel';
import { formatPrice } from '@/lib/products';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { AdminProductService } from '@/services/admin-product.service';
import { SyncService } from '@/services/sync.service';
import { adminProductQueryValidator } from '@/validators/admin-product.validator';
import {
  PRODUCT_EC_STATUS,
  PRODUCT_EC_STATUS_LABEL,
  type ProductEcStatus,
} from '@/types/product-ec-status';

const service = new AdminProductService();
const syncService = new SyncService();

const ecStatusOptions: Array<{
  value: 'all' | 'published' | 'preparing' | 'hidden' | 'excluded' | 'retired';
  status?: ProductEcStatus;
  label: string;
}> = [
  { value: 'all', label: 'すべて' },
  {
    value: 'published',
    status: PRODUCT_EC_STATUS.PUBLISHED,
    label: 'EC販売中',
  },
  {
    value: 'preparing',
    status: PRODUCT_EC_STATUS.PREPARING,
    label: '公開準備中',
  },
  { value: 'hidden', status: PRODUCT_EC_STATUS.HIDDEN, label: '非公開' },
  {
    value: 'excluded',
    status: PRODUCT_EC_STATUS.EC_EXCLUDED,
    label: 'EC販売対象外',
  },
  { value: 'retired', status: PRODUCT_EC_STATUS.RETIRED, label: '販売終了' },
];

const ecStatusClass: Record<ProductEcStatus, string> = {
  PUBLISHED: 'bg-emerald-50 text-emerald-800',
  PREPARING: 'bg-amber-50 text-amber-900',
  HIDDEN: 'bg-stone-100 text-stone-700',
  EC_EXCLUDED: 'bg-rose-50 text-rose-800',
  RETIRED: 'bg-slate-100 text-slate-700',
};

const scalarParams = (values: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

const pageHref = (
  query: Awaited<ReturnType<typeof adminProductQueryValidator.parse>>,
  page: number,
) => {
  const params = new URLSearchParams({ page: String(page) });
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.ecStatus !== 'all') params.set('ecStatus', query.ecStatus);
  if (query.source !== 'all') params.set('source', query.source);
  if (query.imageStatus !== 'all') params.set('imageStatus', query.imageStatus);
  return `/admin/products?${params.toString()}`;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const canEdit =
    admin.role === AdminRole.OWNER || admin.role === AdminRole.MANAGER;
  const query = adminProductQueryValidator.parse(
    scalarParams(await searchParams),
  );
  const [result, syncStatus] = await Promise.all([
    service.getProducts(query),
    syncService.getProductionSmaregiSyncStatus(),
  ]);
  const returnTo = pageHref(query, query.page);

  return (
    <main className="wrap py-16">
      <Link href="/admin" className="text-xs text-stone-500">
        ← 管理トップ
      </Link>
      <p className="eyebrow mt-5">PRODUCT MANAGEMENT</p>
      <h1 className="serif mt-3 text-5xl">商品管理</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
        スマレジの商品情報と在庫を確認し、LINXAS EC
        の掲載内容・画像・公開状態を管理します。
      </p>

      <ProductionSmaregiSyncPanel status={syncStatus} canSync={canEdit} />

      <form className="mt-10 grid gap-4 border-y line py-6 md:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs lg:col-span-2">
          商品検索
          <input
            name="q"
            defaultValue={query.q ?? ''}
            className="input mt-2"
            placeholder="商品名・商品コード・Smaregi ID"
          />
        </label>
        <label className="text-xs">
          カテゴリ
          <select
            name="category"
            defaultValue={query.category ?? ''}
            className="input mt-2"
          >
            <option value="">すべて</option>
            {result.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          EC公開状態
          <select
            name="ecStatus"
            defaultValue={query.ecStatus}
            className="input mt-2"
          >
            {ecStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          商品ソース
          <select
            name="source"
            defaultValue={query.source}
            className="input mt-2"
          >
            <option value="all">すべて</option>
            <option value="smaregi">Smaregi商品</option>
            <option value="local">既存サイト商品</option>
          </select>
        </label>
        <label className="text-xs">
          画像
          <select
            name="imageStatus"
            defaultValue={query.imageStatus}
            className="input mt-2"
          >
            <option value="all">すべて</option>
            <option value="with">画像あり</option>
            <option value="without">画像なし</option>
          </select>
        </label>
        <div className="flex items-end gap-3 md:col-span-2 lg:col-span-6">
          <button className="btn bg-[#171412] text-white">検索</button>
          <Link href="/admin/products" className="text-xs underline">
            条件をリセット
          </Link>
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-xs text-stone-500">
          {result.pagination.total}件・{result.pagination.page}/
          {Math.max(1, result.pagination.totalPages)}ページ
        </p>
        {!canEdit ? (
          <p className="text-xs text-amber-800">閲覧のみ可能です。</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {ecStatusOptions.map((option) => (
          <Link
            key={option.value}
            href={pageHref({ ...query, ecStatus: option.value }, 1)}
            className={`rounded-full border px-3 py-1.5 ${
              query.ecStatus === option.value
                ? 'border-[#6d2227] bg-[#6d2227] text-white'
                : 'border-stone-200 text-stone-600'
            }`}
          >
            {option.label}{' '}
            {option.status
              ? result.ecStatusCounts[option.status]
              : result.pagination.total}
          </Link>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto border-y line">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="bg-[#faf8f4] text-xs text-stone-500">
            <tr>
              <th className="p-3">商品</th>
              <th className="p-3">商品コード</th>
              <th className="p-3">カテゴリ</th>
              <th className="p-3">価格</th>
              <th className="p-3">EC販売可能数</th>
              <th className="p-3">画像</th>
              <th className="p-3">EC公開状態</th>
              <th className="p-3">最終同期</th>
              <th className="w-28 p-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y line">
            {result.items.map((product) => {
              const imageUrl = product.images[0]?.imageUrl;
              return (
                <tr key={product.id}>
                  <td className="p-3">
                    <div className="flex min-w-[280px] items-center gap-3">
                      <div className="relative h-16 w-14 overflow-hidden bg-[#f7f4ee]">
                        {imageUrl ? (
                          <Image
                            fill
                            sizes="56px"
                            src={imageUrl}
                            alt=""
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[9px] text-stone-400">
                            画像なし
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        {product.source === 'smaregi' ? (
                          <span className="mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                            Smaregi
                          </span>
                        ) : (
                          <span className="mt-1 text-[10px] text-stone-500">
                            既存サイト
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-xs">{product.productCode}</td>
                  <td className="p-3">{product.category.name}</td>
                  <td className="p-3">{formatPrice(product.price)}</td>
                  <td className="p-3 font-semibold">
                    {product.availableQuantity}
                  </td>
                  <td className="p-3">
                    {product.images.length > 0 ? (
                      <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                        画像あり ({product.images.length})
                      </span>
                    ) : (
                      <span className="inline-flex whitespace-nowrap rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-600">
                        画像なし
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${ecStatusClass[product.ecStatus]}`}
                    >
                      {PRODUCT_EC_STATUS_LABEL[product.ecStatus]}
                    </span>
                    {product.ecStatusReason ? (
                      <p className="mt-1 max-w-40 text-[10px] leading-4 text-stone-500">
                        {product.ecStatusReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3 text-xs text-stone-500">
                    {product.lastSyncedAt
                      ? new Date(product.lastSyncedAt).toLocaleString('ja-JP')
                      : '—'}
                  </td>
                  <td className="w-28 p-3 text-right">
                    {canEdit ? (
                      <Link
                        href={createAdminProductEditHref(product.id, returnTo)}
                        className="btn btn-outline min-h-10 min-w-20 whitespace-nowrap px-4 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171412]"
                      >
                        編集 →
                      </Link>
                    ) : (
                      <span className="text-xs text-stone-400">閲覧のみ</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {result.items.length === 0 ? (
          <p className="py-16 text-center text-sm text-stone-500">
            該当する商品はありません。
          </p>
        ) : null}
      </div>

      <nav className="mt-8 flex justify-center gap-3 text-xs">
        {query.page > 1 ? (
          <Link
            className="btn btn-outline"
            href={pageHref(query, query.page - 1)}
          >
            ← 前へ
          </Link>
        ) : null}
        {query.page < result.pagination.totalPages ? (
          <Link
            className="btn btn-outline"
            href={pageHref(query, query.page + 1)}
          >
            次へ →
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
