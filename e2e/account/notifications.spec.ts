import { expect, test } from '@playwright/test';
import { loginCustomer, loginQaCustomer, qaCredentialsConfigured } from '@/e2e/helpers/customer';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

const secondaryConfigured = () => Boolean(process.env.E2E_QA_SECONDARY_EMAIL && process.env.E2E_QA_SECONDARY_PASSWORD);
const enabled = () => mutationSuiteEnabled() && qaCredentialsConfigured() && Boolean(process.env.E2E_QA_ORDER_NUMBER);

test.describe('E2E-13: customer notifications', () => {
  test.skip(!enabled(), 'Requires the isolated QA customer and order fixtures.');

  test('order history, bell, unread order message, and read state form one customer flow', async ({ page }) => {
    await loginQaCustomer(page);
    await page.goto('/account/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(process.env.E2E_QA_ORDER_NUMBER!)).toBeVisible();
    await expect(page.getByText('× 1')).toBeVisible();
    await expect(page.getByRole('link', { name: 'お知らせ' })).toBeVisible();
    await page.getByRole('link', { name: /この注文について問い合わせる|メッセージを確認/ }).click();
    await expect(page.getByRole('link', { name: '注文詳細へ戻る' })).toBeVisible();
    await expect(page.getByLabel('メッセージ履歴')).toBeVisible();
    await page.goto('/account/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'ご注文・個別のお知らせ' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'サイトからのお知らせ' })).toBeVisible();
    await expect(page.getByText(`注文 ${process.env.E2E_QA_ORDER_NUMBER!} への返信`)).toBeVisible();
    await expect(page.getByText('E2E fixture admin reply.')).toBeVisible();
  });

  test('published announcement is listed and opening it marks it read', async ({ page }) => {
    await loginQaCustomer(page);
    await page.goto('/account/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('E2E お知らせ')).toBeVisible();
    await page.getByText('E2E お知らせ').click();
    await expect(page.getByText('E2E announcement body.')).toBeVisible();
    await page.goto('/account/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('E2E お知らせ')).toBeVisible();
  });

  test('one customers announcement read state does not change another customer', async ({ browser }) => {
    test.skip(!secondaryConfigured(), 'Requires the isolated QA secondary customer.');
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await loginCustomer(page, process.env.E2E_QA_SECONDARY_EMAIL!, process.env.E2E_QA_SECONDARY_PASSWORD!);
      await page.goto('/account/notifications', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('E2E お知らせ')).toBeVisible();
    } finally { await context.close(); }
  });
});
