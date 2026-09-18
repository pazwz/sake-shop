import { expect, test } from '@playwright/test';
import { productionSmokeEnabled } from '@/e2e/helpers/environment';

test.describe('production smoke: read-only and fail-closed boundaries', () => {
  test.skip(
    !productionSmokeEnabled(),
    'Requires E2E_PRODUCTION_SMOKE=true and an approved production base URL.',
  );

  test('E2E-05: public pages render while checkout writes remain disabled', async ({
    page,
    request,
  }) => {
    for (const path of ['/', '/products', '/contact', '/checkout', '/api/v1/health/database']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
    }
    await page.goto('/checkout');
    await expect(page.getByText('オンライン注文は現在準備中です')).toBeVisible();

    for (const path of ['/api/v1/orders', '/api/v1/payments/create']) {
      const response = await request.post(path, { data: {} });
      expect(response.status(), path).toBe(503);
      expect((await response.json()).error.code, path).toBe('CHECKOUT_DISABLED');
    }
  });

  test('public unknown product is not exposed and Admin remains protected', async ({
    page,
    request,
  }) => {
    expect((await request.get('/products/e2e-not-a-real-product')).status()).toBe(404);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
