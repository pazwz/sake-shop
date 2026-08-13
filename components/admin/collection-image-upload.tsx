'use client';

import { useId, useState } from 'react';

type MediaUploadResponse = {
  data?: { url: string; key: string };
  error?: { detail: string };
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const uploadImage = (file: File, onProgress: (progress: number) => void) =>
  new Promise<{ url: string; key: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.set('file', file);

    request.open('POST', '/api/v1/admin/media/upload');
    request.timeout = 120_000;
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener('load', () => {
      let payload: MediaUploadResponse = {};
      try {
        payload = JSON.parse(request.responseText) as MediaUploadResponse;
      } catch {
        reject(new Error('アップロード結果を読み取れませんでした。'));
        return;
      }

      if (request.status >= 200 && request.status < 300 && payload.data) {
        resolve(payload.data);
        return;
      }
      reject(
        new Error(
          payload.error?.detail ?? '画像をアップロードできませんでした。',
        ),
      );
    });
    request.addEventListener('error', () => {
      reject(new Error('画像をアップロードできませんでした。'));
    });
    request.addEventListener('timeout', () => {
      reject(
        new Error(
          '画像のアップロードがタイムアウトしました。通信環境を確認してください。',
        ),
      );
    });
    request.send(formData);
  });

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
  const [url, setUrl] = useState(initialUrl ?? '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setSuccess('');

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください。');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('画像サイズは10MB以下にしてください。');
      return;
    }

    setProgress(0);
    onUploadingChange(true);
    try {
      const uploaded = await uploadImage(file, setProgress);
      setUrl(uploaded.url);
      onUrlChange?.(uploaded.url);
      setProgress(100);
      setSuccess('画像をアップロードしました。変更を保存してください。');
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : '画像をアップロードできませんでした。',
      );
    } finally {
      onUploadingChange(false);
      setProgress(null);
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
          disabled={progress !== null}
          className="sr-only"
          onChange={(event) => {
            void selectFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
        {url && progress === null ? (
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
        {progress !== null ? (
          <span className="text-xs text-stone-600" aria-live="polite">
            アップロード中… {progress}%
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
