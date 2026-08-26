import { ADMIN_MEDIA_UPLOAD_TIMEOUT_MS } from '@/config/media';

type PresignedUpload = {
  uploadUrl: string;
  key: string;
  url: string;
};

const UPLOAD_FAILED_MESSAGE =
  '画像のアップロードに失敗しました。もう一度お試しください。';
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
      throw new Error(UPLOAD_FAILED_MESSAGE);
    }

    let payload: unknown;
    try {
      payload = await presignResponse.json();
    } catch {
      throw new Error(INVALID_RESPONSE_MESSAGE);
    }

    if (!presignResponse.ok) throw new Error(UPLOAD_FAILED_MESSAGE);
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
        headers: { 'Content-Type': file.type },
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
