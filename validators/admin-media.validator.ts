import { z } from 'zod';
import { MAX_ADMIN_MEDIA_FILE_SIZE } from '@/config/media';

export const adminMediaPresignValidator = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .refine((contentType) => contentType.startsWith('image/'), {
      message: 'Only image files are allowed.',
    }),
  fileSize: z.number().int().positive().max(MAX_ADMIN_MEDIA_FILE_SIZE, {
    message: 'Image file size must not exceed 10 MB.',
  }),
});

export type AdminMediaPresignInput = z.infer<typeof adminMediaPresignValidator>;
