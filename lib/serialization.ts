import 'server-only';

import { Prisma } from '@prisma/client';

type JsonPrimitive = string | number | boolean | null;

export type JsonCompatible<T> = T extends Prisma.Decimal
  ? string
  : T extends Date
    ? string
    : T extends bigint
      ? string
      : T extends undefined
        ? null
        : T extends JsonPrimitive
          ? T
          : T extends ReadonlyArray<infer Item>
            ? JsonCompatible<Item>[]
            : T extends object
              ? { [Key in keyof T]: JsonCompatible<T[Key]> }
              : null;

export const serializeForJson = <T>(value: T): JsonCompatible<T> => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value as JsonCompatible<T>;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : null) as JsonCompatible<T>;
  }
  if (typeof value === 'bigint') {
    return value.toString() as JsonCompatible<T>;
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return null as JsonCompatible<T>;
  }
  if (value instanceof Date) {
    return value.toISOString() as JsonCompatible<T>;
  }
  if (Prisma.Decimal.isDecimal(value)) {
    return value.toString() as JsonCompatible<T>;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item)) as JsonCompatible<T>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      serializeForJson(item),
    ]),
  ) as JsonCompatible<T>;
};
