import { PrismaClient } from '@prisma/client';
import { getSafeE2EDatabaseEnvironment } from '@/config/e2e-database';
import { loadLocalE2EEnvironment } from '@/config/e2e-local-env';

// Fresh process: install a query-observable client before loading repositories.
loadLocalE2EEnvironment();
const safe = getSafeE2EDatabaseEnvironment();
process.env.DATABASE_URL = safe.databaseUrl;
process.env.DIRECT_URL = safe.directUrl;
const database = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
Object.assign(globalThis, { prisma: database });
let queryCount = 0;
database.$on('query', () => queryCount++);

const run = async () => {
  const { ProductService } = await import('@/services/product.service');
  const { productQueryValidator } = await import(
    '@/validators/product.validator'
  );
  const service = new ProductService();
  await database.$connect();
  queryCount = 0;
  const list = await service.getProducts(
    productQueryValidator.parse({ limit: 24 }),
  );
  const listQueries = queryCount;
  queryCount = 0;
  const detail = await service.getProductBySlug('e2e-test-product');
  process.stdout.write(
    JSON.stringify({
      listQueries,
      detailQueries: queryCount,
      listCount: list.items.length,
      detailSlug: detail.slug,
      detailHasImage: detail.images.length > 0,
      detailHasCategory: Boolean(detail.category.slug),
      availability: detail.availableQuantity,
    }) + '\n',
  );
};

run()
  .catch((error: unknown) => {
    process.stderr.write(
      error instanceof Error ? error.name : 'ProductReadFailure',
    );
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());
