import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export type ProductImageBackgroundStatus =
  | 'TRANSPARENT'
  | 'UNIFORM_BACKGROUND_SAFE'
  | 'BACKGROUND_REVIEW_REQUIRED'
  | 'SOURCE_IMAGE_CROPPED'
  | 'SOURCE_IMAGE_MISMATCH';

export type ProductImageSourceIssue = Extract<
  ProductImageBackgroundStatus,
  'SOURCE_IMAGE_CROPPED' | 'SOURCE_IMAGE_MISMATCH'
>;

export type ProductImageAnalysis = {
  status: ProductImageBackgroundStatus;
  backgroundRgb: [number, number, number] | null;
  cornerMaxDistance: number;
  stableBorderRatio: number;
  subjectRatio: number;
  reason: string;
};

type RawImage = {
  data: Buffer;
  width: number;
  height: number;
  channels: 4;
};

const COLOR = {
  cornerConsistency: 12,
  borderStable: 22,
  connectedOuter: 34,
  transparentInner: 5,
  transparentOuter: 30,
  minimumBackgroundLuminance: 205,
  maximumBackgroundChroma: 18,
  minimumStableBorderRatio: 0.72,
  minimumSubjectRatio: 0.04,
} as const;

const distance = (
  a: readonly [number, number, number],
  b: readonly [number, number, number],
) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const medianColor = (colors: Array<[number, number, number]>) =>
  [
    median(colors.map((color) => color[0])),
    median(colors.map((color) => color[1])),
    median(colors.map((color) => color[2])),
  ] as [number, number, number];

const pixel = (image: RawImage, x: number, y: number) => {
  const offset = (y * image.width + x) * image.channels;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
  ] as [number, number, number];
};

const alpha = (image: RawImage, x: number, y: number) =>
  image.data[(y * image.width + x) * image.channels + 3];

const cornerColors = (image: RawImage) => {
  const patch = Math.max(
    2,
    Math.min(32, Math.floor(Math.min(image.width, image.height) * 0.04)),
  );
  const origins = [
    [0, 0],
    [image.width - patch, 0],
    [0, image.height - patch],
    [image.width - patch, image.height - patch],
  ] as const;
  return origins.map(([originX, originY]) => {
    const colors: Array<[number, number, number]> = [];
    for (let y = originY; y < originY + patch; y += 1) {
      for (let x = originX; x < originX + patch; x += 1) {
        colors.push(pixel(image, x, y));
      }
    }
    return medianColor(colors);
  });
};

const borderColors = (image: RawImage) => {
  const colors: Array<[number, number, number]> = [];
  for (let x = 0; x < image.width; x += 1) {
    colors.push(pixel(image, x, 0), pixel(image, x, image.height - 1));
  }
  for (let y = 1; y < image.height - 1; y += 1) {
    colors.push(pixel(image, 0, y), pixel(image, image.width - 1, y));
  }
  return colors;
};

const loadRgba = async (input: Buffer): Promise<RawImage> => {
  const { data, info } = await sharp(input)
    .rotate()
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: 4,
  };
};

export const analyzeProductImageBackground = async (
  input: Buffer,
  sourceIssue?: ProductImageSourceIssue,
): Promise<ProductImageAnalysis> => {
  if (sourceIssue) {
    return {
      status: sourceIssue,
      backgroundRgb: null,
      cornerMaxDistance: 0,
      stableBorderRatio: 0,
      subjectRatio: 0,
      reason:
        sourceIssue === 'SOURCE_IMAGE_CROPPED'
          ? 'The source image is cropped and requires manual review.'
          : 'The source image identity does not match the intended product.',
    };
  }
  const image = await loadRgba(input);
  let transparentPixels = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (alpha(image, x, y) < 250) transparentPixels += 1;
    }
  }
  if (transparentPixels > 0) {
    return {
      status: 'TRANSPARENT',
      backgroundRgb: null,
      cornerMaxDistance: 0,
      stableBorderRatio: 1,
      subjectRatio: 1 - transparentPixels / (image.width * image.height),
      reason: 'The source already contains transparency.',
    };
  }

  const corners = cornerColors(image);
  const background = medianColor(corners);
  const cornerMaxDistance = Math.max(
    ...corners.map((color) => distance(color, background)),
  );
  const border = borderColors(image);
  const stableBorderRatio =
    border.filter((color) => distance(color, background) <= COLOR.borderStable)
      .length / border.length;
  let subjectPixels = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (distance(pixel(image, x, y), background) > COLOR.connectedOuter) {
        subjectPixels += 1;
      }
    }
  }
  const subjectRatio = subjectPixels / (image.width * image.height);
  const luminance =
    background[0] * 0.2126 + background[1] * 0.7152 + background[2] * 0.0722;
  const chroma = Math.max(...background) - Math.min(...background);
  const safe =
    cornerMaxDistance <= COLOR.cornerConsistency &&
    stableBorderRatio >= COLOR.minimumStableBorderRatio &&
    subjectRatio >= COLOR.minimumSubjectRatio &&
    luminance >= COLOR.minimumBackgroundLuminance &&
    chroma <= COLOR.maximumBackgroundChroma;

  return {
    status: safe ? 'UNIFORM_BACKGROUND_SAFE' : 'BACKGROUND_REVIEW_REQUIRED',
    backgroundRgb: background,
    cornerMaxDistance,
    stableBorderRatio,
    subjectRatio,
    reason: safe
      ? 'Light neutral corners and border are sufficiently consistent.'
      : 'Background consistency, neutrality, or subject contrast is insufficient.',
  };
};

const floodConnectedBackground = (
  image: RawImage,
  background: [number, number, number],
) => {
  const visited = new Uint8Array(image.width * image.height);
  const queue = new Int32Array(image.width * image.height);
  let head = 0;
  let tail = 0;
  const enqueue = (x: number, y: number) => {
    const index = y * image.width + x;
    if (visited[index]) return;
    if (distance(pixel(image, x, y), background) > COLOR.connectedOuter) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < image.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, image.height - 1);
  }
  for (let y = 1; y < image.height - 1; y += 1) {
    enqueue(0, y);
    enqueue(image.width - 1, y);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < image.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < image.height) enqueue(x, y + 1);
  }
  return visited;
};

export const normalizeProductImageBackground = async (
  input: Buffer,
  sourceIssue?: ProductImageSourceIssue,
): Promise<{ analysis: ProductImageAnalysis; output: Buffer | null }> => {
  const analysis = await analyzeProductImageBackground(input, sourceIssue);
  if (
    analysis.status !== 'UNIFORM_BACKGROUND_SAFE' ||
    !analysis.backgroundRgb
  ) {
    return { analysis, output: null };
  }
  const image = await loadRgba(input);
  const connected = floodConnectedBackground(image, analysis.backgroundRgb);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = y * image.width + x;
      const offset = index * image.channels;
      if (connected[index]) {
        const colorDistance = distance(
          pixel(image, x, y),
          analysis.backgroundRgb,
        );
        const normalized =
          (colorDistance - COLOR.transparentInner) /
          (COLOR.transparentOuter - COLOR.transparentInner);
        image.data[offset + 3] = Math.round(
          Math.max(0, Math.min(1, normalized)) * 255,
        );
      }
      if (image.data[offset + 3] > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return {
      analysis: {
        ...analysis,
        status: 'BACKGROUND_REVIEW_REQUIRED',
        reason: 'No safe subject bounds remained.',
      },
      output: null,
    };
  }

  const subjectWidth = maxX - minX + 1;
  const subjectHeight = maxY - minY + 1;
  const canvasSide = Math.ceil(Math.max(subjectWidth, subjectHeight) / 0.86);
  const left = Math.floor((canvasSide - subjectWidth) / 2);
  const top = Math.floor((canvasSide - subjectHeight) / 2);
  const subject = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .extract({
      left: minX,
      top: minY,
      width: subjectWidth,
      height: subjectHeight,
    })
    .png()
    .toBuffer();
  const output = await sharp({
    create: {
      width: canvasSide,
      height: canvasSide,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { analysis, output };
};

const main = async () => {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new Error(
      'Usage: tsx scripts/product-image-normalizer.ts INPUT OUTPUT',
    );
  }
  const input = await readFile(inputPath);
  const result = await normalizeProductImageBackground(input);
  if (result.output) {
    await writeFile(outputPath, result.output);
  }
  process.stdout.write(
    `${JSON.stringify({ input: path.basename(inputPath), output: result.output ? path.basename(outputPath) : null, ...result.analysis })}\n`,
  );
};

if (process.argv[1]?.endsWith('product-image-normalizer.ts')) {
  void main();
}
