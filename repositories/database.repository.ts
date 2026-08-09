import { prisma } from '@/lib/prisma';

export class DatabaseRepository {
  public async checkConnection(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }
}
