import { expect, test } from '@playwright/test';
import {
  loginQaCustomer,
  qaCredentialsConfigured,
} from '@/e2e/helpers/customer';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

test.describe('E2E-12: authenticated order support messages', () => {
  test.skip(
    !mutationSuiteEnabled() ||
      !qaCredentialsConfigured() ||
      !process.env.E2E_QA_ORDER_NUMBER,
    'Requires an explicit non-production QA customer and owned order fixture.',
  );

  test('an owner can create an in-site message without public contact submission', async ({
    page,
  }) => {
    await loginQaCustomer(page);
    await page.goto(
      `/account/orders/${encodeURIComponent(process.env.E2E_QA_ORDER_NUMBER!)}`,
    );
    await expect(page.getByRole('link', { name: '注文履歴へ戻る' })).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/account\/orders\/[^/]+\/messages$/),
      page
        .getByRole('link', { name: /この注文について問い合わせる|メッセージを確認/ })
        .click(),
    ]);
    await expect(page.getByRole('link', { name: '注文詳細へ戻る' })).toBeVisible();
    await expect(page.getByText('カスタマーセンター')).toBeVisible();
    await page.getByLabel('メッセージ入力').fill('E2E order support message.');
    const response = page.waitForResponse(
      (candidate) => {
        if (candidate.request().method() !== 'POST') return false;
        const pathname = new URL(candidate.url()).pathname;
        return (
          /^\/api\/v1\/my\/orders\/[^/]+\/inquiries$/.test(pathname) ||
          /^\/api\/v1\/my\/inquiries\/[^/]+\/messages$/.test(pathname)
        );
      },
    );
    await page.getByRole('button', { name: '送信する' }).click();
    await expect((await response).status()).toBe(201);
    await expect(
      page.getByLabel('メッセージ履歴').getByText('E2E order support message.').last(),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-message-direction="CUSTOMER"]')
        .filter({ hasText: 'E2E order support message.' })
        .last()
        .getByText('お客様', { exact: true }),
    ).toBeVisible();
  });
});
