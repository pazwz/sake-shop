import {
  ADMIN_MEDIA_UPLOAD_TIMEOUT_MS,
  IMMUTABLE_IMAGE_CACHE_CONTROL,
} from '@/config/media';

type PresignedUpload = {
  uploadUrl: string;
  key: string;
  url: string;
};

const UPLOAD_FAILED_MESSAGE =
  '画像のアップロードに失敗しました。通信環境を確認して、もう一度お試しください。';
const PREPARATION_FAILED_MESSAGE =
  '画像のアップロードを準備できませんでした。しばらくしてからもう一度お試しください。';
const INVALID_RESPONSE_MESSAGE = 'アップロード結果を読み取れませんでした。';

const isPresignedUpload = (value: unknown): value is PresignedUpload => {
  if (!value || typeof value !== 'object') return false;
  const upload = value as Record<string, unknown>;
  return (
    typeof upload.uploadUrl === 'string' &&
    upload.uploadUrl.length > 0 &&
    typeof upload.key === 'string' &&
    upload.key.length > 0 &&
    typeof upload.url === 'string' &&
    upload.url.length > 0
  );
};

export const uploadAdminImage = async (
  file: File,
): Promise<{ url: string; key: string }> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    ADMIN_MEDIA_UPLOAD_TIMEOUT_MS,
  );

  try {
    let presignResponse: Response;
    try {
      presignResponse = await fetch('/api/v1/admin/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
        signal: controller.signal,
      });
    } catch {
      throw new Error(PREPARATION_FAILED_MESSAGE);
    }

    if (!presignResponse.ok) {
      if (presignResponse.status === 401 || presignResponse.status === 403) {
        throw new Error(
          'ログイン状態と画像のアップロード権限を確認してください。',
        );
      }
      throw new Error(PREPARATION_FAILED_MESSAGE);
    }
    let payload: unknown;
    try {
      payload = await presignResponse.json();
    } catch {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }

    const upload =
      payload && typeof payload === 'object'
        ? (payload as { data?: unknown }).data
        : undefined;
    if (!isPresignedUpload(upload)) {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'Cache-Control': IMMUTABLE_IMAGE_CACHE_CONTROL,
        },
        body: file,
        signal: controller.signal,
      });
    } catch {
      throw new Error(UPLOAD_FAILED_MESSAGE);
    }

    if (!uploadResponse.ok) throw new Error(UPLOAD_FAILED_MESSAGE);

    return { url: upload.url, key: upload.key };
  } finally {
    window.clearTimeout(timeout);
  }
};
