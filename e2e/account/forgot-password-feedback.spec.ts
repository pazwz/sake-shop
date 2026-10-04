import { expect, test } from '@playwright/test';

const endpoint = '**/api/v1/customer/forgot-password';
const successMessage = '再設定メールを送信しました。メールをご確認ください。';
const failureMessage =
  '送信に失敗しました。しばらくしてからもう一度お試しください。';

test('password reset blocks pending and completed duplicate submissions', async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(endpoint, async (route) => {
    requests += 1;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({
      email: 'known@example.test',
    });
    await pending;
    await route.fulfill({
      json: {
        success: true,
        data: {
          message: 'ご登録のメールアドレスであれば、再設定メールを送信します。',
        },
        message: '',
        error: null,
      },
    });
  });
  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await page.locator('main input[type=email]').fill('known@example.test');
  await page.getByRole('button', { name: '再設定メールを送信' }).click();
  const button = page.getByRole('button', { name: '送信中…' });
  await expect(button).toBeDisabled();
  await expect(page.locator('main form')).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('[aria-hidden=true]')).toBeVisible();
  await page.locator('main form').evaluate((form) => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  release();
  await expect(page.getByRole('status')).toHaveText(successMessage);
  await expect(page.locator('main form')).toHaveAttribute('aria-busy', 'false');
  await expect(
    page.getByRole('button', { name: '再設定メールを送信' }),
  ).toBeDisabled();
  await page.locator('main form').evaluate((form) => {
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator('main input[type=email]')).toBeDisabled();
  expect(requests).toBe(1);
});

test('unknown email receives the same password reset success feedback', async ({
  page,
}) => {
  await page.route(endpoint, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      email: 'unknown@example.test',
    });
    await route.fulfill({
      json: {
        success: true,
        data: {
          message: 'ご登録のメールアドレスであれば、再設定メールを送信します。',
        },
        message: '',
        error: null,
      },
    });
  });
  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await page.locator('main input[type=email]').fill('unknown@example.test');
  await page.getByRole('button', { name: '再設定メールを送信' }).click();
  await expect(page.getByRole('status')).toHaveText(successMessage);
});

for (const failure of ['http', 'network'] as const) {
  test(`${failure} failure preserves email and permits a deliberate resubmit`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route(endpoint, async (route) => {
      requests += 1;
      if (requests > 1) {
        await route.fulfill({
          json: {
            success: true,
            data: { message: 'accepted' },
            message: '',
            error: null,
          },
        });
      } else if (failure === 'network') {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 503,
          json: {
            success: false,
            data: null,
            message: '',
            error: {
              code: 'UNAVAILABLE',
              detail: 'Internal details must not reach the UI',
            },
          },
        });
      }
    });
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    const input = page.locator('main input[type=email]');
    await input.fill('retry@example.test');
    await page.getByRole('button', { name: '再設定メールを送信' }).click();
    await expect(page.getByRole('status')).toHaveText(failureMessage);
    await expect(input).toHaveValue('retry@example.test');
    await expect(
      page.getByRole('button', { name: '再設定メールを送信' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '再設定メールを送信' }).click();
    await expect(page.getByRole('status')).toHaveText(successMessage);
    expect(requests).toBe(2);
  });
}
