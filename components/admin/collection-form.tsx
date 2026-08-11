'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionImageUpload } from '@/components/admin/collection-image-upload';

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

export function CollectionForm({ collection }: { collection?: Collection }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string[]>(
    collection?.products.map(({ product }) => product.id) ?? [],
  );
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [desktopImageUploading, setDesktopImageUploading] = useState(false);
  const [mobileImageUploading, setMobileImageUploading] = useState(false);
  const imageUploading = desktopImageUploading || mobileImageUploading;

  useEffect(() => {
    const loadProducts = async () => {
      const response = await fetch('/api/v1/products?limit=100');
      const payload = (await response.json()) as {
        data?: { items?: Product[] };
      };
      setProducts(payload.data?.items ?? []);
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
    if (imageUploading) {
      setMessage('画像のアップロード完了後に保存してください。');
      return;
    }
    setSaving(true);
    setMessage('');
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
      setMessage('保存できませんでした。入力内容を確認してください。');
      setSaving(false);
      return;
    }
    const result = (await response.json()) as { data: { id: string } };
    router.push(`/admin/collections/${result.data.id}`);
    router.refresh();
  };

  const remove = async () => {
    if (!collection || !window.confirm('このコレクションを削除しますか？'))
      return;
    const response = await fetch(`/api/v1/admin/collections/${collection.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setMessage(
        '公開中のコレクションは削除できません。先に下書きまたはアーカイブに変更してください。',
      );
      return;
    }
    router.push('/admin/collections');
    router.refresh();
  };

  return (
    <form action={submit} className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/collections" className="text-xs text-stone-500">
            ← コレクション一覧
          </Link>
          <h1 className="serif mt-3 text-4xl">
            {collection ? 'コレクションを編集' : 'コレクションを新規作成'}
          </h1>
        </div>
        {collection ? (
          <button
            type="button"
            onClick={remove}
            className="text-xs text-[#6d2227] underline"
          >
            削除
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="border border-[#6d2227] p-4 text-sm text-[#6d2227]">
          {message}
        </p>
      ) : null}
      <div className="grid gap-6 border-y line py-8 md:grid-cols-2">
        <label className="text-sm">
          タイプ
          <select
            name="type"
            defaultValue={collection?.type ?? 'HERO'}
            className="mt-2 w-full border line bg-white p-3"
          >
            {collectionTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          シーズン（SEASONAL のみ）
          <select
            name="season"
            defaultValue={collection?.season ?? ''}
            className="mt-2 w-full border line bg-white p-3"
          >
            <option value="">選択しない</option>
            {seasons.map((season) => (
              <option key={season}>{season}</option>
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
              <option key={status}>{status}</option>
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
          label="デスクトップ画像"
          initialUrl={collection?.desktopImageUrl}
          onUploadingChange={setDesktopImageUploading}
        />
        <CollectionImageUpload
          name="mobileImageUrl"
          label="モバイル画像"
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
          チェックで追加・削除し、矢印で表示順を調整できます。
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
        disabled={saving || imageUploading}
        className="btn bg-[#171412] text-white disabled:opacity-50"
      >
        {saving ? '保存中…' : imageUploading ? '画像アップロード中…' : '保存する'}
      </button>
    </form>
  );
}
