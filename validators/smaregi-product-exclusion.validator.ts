import { z } from 'zod';

export const smaregiProductExclusionRevokeValidator = z
  .object({ smaregiProductId: z.string().trim().regex(/^\d+$/) })
  .strict();
