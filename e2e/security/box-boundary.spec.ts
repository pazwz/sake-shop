import { expect, test } from '@playwright/test';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

const boxFixtureConfigured = () => Boolean(process.env.E2E_BOX_PRODUCT_SLUG);

test.describe('E2E-10: box products remain unavailable as standalone products', () => {
  test.skip(
    !mutationSuiteEnabled() || !boxFixtureConfigured(),
    'Requires an explicit local/preview standalone box-product fixture slug.',
  );

  test('a standalone box SKU is absent from public listing and direct detail', async ({
    page,
    request,
  }) => {
    const boxProductSlug = process.env.E2E_BOX_PRODUCT_SLUG!;

    await page.goto('/products');
    await expect(page.locator(`a[href="/products/${boxProductSlug}"]`)).toHaveCount(0);
    expect(
      (await request.get(`/products/${encodeURIComponent(boxProductSlug)}`)).status(),
    ).toBe(404);
  });
});
