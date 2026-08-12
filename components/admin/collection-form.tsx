'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionImageUpload } from '@/components/admin/collection-image-upload';
import {
  collectionTypeLabels,
  getCollectionAreaLabel,
  seasonLabels,
  statusLabels,
} from '@/lib/collection-presentation';

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
  publishStartAt: string | null;
  publishEndAt: string | null;
  displayOrder: number;
  products: CollectionProduct[];
};

const collectionTypes = [
  'HERO',
  'SEASONAL',
  'SHOPKEEPER',
  'GIFT',
  'EDITORIAL',
  'STORY',
];
const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const seasons = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

const dateValue = (value: string | null) => (value ? value.slice(0, 16) : '');

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
    initialSaved
      ? { kind: 'success', text: '変更を保存しました。' }
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [deleting, setDeleting] = useState(false);
  const [desktopImageUploading, setDesktopImageUploading] = useState(false);
  const [mobileImageUploading, setMobileImageUploading] = useState(false);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageUploading = desktopImageUploading || mobileImageUploading;
  const defaultType = collection?.type ?? initialType;
  const defaultSeason = collection?.season ?? initialSeason;
  const areaLabel = getCollectionAreaLabel(defaultType, defaultSeason);

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
    if (savingRef.current || deletingRef.current) return;
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
        publishStartAt: String(formData.get('publishStartAt'))
          ? new Date(String(formData.get('publishStartAt'))).toISOString()
          : null,
        publishEndAt: String(formData.get('publishEndAt'))
          ? new Date(String(formData.get('publishEndAt'))).toISOString()
          : null,
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

  const remove = async () => {
    if (
      !collection ||
      savingRef.current ||
      deletingRef.current ||
      !window.confirm('このホームページコンテンツを削除しますか？')
    )
      return;
    deletingRef.current = true;
    setDeleting(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/v1/admin/collections/${collection.id}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setFeedback({
          kind: 'error',
          text:
            response.status === 409
              ? '公開中のコンテンツは削除できません。先に下書きまたはアーカイブへ変更してください。'
              : await getErrorDetail(
                  response,
                  'ホームページコンテンツを削除できませんでした。',
                ),
        });
        return;
      }
      router.push('/admin/collections');
      router.refresh();
    } catch {
      setFeedback({
        kind: 'error',
        text: '通信エラーが発生しました。もう一度お試しください。',
      });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
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
            {collection
              ? `${areaLabel}を編集`
              : 'ホームページのコンテンツを追加'}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {collection
              ? `${areaLabel}に表示する内容を設定します。`
              : '追加するホームページのエリアを選び、内容を設定します。'}
          </p>
        </div>
        {collection ? (
          <button
            type="button"
            onClick={remove}
            disabled={saving || deleting || imageUploading}
            className="text-xs text-[#6d2227] underline disabled:opacity-50"
          >
            {deleting ? '削除中…' : '削除'}
          </button>
        ) : null}
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
        <label className="text-sm">
          表示する場所
          <select
            name="type"
            defaultValue={defaultType}
            className="mt-2 w-full border line bg-white p-3"
          >
            {collectionTypes.map((type) => (
              <option key={type} value={type}>
                {collectionTypeLabels[type] ?? type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          季節（「季節の特集」のみ）
          <select
            name="season"
            defaultValue={defaultSeason ?? ''}
            className="mt-2 w-full border line bg-white p-3"
          >
            <option value="">選択しない</option>
            {seasons.map((season) => (
              <option key={season} value={season}>
                {seasonLabels[season] ?? season}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          公開状態
          <select
            name="status"
            defaultValue={collection?.status ?? 'DRAFT'}
            className="mt-2 w-full border line bg-white p-3"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status] ?? status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          表示順
          <input
            name="displayOrder"
            type="number"
            min="0"
            defaultValue={collection?.displayOrder ?? 0}
            className="mt-2 w-full border line bg-white p-3"
          />
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
          description="未設定の場合はメイン画像をスマートフォンでも自動的に使用します。スマートフォンで構図を変えたい場合のみ設定してください。"
          emptyMessage="未設定（メイン画像を使用）"
          initialUrl={collection?.mobileImageUrl}
          onUploadingChange={setMobileImageUploading}
        />
        <label className="text-sm">
          公開開始
          <input
            name="publishStartAt"
            type="datetime-local"
            defaultValue={dateValue(collection?.publishStartAt ?? null)}
            className="mt-2 w-full border line bg-white p-3"
          />
        </label>
        <label className="text-sm">
          公開終了
          <input
            name="publishEndAt"
            type="datetime-local"
            defaultValue={dateValue(collection?.publishEndAt ?? null)}
            className="mt-2 w-full border line bg-white p-3"
          />
        </label>
      </div>
      <section>
        <p className="eyebrow">FEATURED PRODUCTS</p>
        <h2 className="serif mt-3 text-3xl">掲載商品</h2>
        <p className="mt-2 text-sm text-stone-600">
          チェックした商品がトップページに表示されます。矢印で表示順を調整できます。
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
                    setSelected(
                      isSelected
                        ? selected.filter((id) => id !== product.id)
                        : [...selected, product.id],
                    )
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
        disabled={saving || deleting || imageUploading}
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
