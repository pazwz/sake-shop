export const MAX_ADMIN_MEDIA_FILE_SIZE = 10 * 1024 * 1024;

export const ADMIN_MEDIA_UPLOAD_TIMEOUT_MS = 120_000;

// Admin uploads always receive a new UUID key; replacing an image changes its URL.
export const IMMUTABLE_IMAGE_CACHE_CONTROL =
  'public, max-age=31536000, immutable';
