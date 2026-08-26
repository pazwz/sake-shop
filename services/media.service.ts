import 'server-only';

import { randomUUID } from 'node:crypto';
import { createPresignedUpload } from '@/lib/aws/s3';
import type { AdminMediaPresignInput } from '@/validators/admin-media.validator';

const MAX_FILENAME_LENGTH = 120;

const sanitizeFilename = (filename: string) => {
  const sanitized = filename
    .normalize('NFKC')
    .replace(/[\\/]/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^\.+/, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_FILENAME_LENGTH);

  return sanitized || 'image';
};

export class MediaService {
  public async createPresignedImageUpload({
    fileName,
    contentType,
  }: AdminMediaPresignInput) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `uploads/${year}/${month}/${randomUUID()}-${sanitizeFilename(fileName)}`;
    const { uploadUrl, url } = await createPresignedUpload(key, contentType);

    return { uploadUrl, key, url };
  }
}
