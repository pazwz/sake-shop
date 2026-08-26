import { z } from 'zod';
import {
  SMAREGI_CONTRACT_ACTIONS,
  SMAREGI_CONTRACT_EVENT,
} from '@/config/smaregi';

const smaregiSubscriptionItemValidator = z.object({
  price: z.number().int(),
  unit_price: z.number().int(),
  quantity: z.number().int(),
  name: z.string().min(1),
});

const smaregiSubscriptionPlanValidator =
  smaregiSubscriptionItemValidator.extend({
    trial_days: z.number().int(),
  });

export const smaregiContractNotificationValidator = z.object({
  event: z.literal(SMAREGI_CONTRACT_EVENT),
  action: z.enum(SMAREGI_CONTRACT_ACTIONS),
  date: z.string().date(),
  contractId: z.string().min(1),
  clientId: z.string().min(1),
  plan: smaregiSubscriptionPlanValidator,
  options: z.array(smaregiSubscriptionItemValidator),
});

export const smaregiContractRequestValidator = z
  .object({
    headers: z.object({
      contentType: z
        .string()
        .refine(
          (value) =>
            value.split(';', 1)[0]?.trim().toLowerCase() === 'application/json',
        ),
      contractId: z.string().min(1),
      event: z.literal(SMAREGI_CONTRACT_EVENT),
    }),
    body: smaregiContractNotificationValidator,
  })
  .superRefine(({ headers, body }, context) => {
    if (headers.contractId !== body.contractId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'contractId'],
        message: 'Contract ID must match the Smaregi-Contract-Id header.',
      });
    }
  });

export const smaregiFullSyncValidator = z.object({
  mode: z.literal('FULL').default('FULL'),
});

export const smaregiOrderSyncValidator = z.object({
  orderId: z.string().cuid(),
});
