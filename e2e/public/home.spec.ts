import { expect, test } from '@playwright/test';

test('E2E-01: public home renders navigation, content, and footer', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'LINXAS ホーム' })).toBeVisible();
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});
