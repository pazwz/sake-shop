import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CustomerRegistrationError } from '@/lib/customer-registration-error';

export const createServerRequestId = () => randomUUID();

export const toSafeServerErrorLog = (input: {
  route: string;
  requestId: string;
  error: unknown;
}) => {
  const registrationError =
    input.error instanceof CustomerRegistrationError ? input.error : null;
  const cause = registrationError?.cause ?? input.error;
  const prismaCode =
    registrationError?.prismaCode ??
    (cause instanceof Prisma.PrismaClientKnownRequestError ? cause.code : null);
  return {
    level: 'error' as const,
    route: input.route,
    requestId: input.requestId,
    errorName: input.error instanceof Error ? input.error.name : 'UnknownError',
    prismaCode,
    operationStage: registrationError?.stage ?? 'UNKNOWN',
    safeMessage:
      cause instanceof Error && cause.message === 'EMAIL_TOKEN_SECRET_MISSING'
        ? 'Required email token signing secret is missing.'
        : prismaCode
          ? 'Customer registration database operation failed.'
          : 'Unexpected customer registration error.',
  };
};

export const logSafeServerError = (input: {
  route: string;
  requestId: string;
  error: unknown;
}) => {
  console.error(JSON.stringify(toSafeServerErrorLog(input)));
};
