import { defineConfig, devices } from '@playwright/test';
import { getSafeE2EDatabaseEnvironment } from './config/e2e-database';
import { e2eFixtureEnvironment } from './config/e2e-fixtures';
import { loadLocalE2EEnvironment } from './config/e2e-local-env';

loadLocalE2EEnvironment();
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const useExistingServer = process.env.E2E_BASE_URL !== undefined;
const productionSmoke = process.env.E2E_PRODUCTION_SMOKE === 'true';
const e2eDatabase = productionSmoke ? null : getSafeE2EDatabaseEnvironment();
const localFixtureEnvironment =
  !productionSmoke && !useExistingServer ? e2eFixtureEnvironment() : {};
Object.assign(process.env, localFixtureEnvironment);

export default defineConfig({
  testDir: './e2e',
  testIgnore: productionSmoke ? undefined : ['production-smoke/**'],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // A local E2E run uses a remote Neon test branch. Keep it serial to avoid
  // transient connection resets; CI retains Playwright's existing concurrency.
  workers: process.env.CI ? undefined : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useExistingServer
    ? undefined
    : {
        command: 'pnpm dev',
        url: baseURL,
        env: {
          ...process.env,
          DATABASE_URL: e2eDatabase!.databaseUrl,
          DIRECT_URL: e2eDatabase!.directUrl,
          EMAIL_MODE: 'console',
          CHECKOUT_MODE: 'disabled',
          ...localFixtureEnvironment,
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
