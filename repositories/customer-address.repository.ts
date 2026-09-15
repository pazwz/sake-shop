import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { CustomerAddressInput } from '@/validators/customer-account.validator';

export class CustomerAddressRepository {
  public constructor(private readonly database: PrismaClient = prisma) {}

  list(customerId: string) {
    return this.database.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  findOwned(customerId: string, addressId: string) {
    return this.database.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
  }

  create(customerId: string, input: CustomerAddressInput) {
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`,
      );
      const count = await tx.customerAddress.count({ where: { customerId } });
      const isDefault = input.isDefault || count === 0;
      if (isDefault)
        await tx.customerAddress.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false },
        });
      return tx.customerAddress.create({
        data: { customerId, ...input, isDefault },
      });
    });
  }

  update(customerId: string, addressId: string, input: CustomerAddressInput) {
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`,
      );
      const current = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
      });
      if (!current) return null;
      if (input.isDefault)
        await tx.customerAddress.updateMany({
          where: { customerId, id: { not: addressId }, isDefault: true },
          data: { isDefault: false },
        });
      const updated = await tx.customerAddress.update({
        where: { id: addressId },
        data: { ...input, isDefault: input.isDefault },
      });
      if (current.isDefault && !input.isDefault) {
        const fallback = await tx.customerAddress.findFirst({
          where: { customerId, id: { not: addressId } },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (fallback)
          await tx.customerAddress.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          });
        else
          return tx.customerAddress.update({
            where: { id: addressId },
            data: { isDefault: true },
          });
      }
      return updated;
    });
  }

  delete(customerId: string, addressId: string) {
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`,
      );
      const current = await tx.customerAddress.findFirst({
        where: { id: addressId, customerId },
      });
      if (!current) return null;
      await tx.customerAddress.delete({ where: { id: current.id } });
      if (current.isDefault) {
        const fallback = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (fallback)
          await tx.customerAddress.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          });
      }
      return { deleted: true };
    });
  }
}
