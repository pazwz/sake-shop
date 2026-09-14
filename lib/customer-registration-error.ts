import { Prisma } from '@prisma/client';

export const CUSTOMER_REGISTRATION_STAGES = [
  'TOKEN_GENERATION',
  'PASSWORD_HASH',
  'CUSTOMER_CREATE',
  'SESSION_CREATE',
  'VERIFICATION_TOKEN_CREATE',
  'EMAIL_OUTBOX_ENQUEUE',
  'NEWSLETTER_UPSERT',
  'NEWSLETTER_OUTBOX_ENQUEUE',
  'PREVIOUS_SESSION_REVOKE',
  'TRANSACTION_COMMIT',
] as const;

export type CustomerRegistrationStage =
  (typeof CUSTOMER_REGISTRATION_STAGES)[number];

export class CustomerRegistrationError extends Error {
  public readonly prismaCode: string | null;

  public constructor(
    public readonly stage: CustomerRegistrationStage,
    cause: unknown,
  ) {
    super('Customer registration operation failed.', { cause });
    this.name = 'CustomerRegistrationError';
    this.prismaCode =
      cause instanceof Prisma.PrismaClientKnownRequestError
        ? cause.code
        : cause instanceof CustomerRegistrationError
          ? cause.prismaCode
          : null;
  }
}
