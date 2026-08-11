import 'server-only';

import { randomUUID } from 'node:crypto';
import { uploadFile } from '@/lib/aws/s3';

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
  public async uploadImage(file: File) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `uploads/${year}/${month}/${randomUUID()}-${sanitizeFilename(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadFile(buffer, key, file.type);

    return { url, key };
  }
}
