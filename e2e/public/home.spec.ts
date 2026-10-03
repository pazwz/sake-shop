import { expect, test } from '@playwright/test';

test('E2E-01: public home renders navigation, content, and footer', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'LINXAS FUKUOKA ホーム' })).toBeVisible();
  await expect(page).toHaveTitle(/LINXAS FUKUOKA/);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'LINXAS FUKUOKA');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
});

test('brand wordmark stays centered without overlapping header controls', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const logo = page.getByRole('link', { name: 'LINXAS FUKUOKA ホーム' });
    await expect(logo).toBeVisible();
    const bounds = await logo.boundingBox();
    expect(bounds).not.toBeNull();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
    const overlap = await page.locator('header').first().evaluate((header) => {
      const wordmark = header.querySelector('a[aria-label="LINXAS FUKUOKA ホーム"]')!.getBoundingClientRect();
      return [...header.querySelectorAll('button, select, a')].some((element) => {
        if (element.getAttribute('aria-label') === 'LINXAS FUKUOKA ホーム') return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.left < wordmark.right && box.right > wordmark.left && box.top < wordmark.bottom && box.bottom > wordmark.top;
      });
    });
    expect(overlap, `header overlap at ${width}px`).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`brand-${width}.png`) });
  }
});
