import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { getSafeE2EDatabaseEnvironment } from '@/config/e2e-database';
import { requireNonProductionMutationEnvironment } from '@/e2e/helpers/environment';

test('single-admin inquiry UI preserves status rollback and reply duplicate protection', async ({
  page,
}) => {
  test.setTimeout(120_000);
  requireNonProductionMutationEnvironment();
  const database = new PrismaClient({
    datasourceUrl: getSafeE2EDatabaseEnvironment().databaseUrl,
  });
  const id = 'e2e-admin-async-inquiry';
  const authorId = 'e2e-admin-historical-inactive';
  const cleanup = async () => {
    await database.$transaction([
      database.adminInquiryMessageRead.deleteMany({
        where: { message: { inquiryId: id } },
      }),
      database.contactInquiryMessage.deleteMany({ where: { inquiryId: id } }),
      database.contactInquiryNote.deleteMany({ where: { inquiryId: id } }),
    ]);
    await database.contactInquiry.deleteMany({
      where: { id, submissionId: id },
    });
    await database.adminUser.deleteMany({
      where: { id: authorId, email: 'e2e-history@example.test' },
    });
  };
  try {
    await cleanup();
    await database.adminUser.create({
      data: {
        id: authorId,
        email: 'e2e-history@example.test',
        name: 'KURA Development Owner',
        isActive: false,
      },
    });
    await database.contactInquiry.create({
      data: {
        id,
        submissionId: id,
        publicId: 'E2E-ADMIN-ASYNC',
        topic: 'E2E_ASYNC',
        email: 'e2e-inquiry@example.test',
        message: 'Isolated UI test',
        messages: {
          create: {
            direction: 'ADMIN',
            authorAdminId: authorId,
            fromEmail: '',
            toEmail: 'e2e-inquiry@example.test',
            subject: 'E2E',
            body: 'Historical reply',
          },
        },
      },
    });
    expect(
      (
        await page.request.post('/api/v1/admin/auth/login', {
          data: E2E_FIXTURES.staff,
        })
      ).status(),
    ).toBe(200);
    await page.goto('/admin/inquiries');
    await expect(
      page.getByRole('columnheader', { name: '担当者', exact: true }),
    ).toHaveCount(0);
    await page.goto(`/admin/inquiries/${id}`);
    await expect(page.getByText(/管理者としてログイン中/)).not.toContainText(
      /OWNER|MANAGER|STAFF/,
    );
    await expect(page.getByText('担当者・ステータス')).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(1);
    await expect(page.getByLabel('管理者メッセージ履歴')).toContainText(
      '旧管理者',
    );
    await expect(page.getByLabel('管理者メッセージ履歴')).not.toContainText(
      'KURA',
    );

    const status = page.getByLabel('ステータス', { exact: true });
    let statusCalls = 0;
    let releaseStatus!: () => void;
    const statusGate = new Promise<void>((resolve) => {
      releaseStatus = resolve;
    });
    await page.route(`**/admin/inquiries/${id}/status`, async (route) => {
      statusCalls++;
      await statusGate;
      await route.fulfill({ status: 500, json: { success: false } });
    });
    await status.selectOption('IN_PROGRESS');
    await expect(page.getByText('保存中…', { exact: true })).toBeVisible();
    await expect(status).toBeDisabled();
    await status.dispatchEvent('change');
    expect(statusCalls).toBe(1);
    releaseStatus();
    await expect(
      page.getByText('保存に失敗しました', { exact: true }),
    ).toBeVisible();
    await expect(status).toHaveValue('NEW');
    await expect(status).toBeEnabled();
    await page.unroute(`**/admin/inquiries/${id}/status`);
    await status.selectOption('IN_PROGRESS');
    await expect(page.getByText('保存済み', { exact: true })).toBeVisible();
    await expect(status).toHaveValue('IN_PROGRESS');
    await expect(page.getByText('保存済み', { exact: true })).toHaveCount(0);

    const reply = page.getByLabel('お客様への返信');
    await reply.fill('E2E draft retained');
    let replyCalls = 0;
    const replyKeys: string[] = [];
    let releaseReply!: () => void;
    const replyGate = new Promise<void>((resolve) => {
      releaseReply = resolve;
    });
    await page.route(`**/admin/inquiries/${id}/reply`, async (route) => {
      replyCalls++;
      replyKeys.push(route.request().postDataJSON().idempotencyKey);
      await replyGate;
      await route.fulfill({ status: 500, json: { success: false } });
    });
    await page.getByRole('button', { name: '返信する', exact: true }).click();
    const sending = page.getByRole('button', { name: '送信中…', exact: true });
    await expect(sending).toBeDisabled();
    await sending.dispatchEvent('click');
    expect(replyCalls).toBe(1);
    releaseReply();
    await expect(
      page.getByText('送信に失敗しました', { exact: true }),
    ).toBeVisible();
    await expect(reply).toHaveValue('E2E draft retained');
    await expect(
      page.getByRole('button', { name: '返信する', exact: true }),
    ).toBeEnabled();
    await page.unroute(`**/admin/inquiries/${id}/reply`);
    let releaseRefresh!: () => void;
    let captureRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const refreshCaptured = new Promise<void>((resolve) => {
      captureRefresh = resolve;
    });
    await page.route(
      (url) =>
        url.pathname === `/admin/inquiries/${id}` &&
        url.searchParams.has('_rsc'),
      async (route) => {
        const response = await route.fetch();
        captureRefresh();
        await refreshGate;
        await route.fulfill({ response });
      },
    );
    await page.route(`**/admin/inquiries/${id}/reply`, async (route) => {
      replyKeys.push(route.request().postDataJSON().idempotencyKey);
      await database.contactInquiry.update({
        where: { id },
        data: {
          status: 'ANSWERED',
          messages: {
            create: {
              direction: 'ADMIN',
              authorAdminId: authorId,
              fromEmail: '',
              toEmail: 'e2e-inquiry@example.test',
              subject: 'E2E',
              body: 'Server refresh received',
            },
          },
        },
      });
      await route.fulfill({ status: 201, json: { success: true } });
    });
    await page.getByRole('button', { name: '返信する', exact: true }).click();
    await expect(page.getByText('送信済み', { exact: true })).toBeVisible();
    await expect(reply).toHaveValue('');
    expect(replyKeys).toHaveLength(2);
    expect(replyKeys[1]).toBe(replyKeys[0]);
    await refreshCaptured;
    let releaseFailure!: () => void;
    const failureGate = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    await page.route(`**/admin/inquiries/${id}/status`, async (route) => {
      await failureGate;
      await route.fulfill({ status: 500, json: { success: false } });
    });
    await status.selectOption('CLOSED');
    await expect(status).toBeDisabled();
    releaseRefresh();
    await expect(
      page.getByText('Server refresh received', { exact: true }),
    ).toBeVisible();
    releaseFailure();
    await expect(
      page.getByText('保存に失敗しました', { exact: true }),
    ).toBeVisible();
    await expect(status).toHaveValue('ANSWERED');
    await page.screenshot({
      path: test.info().outputPath('inquiry-desktop.png'),
    });
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath('inquiry-mobile.png'),
    });
  } finally {
    await cleanup();
    await database.$disconnect();
  }
});
