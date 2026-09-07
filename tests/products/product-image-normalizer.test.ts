import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  analyzeProductImageBackground,
  normalizeProductImageBackground,
} from '@/scripts/product-image-normalizer';

test('keeps an enclosed white label opaque while removing edge-connected white', async () => {
  const source = await sharp({
    create: { width: 120, height: 160, channels: 3, background: '#eeeeee' },
  })
    .composite([
      {
        input: {
          create: {
            width: 54,
            height: 130,
            channels: 3,
            background: '#241913',
          },
        },
        left: 33,
        top: 15,
      },
      {
        input: {
          create: { width: 38, height: 50, channels: 3, background: '#f1eee4' },
        },
        left: 41,
        top: 65,
      },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
  const result = await normalizeProductImageBackground(source);
  assert.equal(result.analysis.status, 'UNIFORM_BACKGROUND_SAFE');
  assert.ok(result.output);
  const { data, info } = await sharp(result.output)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
  assert.equal(alphaAt(0, 0), 0);
  assert.equal(
    alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2)),
    255,
  );
});

test('classifies existing alpha as transparent without generating a derivative', async () => {
  const source = await sharp({
    create: {
      width: 20,
      height: 20,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();
  const result = await normalizeProductImageBackground(source);
  assert.equal(result.analysis.status, 'TRANSPARENT');
  assert.equal(result.output, null);
});

test('fails closed for a non-uniform colored background', async () => {
  const source = await sharp({
    create: { width: 100, height: 100, channels: 3, background: '#7b3456' },
  })
    .composite([
      {
        input: {
          create: { width: 40, height: 80, channels: 3, background: '#221a16' },
        },
        left: 30,
        top: 10,
      },
    ])
    .png()
    .toBuffer();
  const analysis = await analyzeProductImageBackground(source);
  assert.equal(analysis.status, 'BACKGROUND_REVIEW_REQUIRED');
});

test('fails closed when source identity review reports a mismatch', async () => {
  const source = await sharp({
    create: { width: 20, height: 20, channels: 3, background: '#eeeeee' },
  })
    .png()
    .toBuffer();
  const result = await normalizeProductImageBackground(
    source,
    'SOURCE_IMAGE_MISMATCH',
  );
  assert.equal(result.analysis.status, 'SOURCE_IMAGE_MISMATCH');
  assert.equal(result.output, null);
});
