import { z } from 'zod';

export const smaregiFullSyncValidator = z.object({
  mode: z.literal('FULL').default('FULL'),
});

export const smaregiOrderSyncValidator = z.object({
  orderId: z.string().cuid(),
});
