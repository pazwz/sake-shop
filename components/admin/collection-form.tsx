'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionImageUpload } from '@/components/admin/collection-image-upload';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import { getCollectionAreaLabel } from '@/lib/collection-presentation';

type Product = {
  id: string;
  name: string;
  slug: string;
  producer: string | null;
};
type CollectionProduct = { product: Product };
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
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>(
    collection?.products.map(({ product }) => product.id) ?? [],
  );
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
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/v1/products?limit=100');
        if (!response.ok) throw new Error('Product request failed.');
        const payload = (await response.json()) as {
          data?: { items?: Product[] };
        };
        setProducts(payload.data?.items ?? []);
      } catch {
        setFeedback({
          kind: 'error',
          text: '商品一覧を読み込めませんでした。ページを再読み込みしてください。',
        });
      }
    };
    void loadProducts();
  }, []);

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
        productIds: selected,
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
      <div className="grid gap-6 border-y line py-8 md:grid-cols-2">
        <input type="hidden" name="type" value={defaultType} />
        <input type="hidden" name="season" value={defaultSeason ?? ''} />
        <input
          type="hidden"
          name="displayOrder"
          value={collection?.displayOrder ?? 0}
        />
        <label className="text-sm">
          トップページへの表示
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
      <section>
        <p className="eyebrow">FEATURED PRODUCTS</p>
        <h2 className="serif mt-3 text-3xl">掲載商品</h2>
        <p className="mt-2 text-sm text-stone-600">
          チェックした商品をこの特集に掲載します。矢印で表示順を調整できます。
          {productLimit
            ? ` トップページには先頭${productLimit}件、特集ページには選択した商品をすべて表示します。`
            : ''}
        </p>
        <p className="mt-3 text-sm font-semibold text-[#6d2227]">
          {selected.length}件選択中
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {products.map((product) => {
            const isSelected = selected.includes(product.id);
            return (
              <div
                key={product.id}
                className="flex items-center gap-3 border line p-3"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() =>
                    isSelected
                      ? setSelected(selected.filter((id) => id !== product.id))
                      : setSelected([...selected, product.id])
                  }
                />
                <span className="flex-1 text-sm">
                  {product.name}
                  <span className="ml-2 text-xs text-stone-500">
                    {product.producer ?? ''}
                  </span>
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
      </section>
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
