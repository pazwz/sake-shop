import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { getSafeE2EDatabasePreparationEnvironment } from '@/config/e2e-database';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { requireNonProductionMutationEnvironment } from '@/e2e/helpers/environment';

const imageUrl =
  'https://diowj5taor0dy.cloudfront.net/uploads/2026/09/products/8000004/b6c03098-4bf6-4047-ad6b-e269f7d54992-4901777188907-fba8d791b2bbd8f2.png';
let database: PrismaClient;
let campaignId: string;
let storyId: string;

test.use({ deviceScaleFactor: 2 });

// Isolate the responsive-layout contract from third-party asset availability.
// Real CloudFront loading and upload headers are checked separately in smoke.
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/image?**', async (route) => {
    const width = Number(new URL(route.request().url()).searchParams.get('w'));
    const body = await sharp({
      create: {
        width,
        height: Math.ceil(width / 2),
        channels: 3,
        background: '#e6ded1',
      },
    })
      .jpeg()
      .toBuffer();
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body });
  });
});

test.beforeAll(async () => {
  requireNonProductionMutationEnvironment();
  database = new PrismaClient({
    datasources: {
      db: { url: getSafeE2EDatabasePreparationEnvironment().databaseUrl },
    },
  });
  const admin = await database.adminUser.findUniqueOrThrow({
    where: { username: E2E_FIXTURES.developer.username },
  });
  const campaign = await database.newsletterCampaign.create({
    data: {
      subject: 'E2E image sizes only',
      headline: 'Image sizes',
      body: 'Preview only; never sent.',
      status: 'CANCELLED',
      createdByAdminId: admin.id,
      heroImageUrl: imageUrl,
      sections: { create: { sortOrder: 0, imageUrl } },
    },
  });
  campaignId = campaign.id;
  storyId = (
    await database.featuredCollection.create({
      data: {
        type: 'STORY',
        status: 'PUBLISHED',
        title: 'E2E image sizes story',
        desktopImageUrl: imageUrl,
      },
    })
  ).id;
});

test.afterAll(async () => {
  if (campaignId) {
    await database.newsletterCampaignSection.deleteMany({
      where: { campaignId },
    });
    await database.newsletterCampaign.delete({ where: { id: campaignId } });
  }
  if (storyId)
    await database.featuredCollection.delete({ where: { id: storyId } });
  await database?.$disconnect();
});

const checkImages = async (page: Page, selector: string) => {
  const images = page.locator(selector);
  expect(await images.count()).toBeGreaterThan(0);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((node) => {
          const img = node as HTMLImageElement;
          return img.complete && img.naturalWidth > 0;
        }),
      )
      .toBe(true);
    const metrics = await image.evaluate((node) => {
      const img = node as HTMLImageElement;
      const picture = img.closest('picture');
      const source = [...(picture?.querySelectorAll('source') ?? [])].find(
        (s) => matchMedia(s.media).matches,
      );
      const sizes = source?.sizes || img.sizes;
      const choice = sizes
        .split(',')
        .map((s) => s.trim())
        .find((s) => {
          const condition = s.match(/^\((?:max|min)-width:[^)]+\)/)?.[0];
          return !condition || matchMedia(condition).matches;
        })!;
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;height:0;width:${choice.replace(/^\([^)]*\)\s*/, '')}`;
      document.body.append(probe);
      const declared = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        declared,
        actual: img.getBoundingClientRect().width,
        requestedWidth: Number(new URL(img.currentSrc).searchParams.get('w')),
        dpr: devicePixelRatio,
      };
    });
    expect(Math.abs(metrics.declared - metrics.actual)).toBeLessThan(2);
    expect(metrics.requestedWidth).toBeGreaterThanOrEqual(
      Math.floor(metrics.actual * metrics.dpr),
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
};

for (const width of [320, 390, 768, 1440]) {
  for (const surface of ['list', 'detail', 'home', 'story', 'newsletter']) {
    test(`${surface} image slots match rendered containers at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      if (surface === 'list' || surface === 'detail') {
        await page.goto('/products', { waitUntil: 'domcontentloaded' });
        const card = page.getByTestId('product-card').first();
        await expect(card).toBeVisible();
        await checkImages(page, '[data-testid=product-card]:first-child img');
        if (surface === 'list') return;
        const href = await card.getAttribute('href');
        await page.goto(href!, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('main h1')).toBeVisible();
        await checkImages(page, 'main img');
        await page.screenshot({
          path: test.info().outputPath(`detail-${width}.png`),
        });
        return;
      }
      if (surface === 'home') {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.home-hero img')).toBeVisible();
        await checkImages(page, 'main img');
        await page.screenshot({
          path: test.info().outputPath(`home-${width}.png`),
        });
        return;
      }
      if (surface === 'story') {
        await page.goto(`/collections/story-${storyId}`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(page.locator('.collection-hero img')).toBeVisible();
        await checkImages(page, '.collection-hero img');
        await page.screenshot({
          path: test.info().outputPath(`story-${width}.png`),
        });
        return;
      }
      expect(
        (
          await page.request.post('/api/v1/admin/auth/login', {
            data: E2E_FIXTURES.developer,
          })
        ).status(),
      ).toBe(200);
      await page.goto(`/admin/newsletters/${campaignId}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('form img').first()).toBeVisible();
      await checkImages(page, 'form img');
      await page.screenshot({
        path: test.info().outputPath(`newsletter-${width}.png`),
      });
    });
  }
}
