import { PrismaClient } from '@prisma/client';
import { developmentSeedAdmin } from '../config/seed';

const prisma = new PrismaClient();

const seed = async (): Promise<void> => {
  await prisma.adminUser.upsert({
    where: { email: developmentSeedAdmin.email },
    update: developmentSeedAdmin,
    create: developmentSeedAdmin,
  });
};

seed()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
