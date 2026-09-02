'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_ADMIN_MEDIA_FILE_SIZE } from '@/config/media';
import { uploadAdminImage } from '@/lib/admin-media-upload';
import { formatPrice } from '@/lib/products';
import type {
  AdminProductImage,
  AdminProductRecord,
  ProductPublicationResult,
} from '@/types/admin-product';

const storeLabels: Record<string, string> = {
  '1': 'リンクサス福岡',
  '2': '倉庫４階',
  '3': '倉庫2階',
  '6': '別倉庫',
};

const errorDetail = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: { detail?: string } };
    return payload.error?.detail ?? fallback;
  } catch {
    return fallback;
  }
};

type Feedback = {
  kind: 'success' | 'error';
  text: string;
};

const FeedbackMessage = ({ feedback }: { feedback: Feedback | null }) =>
  feedback ? (
    <p
      role={feedback.kind === 'error' ? 'alert' : 'status'}
      className={`mt-3 whitespace-pre-line border p-3 text-sm ${
        feedback.kind === 'error'
          ? 'border-red-200 bg-red-50 text-[#6d2227]'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      {feedback.text}
    </p>
  ) : null;

export function ProductEditor({
  initialProduct,
  returnTo,
}: {
  initialProduct: AdminProductRecord;
  returnTo: string;
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialProduct.images);
  const [published, setPublished] = useState(initialProduct.isEcAvailable);
  const [publication, setPublication] = useState<ProductPublicationResult>(
    initialProduct.publication,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<Feedback | null>(
    null,
  );
  const [imageFeedback, setImageFeedback] = useState<Feedback | null>(null);
  const busyRef = useRef(false);

  const refreshProduct = async () => {
    const response = await fetch(
      `/api/v1/admin/products/${initialProduct.id}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return;
    const result = (await response.json()) as { data?: AdminProductRecord };
    if (!result.data) return;
    setImages(result.data.images);
    setPublished(result.data.isEcAvailable);
    setPublication(result.data.publication);
  };

  const submit = async (formData: FormData) => {
    if (busyRef.current || uploading) return;
    busyRef.current = true;
    setSaving(true);
    setSettingsFeedback(null);
    const alcohol = String(formData.get('alcoholPercentage')).trim();
    const payload = {
      slug: String(formData.get('slug')),
      producer: String(formData.get('producer')) || null,
      origin: String(formData.get('origin')) || null,
      volume: String(formData.get('volume')) || null,
      alcoholPercentage: alcohol ? Number(alcohol) : null,
      description: String(formData.get('description')) || null,
      tastingNotes: String(formData.get('tastingNotes')) || null,
      isEcAvailable: formData.get('isEcAvailable') === 'on',
    };
    try {
      const response = await fetch(
        `/api/v1/admin/products/${initialProduct.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setSettingsFeedback({
          kind: 'error',
          text: await errorDetail(
            response,
            '保存に失敗しました。もう一度お試しください。',
          ),
        });
        return;
      }
      const result = (await response.json()) as {
        data?: AdminProductRecord;
      };
      if (!result.data) throw new Error('Invalid response');
      setPublished(result.data.isEcAvailable);
      setPublication(result.data.publication);
      setSettingsFeedback({
        kind: 'success',
        text: 'EC掲載設定を保存しました。',
      });
      router.refresh();
    } catch {
      setSettingsFeedback({
        kind: 'error',
        text: '保存に失敗しました。通信環境を確認してください。',
      });
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || busyRef.current) return;
    setImageFeedback(null);
    if (!file.type.startsWith('image/')) {
      setImageFeedback({
        kind: 'error',
        text: '画像ファイルを選択してください。',
      });
      return;
    }
    if (file.size > MAX_ADMIN_MEDIA_FILE_SIZE) {
      setImageFeedback({
        kind: 'error',
        text: '画像サイズは10MB以下にしてください。',
      });
      return;
    }
    busyRef.current = true;
    setUploading(true);
    try {
      const uploaded = await uploadAdminImage(file);
      const response = await fetch(
        `/api/v1/admin/products/${initialProduct.id}/images`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: uploaded.url,
            altText: initialProduct.name,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await errorDetail(response, '商品画像を登録できませんでした。'),
        );
      const result = (await response.json()) as { data?: AdminProductImage };
      if (!result.data) throw new Error('商品画像を登録できませんでした。');
      setImages((current) => [...current, result.data as AdminProductImage]);
      await refreshProduct();
      setImageFeedback({ kind: 'success', text: '商品画像を登録しました。' });
      router.refresh();
    } catch (error) {
      setImageFeedback({
        kind: 'error',
        text:
          error instanceof Error
            ? error.message
            : '画像のアップロードに失敗しました。もう一度お試しください。',
      });
    } finally {
      busyRef.current = false;
      setUploading(false);
    }
  };

  const saveOrder = async (next: AdminProductImage[]) => {
    const response = await fetch(
      `/api/v1/admin/products/${initialProduct.id}/images/order`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds: next.map(({ id }) => id) }),
      },
    );
    if (!response.ok)
      throw new Error(
        await errorDetail(response, '画像の順序を更新できませんでした。'),
      );
    setImages(next);
    await refreshProduct();
    router.refresh();
  };

  const moveImage = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (busyRef.current || target < 0 || target >= images.length) return;
    busyRef.current = true;
    setImageFeedback(null);
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await saveOrder(next);
      setImageFeedback({
        kind: 'success',
        text: '画像の順序を更新しました。',
      });
    } catch (error) {
      setImageFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '更新に失敗しました。',
      });
    } finally {
      busyRef.current = false;
    }
  };

  const deleteImage = async (imageId: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setImageFeedback(null);
    try {
      const response = await fetch(
        `/api/v1/admin/products/${initialProduct.id}/images/${imageId}`,
        { method: 'DELETE' },
      );
      if (!response.ok)
        throw new Error(
          await errorDetail(response, '商品画像を削除できませんでした。'),
        );
      setImages((current) => current.filter(({ id }) => id !== imageId));
      await refreshProduct();
      setImageFeedback({ kind: 'success', text: '商品画像を削除しました。' });
      router.refresh();
    } catch (error) {
      setImageFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : '削除に失敗しました。',
      });
    } finally {
      busyRef.current = false;
    }
  };

  return (
    <main className="wrap py-16">
      <Link href={returnTo} className="text-xs text-stone-500">
        ← 商品管理
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">PRODUCT EDIT</p>
          <h1 className="serif mt-3 text-4xl">{initialProduct.name}</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            published
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-stone-100 text-stone-600'
          }`}
        >
          {published ? 'EC公開中' : 'EC非公開'}
        </span>
      </div>

      <section className="mt-10 border line bg-[#faf8f4] p-6 md:p-8">
        <p className="eyebrow">スマレジ商品情報</p>
        <h2 className="serif mt-3 text-2xl">Smaregi管理</h2>
        <p className="mt-3 text-sm text-stone-600">
          スマレジから同期される情報です。変更はスマレジ側で行ってください。
        </p>
        <dl className="mt-7 grid gap-x-8 gap-y-5 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-500">商品名</dt>
            <dd className="mt-1">{initialProduct.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">商品コード</dt>
            <dd className="mt-1">{initialProduct.productCode}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Smaregi Product ID</dt>
            <dd className="mt-1">{initialProduct.smaregiProductId}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">カテゴリ</dt>
            <dd className="mt-1">{initialProduct.category.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">価格</dt>
            <dd className="mt-1">{formatPrice(initialProduct.price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Smaregi状態</dt>
            <dd className="mt-1">
              {initialProduct.isActive ? '有効' : '無効'}
            </dd>
          </div>
          <div className="md:col-span-3">
            <dt className="text-xs text-stone-500">最終同期日時</dt>
            <dd className="mt-1">
              {initialProduct.lastSyncedAt
                ? new Date(initialProduct.lastSyncedAt).toLocaleString('ja-JP')
                : '同期情報なし'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 border line p-6 md:p-8">
        <p className="eyebrow">EC INVENTORY</p>
        <h2 className="serif mt-3 text-2xl">EC在庫（閲覧専用）</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialProduct.inventory.map((inventory) => (
            <div key={inventory.smaregiStoreId} className="bg-[#faf8f4] p-4">
              <p className="text-xs text-stone-500">
                {storeLabels[inventory.smaregiStoreId] ??
                  `Store ${inventory.smaregiStoreId}`}
              </p>
              <p className="serif mt-2 text-3xl">{inventory.quantity}</p>
            </div>
          ))}
          <div className="bg-amber-50 p-4">
            <p className="text-xs text-stone-500">EC予約</p>
            <p className="serif mt-2 text-3xl">
              {initialProduct.activeReservedQuantity}
            </p>
          </div>
          <div className="bg-emerald-50 p-4">
            <p className="text-xs text-stone-500">EC販売可能数</p>
            <p className="serif mt-2 text-3xl">
              {initialProduct.availableQuantity}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-stone-500">
          四店物理库存合計：{initialProduct.physicalTotalApproved}
          。在庫はLINXASから変更できません。
        </p>
      </section>

      <section className="mt-8 border line p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">PRODUCT IMAGES</p>
            <h2 className="serif mt-3 text-2xl">商品画像</h2>
            <p className="mt-3 text-sm text-stone-600">
              先頭の画像が商品一覧の主画像になります。
            </p>
          </div>
          <label className="btn btn-outline cursor-pointer text-xs">
            {uploading ? 'アップロード中…' : '画像を追加'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading || saving}
              className="sr-only"
              onChange={(event) => {
                void upload(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-500">画像形式・最大10MB</p>
        <FeedbackMessage feedback={imageFeedback} />
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="border line p-3">
              <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
                <Image
                  fill
                  sizes="240px"
                  src={image.imageUrl}
                  alt={image.altText ?? initialProduct.name}
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 bg-white px-2 py-1 text-[10px] font-semibold">
                    主画像
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex justify-between gap-2 text-xs">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => void moveImage(index, -1)}
                  className="underline disabled:text-stone-300"
                >
                  前へ
                </button>
                <button
                  type="button"
                  disabled={index === images.length - 1}
                  onClick={() => void moveImage(index, 1)}
                  className="underline disabled:text-stone-300"
                >
                  後へ
                </button>
                <button
                  type="button"
                  onClick={() => void deleteImage(image.id)}
                  className="text-[#6d2227] underline"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
        {images.length === 0 ? (
          <p className="mt-6 bg-stone-50 p-8 text-center text-sm text-stone-500">
            商品画像はまだ登録されていません。
          </p>
        ) : null}
      </section>

      <form action={submit} className="mt-8 border line p-6 md:p-8">
        <p className="eyebrow">LINXAS EC SETTINGS</p>
        <h2 className="serif mt-3 text-2xl">EC掲載設定</h2>
        <p className="mt-3 text-sm text-stone-600">
          LINXAS EC上で表示する内容を編集できます。
        </p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            URLスラッグ
            <input
              name="slug"
              defaultValue={initialProduct.slug}
              className="input mt-2"
              required
            />
          </label>
          <label className="text-sm">
            蔵元・生産者
            <input
              name="producer"
              defaultValue={initialProduct.producer ?? ''}
              className="input mt-2"
            />
          </label>
          <label className="text-sm">
            産地
            <input
              name="origin"
              defaultValue={initialProduct.origin ?? ''}
              className="input mt-2"
            />
          </label>
          <label className="text-sm">
            容量
            <input
              name="volume"
              defaultValue={initialProduct.volume ?? ''}
              className="input mt-2"
            />
          </label>
          <label className="text-sm">
            アルコール度数
            <input
              name="alcoholPercentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={initialProduct.alcoholPercentage ?? ''}
              className="input mt-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            商品説明
            <textarea
              name="description"
              defaultValue={initialProduct.description ?? ''}
              rows={6}
              className="input mt-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            テイスティングノート
            <textarea
              name="tastingNotes"
              defaultValue={initialProduct.tastingNotes ?? ''}
              rows={5}
              className="input mt-2"
            />
          </label>
        </div>

        <label className="mt-7 flex items-center justify-between gap-5 border-y line py-5">
          <span>
            <span className="block font-semibold">EC公開</span>
            <span className="mt-1 block text-xs text-stone-500">
              公開すると一般の商品一覧・検索・商品ページに表示されます。
            </span>
          </span>
          <input
            name="isEcAvailable"
            type="checkbox"
            defaultChecked={published}
            className="h-5 w-5"
          />
        </label>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {publication.errors.length ? (
            <div className="border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-[#6d2227]">公開できません</p>
              <ul className="mt-2 space-y-1 text-sm text-[#6d2227]">
                {publication.errors.map((issue) => (
                  <li key={issue.code}>・{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              公開に必要な項目が揃っています。
            </div>
          )}
          {publication.warnings.length ? (
            <div className="border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">確認事項</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {publication.warnings.map((warning) => (
                  <li key={warning.code}>・{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <button
          disabled={saving || uploading}
          className="btn mt-8 bg-[#171412] text-white disabled:opacity-50"
        >
          {saving ? '保存中…' : 'EC掲載設定を保存'}
        </button>
        <FeedbackMessage feedback={settingsFeedback} />
      </form>
    </main>
  );
}
