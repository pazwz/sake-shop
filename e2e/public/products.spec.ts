import { expect, test } from '@playwright/test';
import { openFirstPublicProduct } from '@/e2e/helpers/product';

test('E2E-02: product list loads and sorting updates the URL', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: '酒を選ぶ' })).toBeVisible();
  await expect(page.getByTestId('product-card').first()).toBeVisible();
  await page.getByLabel('並び順').selectOption('price_asc');
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(page.getByTestId('product-card').first()).toBeVisible();
});

test('E2E-03 and E2E-04: a public product can be added, updated, and removed from the browser cart', async ({
  page,
}) => {
  await openFirstPublicProduct(page);
  await expect(page.locator('main img').first()).toBeVisible();
  await expect(page.getByText('税込').first()).toBeVisible();
  await page.getByRole('button', { name: 'バッグに入れる' }).click();
  await expect(page.getByRole('status', { name: 'カート追加のお知らせ' })).toBeVisible();
  await page.getByRole('link', { name: 'カートを見る' }).click();
  await expect(page.getByRole('heading', { name: 'ショッピングバッグ' })).toBeVisible();
  const summary = page.locator('aside').filter({ hasText: 'ご注文内容' });
  const before = await summary.innerText();
  await page.getByRole('button', { name: '数量を増やす' }).click();
  await expect(summary).not.toHaveText(before);
  await page.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('バッグはまだ空です')).toBeVisible();
});
