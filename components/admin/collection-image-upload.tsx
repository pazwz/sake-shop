'use client';

import { useId, useRef, useState } from 'react';
import { MAX_ADMIN_MEDIA_FILE_SIZE } from '@/config/media';
import { uploadAdminImage } from '@/lib/admin-media-upload';

export function CollectionImageUpload({
  name,
  label,
  description,
  emptyMessage = '画像はまだ設定されていません',
  initialUrl,
  onUploadingChange,
  onUrlChange,
}: {
  name: string;
  label: string;
  description: string;
  emptyMessage?: string;
  initialUrl?: string | null;
  onUploadingChange: (uploading: boolean) => void;
  onUrlChange?: (url: string) => void;
}) {
  const inputId = useId();
  const uploadingRef = useRef(false);
  const [url, setUrl] = useState(initialUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectFile = async (file: File | undefined) => {
    if (!file || uploadingRef.current) return;
    setError('');
    setSuccess('');

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください。');
      return;
    }
    if (file.size > MAX_ADMIN_MEDIA_FILE_SIZE) {
      setError('画像サイズは10MB以下にしてください。');
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    onUploadingChange(true);
    try {
      const uploaded = await uploadAdminImage(file);
      setUrl(uploaded.url);
      onUrlChange?.(uploaded.url);
      setSuccess('画像をアップロードしました。変更を保存してください。');
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : '画像のアップロードに失敗しました。もう一度お試しください。',
      );
    } finally {
      uploadingRef.current = false;
      onUploadingChange(false);
      setUploading(false);
    }
  };

  return (
    <section className="text-sm md:col-span-2">
      <input type="hidden" name={name} value={url} />
      <p className="font-semibold">{label}</p>
      <p className="mt-2 text-xs leading-6 text-stone-500">{description}</p>
      <div className="mt-2 overflow-hidden border line bg-stone-50">
        {url ? (
          <div
            role="img"
            aria-label={`${label}のプレビュー`}
            className="aspect-[16/7] w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
          />
        ) : (
          <div className="flex aspect-[16/7] items-center justify-center text-sm text-stone-500">
            {emptyMessage}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer border line bg-white px-4 py-2 text-xs"
        >
          {url ? '画像を差し替える' : '画像を選択'}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={uploading}
          className="sr-only"
          onChange={(event) => {
            void selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        {url && !uploading ? (
          <button
            type="button"
            onClick={() => {
              setUrl('');
              onUrlChange?.('');
              setError('');
              setSuccess('画像の設定を解除しました。変更を保存してください。');
            }}
            className="text-xs text-stone-500 underline"
          >
            画像を解除
          </button>
        ) : null}
        {uploading ? (
          <span className="text-xs text-stone-600" aria-live="polite">
            アップロード中…
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-[#6d2227]" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="mt-2 text-xs font-semibold text-emerald-700"
          role="status"
        >
          {success}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-stone-500">画像形式・最大10MB</p>
    </section>
  );
}
