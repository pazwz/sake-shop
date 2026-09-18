import { expect, type Page } from '@playwright/test';

export const openFirstPublicProduct = async (page: Page) => {
  await page.goto('/products');
  const firstCard = page.getByTestId('product-card').first();
  await expect(firstCard).toBeVisible();
  const name = await firstCard.locator('h3').innerText();
  await firstCard.click();
  await expect(page).toHaveURL(/\/products\/[^/?#]+/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return { name };
};
