import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminRole } from '@prisma/client';
import { NextRequest } from 'next/server';
import { createAdminSessionToken } from '@/lib/admin-session';
import { proxy } from '@/proxy';
import { ProductService } from '@/services/product.service';

test('signed active-role sessions reach collection pages regardless of legacy role', async () => {
  process.env.ADMIN_SESSION_SECRET = 'admin-proxy-unit-only-secret';
  for (const role of Object.values(AdminRole)) {
    const token = await createAdminSessionToken({ adminId: 'admin', role });
    const request = new NextRequest(
      'http://localhost:3000/admin/collections/all',
      {
        headers: { cookie: `kura_admin_session=${token}` },
      },
    );
    const response = await proxy(request);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
});

test('Customer-only session never satisfies the Admin proxy', async () => {
  const request = new NextRequest(
    'http://localhost:3000/admin/collections/all',
    {
      headers: { cookie: 'linxas_customer_session=customer-only' },
    },
  );
  assert.match(
    (await proxy(request)).headers.get('location') ?? '',
    /\/admin\/login/,
  );
});

test('signed STAFF private preview reaches authoritative page checks without a public product lookup', async (t) => {
  let lookups = 0;
  t.mock.method(ProductService.prototype, 'isPublicProductSlug', async () => {
    lookups++;
    return false;
  });
  const token = await createAdminSessionToken({
    adminId: 'staff-admin',
    role: AdminRole.STAFF,
  });
  const request = new NextRequest(
    'http://localhost:3000/products/private-product?previewToken=page-validates-token',
    {
      headers: { cookie: `kura_admin_session=${token}` },
    },
  );
  assert.equal((await proxy(request)).headers.get('x-middleware-next'), '1');
  assert.equal(lookups, 0);
});
