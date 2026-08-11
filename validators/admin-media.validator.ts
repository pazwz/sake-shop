import { z } from 'zod';

export const MAX_ADMIN_MEDIA_FILE_SIZE = 10 * 1024 * 1024;

const isFile = (value: unknown): value is File =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  typeof value.name === 'string' &&
  'type' in value &&
  typeof value.type === 'string' &&
  'size' in value &&
  typeof value.size === 'number' &&
  'arrayBuffer' in value &&
  typeof value.arrayBuffer === 'function';

export const adminMediaFileValidator = z
  .custom<File>(isFile, { message: 'An image file is required.' })
  .refine((file) => file.type.startsWith('image/'), {
    message: 'Only image files are allowed.',
  })
  .refine((file) => file.size <= MAX_ADMIN_MEDIA_FILE_SIZE, {
    message: 'Image file size must not exceed 10 MB.',
  });
