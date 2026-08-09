import { prisma } from '@/lib/prisma';

export class CustomerRepository {
  upsertForOrder(input: { email: string; name: string; phone: string }) {
    return prisma.customer.upsert({
      where: { email: input.email },
      update: { name: input.name, phone: input.phone },
      create: input,
    });
  }
}
