import { expect, test } from '@playwright/test';

test('E2E-11: contact is a support guide with no public submission form', async ({
  page,
}) => {
  await page.goto('/contact');
  await expect(
    page.getByRole('heading', { name: 'お問い合わせについて' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /MY PAGE/ })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(0);
});
