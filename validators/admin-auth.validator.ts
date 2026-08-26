import { z } from 'zod';

export const adminLoginValidator = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(8).max(128),
});
