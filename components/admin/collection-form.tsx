'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionImageUpload } from '@/components/admin/collection-image-upload';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import {
  getCollectionAreaLabel,
  getCollectionPlacement,
} from '@/lib/collection-presentation';
import type {
  CollectionProductCandidate,
  CollectionProductCandidateResult,
} from '@/types/collection';

type CollectionProduct = { product: CollectionProductCandidate };
type Collection = {
  id: string;
  type: string;
  season: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  status: string;
  displayOrder: number;
  products: CollectionProduct[];
};

const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const statusLabels: Record<string, string> = {
  DRAFT: '下書き（トップページに表示しない）',
  PUBLISHED: 'トップページに表示する',
  ARCHIVED: 'アーカイブ（トップページに表示しない）',
};

const getErrorDetail = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: { detail?: string } };
    return payload.error?.detail ?? fallback;
  } catch {
    return fallback;
  }
};

type Feedback = { kind: 'success' | 'error'; text: string };

export function CollectionForm({
  collection,
  initialType = 'HERO',
  initialSeason = null,
  initialSaved = false,
}: {
  collection?: Collection;
  initialType?: string;
  initialSeason?: string | null;
  initialSaved?: boolean;
}) {
  const router = useRouter();
  const initialProducts =
    collection?.products.map(({ product }) => product) ?? [];
  const [candidateResult, setCandidateResult] =
    useState<CollectionProductCandidateResult | null>(null);
  const [knownProducts, setKnownProducts] = useState<
    Record<string, CollectionProductCandidate>
  >(() =>
    Object.fromEntries(initialProducts.map((product) => [product.id, product])),
  );
  const [selected, setSelected] = useState<string[]>(
    initialProducts.map((product) => product.id),
  );
  const [productQuery, setProductQuery] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(
    initialSaved ? { kind: 'success', text: '変更を保存しました。' } : null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [desktopImageUploading, setDesktopImageUploading] = useState(false);
  const [mobileImageUploading, setMobileImageUploading] = useState(false);
  const savingRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageUploading = desktopImageUploading || mobileImageUploading;
  const defaultType = collection?.type ?? initialType;
  const defaultSeason = collection?.season ?? initialSeason;
  const areaLabel = getCollectionAreaLabel(defaultType, defaultSeason);
  const placement = getCollectionPlacement(
    defaultType,
    defaultSeason,
    collection?.id,
  );
  const productLimit =
    defaultType === 'SHOPKEEPER' || defaultType === 'GIFT'
      ? HOME_CONTENT_LIMITS.shopkeeperProducts
      : null;

  const showSavedFeedback = () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setSaved(true);
    setFeedback({ kind: 'success', text: '変更を保存しました。' });
    feedbackTimerRef.current = setTimeout(() => {
      setSaved(false);
      setFeedback(null);
    }, 3500);
  };

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!initialSaved) return;
    showSavedFeedback();
  }, [initialSaved]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setProductsLoading(true);
      setProductsError(false);
      try {
        const query = new URLSearchParams({
          page: String(candidatePage),
          limit: '50',
        });
        if (productQuery.trim()) query.set('q', productQuery.trim());
        if (productCategory) query.set('category', productCategory);
        const response = await fetch(
          `/api/v1/admin/collections/product-candidates?${query.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error('Product request failed.');
        const payload = (await response.json()) as {
          data?: CollectionProductCandidateResult;
        };
        if (!payload.data) throw new Error('Product response was invalid.');
        setCandidateResult(payload.data);
        setKnownProducts((current) => ({
          ...current,
          ...Object.fromEntries(
            payload.data!.items.map((product) => [product.id, product]),
          ),
        }));
        if (payload.data.pagination.page !== candidatePage) {
          setCandidatePage(payload.data.pagination.page);
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setProductsError(true);
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [candidatePage, productCategory, productQuery]);

  const selectedProducts = selected.flatMap((id) =>
    knownProducts[id] ? [knownProducts[id]] : [],
  );
  const unavailableSelected = selectedProducts.filter(
    (product) => !product.isEligible,
  );
  const visibleProducts = selectedOnly
    ? selectedProducts.filter((product) => {
        const keyword = productQuery.trim().toLocaleLowerCase('ja');
        const matchesKeyword =
          !keyword ||
          [product.name, product.producer ?? '', product.productCode].some(
            (value) => value.toLocaleLowerCase('ja').includes(keyword),
          );
        return (
          matchesKeyword &&
          (!productCategory || product.category.id === productCategory)
        );
      })
    : (candidateResult?.items ?? []);

  const move = (id: string, direction: -1 | 1) => {
    const index = selected.indexOf(id);
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    setSelected(next);
  };

  const submit = async (formData: FormData) => {
    if (savingRef.current) return;
    if (imageUploading) {
      setFeedback({
        kind: 'error',
        text: '画像のアップロード完了後に保存してください。',
      });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFeedback(null);
    setSaved(false);
    try {
      const type = String(formData.get('type'));
      const payload = {
        type,
        season:
          type === 'SEASONAL' ? String(formData.get('season')) || null : null,
        title: String(formData.get('title')),
        subtitle: String(formData.get('subtitle')) || null,
        description: String(formData.get('description')) || null,
        desktopImageUrl: String(formData.get('desktopImageUrl')) || null,
        mobileImageUrl: String(formData.get('mobileImageUrl')) || null,
        status: String(formData.get('status')),
        displayOrder: Number(formData.get('displayOrder')),
        ...(placement.productSelectionAffectsProductGrid
          ? { productIds: selected }
          : {}),
      };
      const response = await fetch(
        collection
          ? `/api/v1/admin/collections/${collection.id}`
          : '/api/v1/admin/collections',
        {
          method: collection ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setFeedback({
          kind: 'error',
          text: await getErrorDetail(
            response,
            '保存に失敗しました。もう一度お試しください。',
          ),
        });
        return;
      }
      const result = (await response.json()) as { data?: { id?: string } };
      if (!result.data?.id) {
        setFeedback({
          kind: 'error',
          text: '保存結果を読み取れませんでした。',
        });
        return;
      }
      if (collection) {
        showSavedFeedback();
        router.refresh();
      } else {
        router.push(`/admin/collections/${result.data.id}?saved=1`);
      }
    } catch {
      setFeedback({
        kind: 'error',
        text: '保存に失敗しました。通信環境を確認してもう一度お試しください。',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form action={submit} className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/collections" className="text-xs text-stone-500">
            ← ホームページ管理
          </Link>
          <h1 className="serif mt-3 text-4xl">
            {collection ? `${areaLabel}を編集` : `${areaLabel}を設定`}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {collection
              ? `${areaLabel}に表示する内容を設定します。`
              : `${areaLabel}に現在表示する内容を設定します。`}
          </p>
        </div>
      </div>
      {feedback ? (
        <p
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          className={`border p-4 text-sm ${
            feedback.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-[#6d2227] bg-red-50 text-[#6d2227]'
          }`}
        >
          {feedback.text}
        </p>
      ) : null}
      <section className="border border-[#6d2227]/20 bg-[#faf8f4] p-5 text-sm">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">種類</dt>
            <dd className="mt-1 font-semibold text-[#6d2227]">
              {placement.type}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">反映位置</dt>
            <dd className="mt-1 font-medium">{placement.affectedArea}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">公開ページ</dt>
            <dd className="mt-1">
              {placement.publicPath ? (
                <Link href={placement.publicPath} className="underline">
                  {placement.publicPath}
                </Link>
              ) : (
                'なし'
              )}
            </dd>
          </div>
        </dl>
      </section>
      <div className="grid gap-6 border-y line py-8 md:grid-cols-2">
        <input type="hidden" name="type" value={defaultType} />
        <input type="hidden" name="season" value={defaultSeason ?? ''} />
        <input
          type="hidden"
          name="displayOrder"
          value={collection?.displayOrder ?? 0}
        />
        <label className="text-sm">
          公開状態
          <select
            name="status"
            defaultValue={collection?.status ?? 'PUBLISHED'}
            className="mt-2 w-full border line bg-white p-3"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status] ?? status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          タイトル
          <input
            name="title"
            required
            defaultValue={collection?.title ?? ''}
            className="mt-2 w-full border line bg-white p-3"
          />
        </label>
        <label className="text-sm md:col-span-2">
          サブタイトル
          <input
            name="subtitle"
            defaultValue={collection?.subtitle ?? ''}
            className="mt-2 w-full border line bg-white p-3"
          />
        </label>
        <label className="text-sm md:col-span-2">
          説明
          <textarea
            name="description"
            defaultValue={collection?.description ?? ''}
            rows={5}
            className="mt-2 w-full border line bg-white p-3"
          />
        </label>
        <CollectionImageUpload
          name="desktopImageUrl"
          label="メイン画像"
          description="PC・タブレット・スマートフォンで自動的に最適化して表示されます。"
          initialUrl={collection?.desktopImageUrl}
          onUploadingChange={setDesktopImageUploading}
        />
        <CollectionImageUpload
          name="mobileImageUrl"
          label="スマートフォン用画像（任意）"
          description="通常はメイン画像のみで問題ありません。スマートフォンで構図を変えたい場合のみ設定してください。"
          emptyMessage="未設定（メイン画像を使用）"
          initialUrl={collection?.mobileImageUrl}
          onUploadingChange={setMobileImageUploading}
        />
      </div>
      {placement.productSelectionAffectsProductGrid ? (
      <section>
        <p className="eyebrow">FEATURED PRODUCTS</p>
        <h2 className="serif mt-3 text-3xl">掲載商品</h2>
        <p className="mt-2 text-sm text-stone-600">
          {placement.productSelectionDescription} 矢印で表示順を調整できます。
          {productLimit
            ? ` トップページには先頭${productLimit}件、特集ページには選択した商品をすべて表示します。`
            : ''}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold text-[#6d2227]">
            {selected.length}件選択中
          </p>
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(event) => setSelectedOnly(event.target.checked)}
            />
            選択中のみ表示
          </label>
        </div>
        {unavailableSelected.length ? (
          <p className="mt-4 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            非公開または販売終了の商品が{unavailableSelected.length}
            件設定されています。関連は自動的に解除されません。
          </p>
        ) : null}
        <div className="mt-6 grid gap-4 border-y line py-5 md:grid-cols-[1fr_260px]">
          <label className="text-xs text-stone-600">
            商品検索
            <input
              value={productQuery}
              onChange={(event) => {
                setProductQuery(event.target.value);
                setCandidatePage(1);
              }}
              placeholder="商品名・メーカー・商品コードで検索"
              className="mt-2 w-full border line bg-white p-3 text-sm text-[#171412]"
            />
          </label>
          <label className="text-xs text-stone-600">
            カテゴリ
            <select
              value={productCategory}
              onChange={(event) => {
                setProductCategory(event.target.value);
                setCandidatePage(1);
              }}
              className="mt-2 w-full border line bg-white p-3 text-sm text-[#171412]"
            >
              <option value="">すべて</option>
              {candidateResult?.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {visibleProducts.map((product) => {
            const isSelected = selected.includes(product.id);
            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 border p-3 ${
                  product.isEligible ? 'line' : 'border-amber-300 bg-amber-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!product.isEligible && !isSelected}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(product.id)
                        ? current.filter((id) => id !== product.id)
                        : [...current, product.id],
                    )
                  }
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{product.name}</span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {[
                      product.producer,
                      product.category.name,
                      product.productCode,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {!product.isEligible ? (
                    <span className="mt-1 block text-xs font-semibold text-amber-800">
                      非公開または販売終了
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <span className="flex gap-2">
                    <span className="self-center text-xs text-stone-500">
                      表示順 {selected.indexOf(product.id) + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(product.id, -1)}
                      className="border px-2"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(product.id, 1)}
                      className="border px-2"
                    >
                      ↓
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {productsLoading && !selectedOnly ? (
          <p className="mt-6 text-sm text-stone-500">商品を読み込み中...</p>
        ) : null}
        {productsError && !selectedOnly ? (
          <p role="alert" className="mt-6 text-sm text-[#6d2227]">
            商品一覧を読み込めませんでした。もう一度お試しください。
          </p>
        ) : null}
        {!productsLoading && !productsError && visibleProducts.length === 0 ? (
          <p className="mt-6 text-sm text-stone-500">
            条件に一致する商品はありません。
          </p>
        ) : null}
        {!selectedOnly && candidateResult?.pagination.total ? (
          <div className="mt-6 flex items-center justify-between border-t line pt-5 text-xs">
            <span className="text-stone-500">
              {candidateResult.pagination.total}件中{' '}
              {(candidateResult.pagination.page - 1) *
                candidateResult.pagination.limit +
                1}
              ～
              {Math.min(
                candidateResult.pagination.page *
                  candidateResult.pagination.limit,
                candidateResult.pagination.total,
              )}
              件
            </span>
            <span className="flex items-center gap-4">
              <button
                type="button"
                disabled={candidateResult.pagination.page <= 1}
                onClick={() =>
                  setCandidatePage(candidateResult.pagination.page - 1)
                }
                className="underline disabled:text-stone-300 disabled:no-underline"
              >
                ← 前へ
              </button>
              <span>
                {candidateResult.pagination.page} /{' '}
                {candidateResult.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={
                  candidateResult.pagination.page >=
                  candidateResult.pagination.totalPages
                }
                onClick={() =>
                  setCandidatePage(candidateResult.pagination.page + 1)
                }
                className="underline disabled:text-stone-300 disabled:no-underline"
              >
                次へ →
              </button>
            </span>
          </div>
        ) : null}
      </section>
      ) : (
        <section className="border-y line py-8">
          <p className="eyebrow">PRODUCTS</p>
          <h2 className="serif mt-3 text-3xl">掲載商品</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600">
            {placement.productSelectionDescription}
          </p>
        </section>
      )}
      <button
        disabled={saving || imageUploading}
        className="btn bg-[#171412] text-white disabled:opacity-50"
      >
        {saving
          ? '保存中...'
          : imageUploading
            ? '画像アップロード中...'
            : saved
              ? '保存しました ✓'
              : '変更を保存'}
      </button>
    </form>
  );
}
