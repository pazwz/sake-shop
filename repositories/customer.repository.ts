import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const publicCustomerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
} satisfies Prisma.CustomerSelect;

type CustomerDatabase = Pick<PrismaClient, '$transaction'> & {
  customer: PrismaClient['customer'];
  customerSession: PrismaClient['customerSession'];
  customerAddress: PrismaClient['customerAddress'];
};

export class CustomerRepository {
  public constructor(private readonly database: CustomerDatabase = prisma) {}

  findAuthenticationByEmail(email: string) {
    return this.database.customer.findUnique({
      where: { email },
      select: { ...publicCustomerSelect, passwordHash: true },
    });
  }

  findPublicById(id: string) {
    return this.database.customer.findUnique({
      where: { id },
      select: publicCustomerSelect,
    });
  }

  registerWithSession(input: {
    name: string;
    email: string;
    passwordHash: string;
    tokenHash: string;
    expiresAt: Date;
    previousTokenHash?: string;
  }) {
    return this.database.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
        },
        select: publicCustomerSelect,
      });
      await tx.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      if (input.previousTokenHash) {
        await tx.customerSession.updateMany({
          where: { tokenHash: input.previousTokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return customer;
    });
  }

  rotateSession(
    customerId: string,
    tokenHash: string,
    expiresAt: Date,
    previousTokenHash?: string,
  ) {
    return this.database.$transaction(async (tx) => {
      const session = await tx.customerSession.create({
        data: { customerId, tokenHash, expiresAt },
        select: { id: true },
      });
      if (previousTokenHash) {
        await tx.customerSession.updateMany({
          where: { tokenHash: previousTokenHash, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return session;
    });
  }

  findCustomerBySessionHash(tokenHash: string, now: Date) {
    return this.database.customerSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      select: { customer: { select: publicCustomerSelect } },
    });
  }

  revokeSession(tokenHash: string, now = new Date()) {
    return this.database.customerSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  findOwnedAddress(customerId: string, addressId: string) {
    return this.database.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
  }
}
