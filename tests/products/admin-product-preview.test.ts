import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdminProductPreviewToken,
  readAdminProductPreviewToken,
} from '@/lib/admin-product-preview-token';
import { AdminProductPreviewService } from '@/services/admin-product-preview.service';

const previousSecret = process.env.ADMIN_SESSION_SECRET;
process.env.ADMIN_SESSION_SECRET = 'test-only-preview-signing-secret';

test.after(() => {
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
});

test('signed product preview token carries only product and admin identity', async () => {
  const token = await createAdminProductPreviewToken({
    productId: 'product-1',
    adminId: 'admin-1',
  });
  assert.deepEqual(await readAdminProductPreviewToken(token), {
    productId: 'product-1',
    adminId: 'admin-1',
  });
});

test('a preview token cannot be used by another or ordinary session', async () => {
  const token = await createAdminProductPreviewToken({
    productId: 'product-1',
    adminId: 'admin-1',
  });
  const service = new AdminProductPreviewService(
    {} as never,
    {
      getPreviewProductBySlug: async () => ({ id: 'product-1' }),
    } as never,
  );

  await assert.rejects(
    service.getPreviewProduct('unpublished-product', token, 'admin-2'),
    { name: 'NotFoundError' },
  );
});

test('valid admin preview resolves an unpublished product by exact identity', async () => {
  const token = await createAdminProductPreviewToken({
    productId: 'product-1',
    adminId: 'admin-1',
  });
  const service = new AdminProductPreviewService(
    {} as never,
    {
      getPreviewProductBySlug: async () => ({
        id: 'product-1',
        isEcAvailable: false,
      }),
    } as never,
  );
  const product = await service.getPreviewProduct(
    'unpublished-product',
    token,
    'admin-1',
  );
  assert.equal(product.isEcAvailable, false);
});
