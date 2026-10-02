import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

test('public Product reads retain images and availability with bounded SQL round trips', async () => {
  const { stdout } = await promisify(execFile)('pnpm', [
    'exec',
    'tsx',
    'e2e/helpers/product-read-budget.ts',
  ]);
  const result = JSON.parse(stdout) as {
    listQueries: number;
    detailQueries: number;
    listCount: number;
    detailSlug: string;
    detailHasImage: boolean;
    detailHasCategory: boolean;
    availability: number;
  };
  expect(result.listCount).toBeGreaterThan(0);
  expect(result.listCount).toBeLessThanOrEqual(24);
  expect(result.listQueries).toBeGreaterThan(0);
  expect(result.listQueries).toBeLessThanOrEqual(5);
  expect(result.detailQueries).toBe(2);
  expect(result.detailSlug).toBe('e2e-test-product');
  expect(result.detailHasImage).toBe(true);
  expect(result.detailHasCategory).toBe(true);
  expect(result.availability).toBeGreaterThanOrEqual(0);
});
