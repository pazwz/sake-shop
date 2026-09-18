import { expect, test } from '@playwright/test';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

const visibilityFixturesConfigured = () =>
  Boolean(
    process.env.E2E_HIDDEN_PRODUCT_SLUG &&
      process.env.E2E_EXCLUDED_PRODUCT_SLUG,
  );

test.describe('E2E-09: public product visibility boundaries', () => {
  test.skip(
    !mutationSuiteEnabled() || !visibilityFixturesConfigured(),
    'Requires explicit local/preview hidden and excluded product fixture slugs.',
  );

  test('hidden and excluded products remain absent from listing and direct detail', async ({
    page,
    request,
  }) => {
    const slugs = [
      process.env.E2E_HIDDEN_PRODUCT_SLUG!,
      process.env.E2E_EXCLUDED_PRODUCT_SLUG!,
    ];
    await page.goto('/products');
    for (const slug of slugs) {
      await expect(page.locator(`a[href="/products/${slug}"]`)).toHaveCount(0);
      await page.goto(`/search?q=${encodeURIComponent(slug)}`);
      await expect(page.locator(`a[href="/products/${slug}"]`)).toHaveCount(0);
      expect((await request.get(`/products/${encodeURIComponent(slug)}`)).status()).toBe(404);
    }
  });
});
