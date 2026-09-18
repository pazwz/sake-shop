import { expect, test } from '@playwright/test';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

test('E2E-11: contact form validates locally without submitting an email', async ({
  page,
}) => {
  await page.goto('/contact');
  await expect(page.getByRole('heading', { name: 'お問い合わせ' })).toBeVisible();
  await page.getByRole('button', { name: '送信する' }).click();
  await expect(page.getByText('メールアドレスを入力してください。')).toBeVisible();
  await expect(page.getByText('お問い合わせ内容を入力してください。')).toBeVisible();
});

test.describe('E2E-11: guarded local/preview contact submission', () => {
  test.skip(
    !mutationSuiteEnabled() || !process.env.E2E_CONTACT_EMAIL,
    'Requires E2E_ENV=local|preview, E2E_ALLOW_MUTATIONS=true, and a safe test email.',
  );

  test('submits through the outbox without relying on an external mail provider', async ({
    page,
  }) => {
    await page.goto('/contact');
    await page.getByLabel('お名前').fill('E2E Contact QA');
    await page.getByLabel('メールアドレス').fill(process.env.E2E_CONTACT_EMAIL!);
    await page.getByLabel('お問い合わせ内容').fill('Browser E2E local/preview contact check.');
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/api/v1/contact') &&
        candidate.request().method() === 'POST',
    );
    await page.getByRole('button', { name: '送信する' }).click();
    await expect((await response).status()).toBe(201);
    await expect(page.getByText('お問い合わせを受け付けました。')).toBeVisible();
  });
});
