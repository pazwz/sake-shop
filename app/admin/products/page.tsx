import { AdminRole } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPrice } from '@/lib/products';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { AdminProductService } from '@/services/admin-product.service';
import { adminProductQueryValidator } from '@/validators/admin-product.validator';

const service = new AdminProductService();

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
  const result = await service.getProducts(query);

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

      <form className="mt-10 grid gap-4 border-y line py-6 md:grid-cols-5">
        <label className="text-xs md:col-span-2">
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
            <option value="all">すべて</option>
            <option value="published">公開中</option>
            <option value="unpublished">非公開</option>
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
        <div className="flex items-end gap-3 md:col-span-5">
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

      <div className="mt-5 overflow-x-auto border-y line">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-[#faf8f4] text-xs text-stone-500">
            <tr>
              <th className="p-3">商品</th>
              <th className="p-3">商品コード</th>
              <th className="p-3">カテゴリ</th>
              <th className="p-3">価格</th>
              <th className="p-3">EC販売可能数</th>
              <th className="p-3">公開</th>
              <th className="p-3">最終同期</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y line">
            {result.items.map((product) => {
              const imageUrl = product.images[0]?.imageUrl;
              return (
                <tr key={product.id}>
                  <td className="p-3">
                    <div className="flex min-w-[280px] items-center gap-3">
                      <div className="relative h-16 w-14 overflow-hidden bg-stone-100">
                        {imageUrl ? (
                          <Image
                            fill
                            sizes="56px"
                            src={imageUrl}
                            alt=""
                            className="object-cover"
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
                    <span
                      className={
                        product.isEcAvailable
                          ? 'font-semibold text-emerald-700'
                          : 'text-stone-500'
                      }
                    >
                      {product.isEcAvailable ? '公開中' : '非公開'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-stone-500">
                    {product.lastSyncedAt
                      ? new Date(product.lastSyncedAt).toLocaleString('ja-JP')
                      : '—'}
                  </td>
                  <td className="p-3 text-right">
                    {canEdit ? (
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-xs font-semibold underline"
                      >
                        編集
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
