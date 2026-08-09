import { z } from 'zod';

export const adminLoginValidator = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});
