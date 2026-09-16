import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { SMAREGI_BOX_CATEGORY_ID } from '@/config/box-products';
import { SMAREGI_NON_STANDALONE_PRODUCT_IDS } from '@/config/public-products';
import { prisma } from '@/lib/prisma';
import { ProductEnrichmentBatchService } from '@/services/product-enrichment-batch.service';
import type {
  ProductEnrichmentCandidate,
  ProductEnrichmentFields,
} from '@/types/product-enrichment';

const REPORT_DATE = '2026-09-16';
const APPLY_FLAG = '--apply';
const REPORT_DIRECTORY = join(process.cwd(), 'reports');
const AUDIT_REPORT_PATH = join(
  REPORT_DIRECTORY,
  `published-product-metadata-audit-${REPORT_DATE}.md`,
);
const AUDIT_JSON_PATH = join(
  REPORT_DIRECTORY,
  `published-product-metadata-audit-${REPORT_DATE}.json`,
);
const APPLY_MANIFEST_PATH = join(
  REPORT_DIRECTORY,
  `published-product-enrichment-apply-${REPORT_DATE}.json`,
);
const UNRESOLVED_REPORT_PATH = join(
  REPORT_DIRECTORY,
  `published-product-metadata-unresolved-${REPORT_DATE}.md`,
);
const APPLY_BASELINE_PATH = join(
  REPORT_DIRECTORY,
  `published-product-metadata-apply-baseline-${REPORT_DATE}.json`,
);

type FieldName = keyof ProductEnrichmentFields;
type Source = { url: string; label: string };
type ProposedMetadata = {
  smaregiProductId: string;
  productCode: string;
  fields: ProductEnrichmentFields;
  sources: Source[];
};

/**
 * Values here are limited to identity-stable facts from a producer's own site.
 * Edition- or vintage-dependent facts (especially ABV, volume and tasting) are
 * deliberately excluded unless the exact release is identified.
 */
const HIGH_CONFIDENCE_PROPOSALS: ProposedMetadata[] = [
  {
    smaregiProductId: '8000254',
    productCode: '44901777415346',
    fields: { producer: 'サントリー株式会社', origin: '日本' },
    sources: [
      {
        label: 'サントリー 山崎公式商品情報',
        url: 'https://www.suntory.co.jp/whisky/yamazaki/product/',
      },
    ],
  },
  {
    smaregiProductId: '8000440',
    productCode: '49001777016260',
    fields: { producer: 'KENZO ESTATE Winery', origin: 'California, USA' },
    sources: [
      {
        label: 'KENZO ESTATE 明日香 公式商品情報',
        url: 'https://www.kenzoestate.jp/wine/asuka',
      },
    ],
  },
  {
    smaregiProductId: '8000514',
    productCode: '49001777016289',
    fields: { producer: 'Buffalo Trace Distillery', origin: 'Kentucky, USA' },
    sources: [
      {
        label: 'Buffalo Trace William Larue Weller 公式',
        url: 'https://www.buffalotracedistillery.com/brands/william-larue-weller/',
      },
    ],
  },
  {
    smaregiProductId: '8000751',
    productCode: '49001777016481',
    fields: { producer: 'サントリー株式会社', origin: '日本' },
    sources: [
      {
        label: 'サントリー 山崎公式商品情報',
        url: 'https://www.suntory.co.jp/whisky/yamazaki/product/',
      },
    ],
  },
  {
    smaregiProductId: '8000799',
    productCode: '49001777016517',
    fields: { producer: 'KENZO ESTATE Winery', origin: 'California, USA' },
    sources: [
      {
        label: 'KENZO ESTATE 深穏 公式情報',
        url: 'https://www.kenzoestate.jp/1563',
      },
    ],
  },
  {
    smaregiProductId: '8000962',
    productCode: '49001777016633',
    fields: { producer: 'Louis Roederer', origin: 'Champagne, France' },
    sources: [
      {
        label: 'Louis Roederer Cristal Rosé 公式',
        url: 'https://app.louis-roederer.com/the-wines/cristal-rose',
      },
    ],
  },
  {
    smaregiProductId: '8001173',
    productCode: '49001777016785',
    fields: { producer: 'サントリー株式会社', origin: '日本' },
    sources: [
      {
        label: 'サントリー 山崎公式商品情報',
        url: 'https://www.suntory.co.jp/whisky/yamazaki/product/',
      },
    ],
  },
  {
    smaregiProductId: '8001299',
    productCode: '49001777016899',
    fields: { producer: 'サントリー株式会社', origin: '日本' },
    sources: [
      {
        label: 'サントリー 響公式商品情報',
        url: 'https://www.suntory.co.jp/whisky/products/0000000038/0000000114.html',
      },
    ],
  },
  {
    smaregiProductId: '8001323',
    productCode: '49001777016920',
    fields: { producer: 'Buffalo Trace Distillery', origin: 'Kentucky, USA' },
    sources: [
      {
        label: 'Buffalo Trace Stagg 公式',
        url: 'https://www.buffalotracedistillery.com/our-brands/george-t-stagg/stagg-bourbon/',
      },
    ],
  },
  {
    smaregiProductId: '8001352',
    productCode: '49001777016944',
    fields: { producer: 'ニッカウヰスキー株式会社', origin: '日本' },
    sources: [
      {
        label: 'NIKKA 余市・宮城峡公式',
        url: 'https://www.nikka.com/brands/yoichi_miyagikyo/',
      },
    ],
  },
  {
    smaregiProductId: '8001359',
    productCode: '49001777016951',
    fields: { producer: 'Moët & Chandon', origin: 'Champagne, France' },
    sources: [
      {
        label: 'Moët & Chandon 公式ラインアップ',
        url: 'https://www.moet.com/fr-fr/nos-champagnes-moet-chandon',
      },
    ],
  },
  {
    smaregiProductId: '8001365',
    productCode: '49001777016955',
    fields: { producer: 'サントリー株式会社', origin: '日本' },
    sources: [
      {
        label: 'サントリー 響公式商品情報',
        url: 'https://www.suntory.co.jp/whisky/hibiki/portfolio/blenderschoice/',
      },
    ],
  },
  {
    smaregiProductId: '8001380',
    productCode: '49001777016969',
    fields: { producer: 'Glengyle Distillery', origin: 'Campbeltown, Scotland' },
    sources: [
      {
        label: 'Kilkerran / Glengyle Distillery 公式',
        url: 'https://kilkerran.scot/',
      },
    ],
  },
  {
    smaregiProductId: '8001458',
    productCode: '49001777017041',
    fields: { producer: 'Springbank Distillery', origin: 'Campbeltown, Scotland' },
    sources: [
      {
        label: 'Springbank Longrow 100 Proof 公式',
        url: 'https://www.springbank.scot/whisky/longrow/',
      },
    ],
  },
  {
    smaregiProductId: '8001524',
    productCode: '49001777017099',
    fields: { producer: '新政酒造株式会社', origin: '秋田県秋田市' },
    sources: [
      {
        label: '新政酒造 頒布会公式情報',
        url: 'https://www.aramasa.jp/collection/others.html',
      },
    ],
  },
];

const publicProductWhere = {
  isActive: true,
  isEcAvailable: true,
  isManuallyHidden: false,
  NOT: {
    OR: [
      { smaregiProductId: { in: [...SMAREGI_NON_STANDALONE_PRODUCT_IDS] } },
      { category: { smaregiCategoryId: SMAREGI_BOX_CATEGORY_ID } },
    ],
  },
} satisfies Prisma.ProductWhereInput;

type AuditedProduct = Prisma.ProductGetPayload<{
  include: {
    category: { select: { name: true } };
    images: { select: { imageUrl: true } };
  };
}>;

const isBlank = (value: string | null) => value === null || value.trim() === '';

const missingFields = (product: AuditedProduct): FieldName[] => {
  const fields: FieldName[] = [];
  if (isBlank(product.producer)) fields.push('producer');
  if (isBlank(product.origin)) fields.push('origin');
  if (isBlank(product.volume)) fields.push('volume');
  if (product.alcoholPercentage === null) fields.push('alcoholPercentage');
  if (isBlank(product.description)) fields.push('description');
  if (isBlank(product.tastingNotes)) fields.push('tastingNotes');
  return fields;
};

const checkImageUrls = async (products: AuditedProduct[]) => {
  const urls = [...new Set(products.flatMap((product) => product.images.map(({ imageUrl }) => imageUrl)))];
  const statuses = new Map<string, number | null>();
  const queue = [...urls];
  const workers = Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (!url) return;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10_000),
          });
          if (response.status < 500 || attempt === 2) {
            statuses.set(url, response.status);
            break;
          }
        } catch {
          if (attempt === 2) statuses.set(url, null);
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  });
  await Promise.all(workers);
  return statuses;
};

const summarize = (products: AuditedProduct[], imageStatuses: Map<string, number | null>) => {
  const missing = (field: FieldName) => products.filter((product) => missingFields(product).includes(field)).length;
  const noImages = products.filter(({ images }) => images.length === 0).length;
  const brokenImages = products.filter(({ images }) =>
    images.length > 0 && images.every(({ imageUrl }) => {
      const status = imageStatuses.get(imageUrl);
      return status === undefined || status === null || status < 200 || status >= 300;
    }),
  ).length;
  const complete = products.filter((product) => missingFields(product).length === 0 && product.images.length > 0).length;
  return {
    publishedProducts: products.length,
    missingProducer: missing('producer'),
    missingOrigin: missing('origin'),
    missingVolume: missing('volume'),
    missingAlcoholPercentage: missing('alcoholPercentage'),
    missingDescription: missing('description'),
    missingTastingNotes: missing('tastingNotes'),
    noProductImage: noImages,
    brokenProductImage: brokenImages,
    fullyComplete: complete,
    incomplete: products.length - complete,
  };
};

const getPublishedProducts = () =>
  prisma.product.findMany({
    where: publicProductWhere,
    include: {
      category: { select: { name: true } },
      images: { select: { imageUrl: true } },
    },
    orderBy: { smaregiProductId: 'asc' },
  });

const proposalCandidates = (products: AuditedProduct[]) => {
  const byIdentity = new Map(products.map((product) => [product.smaregiProductId, product]));
  const skipped: string[] = [];
  const candidates: ProductEnrichmentCandidate[] = [];
  const manifest: Array<{
    productId: string;
    smaregiProductId: string;
    productCode: string;
    productName: string;
    fields: ProductEnrichmentFields;
    confidence: 'HIGH';
    sources: Source[];
  }> = [];

  for (const proposal of HIGH_CONFIDENCE_PROPOSALS) {
    const product = byIdentity.get(proposal.smaregiProductId);
    if (!product || product.productCode !== proposal.productCode) {
      skipped.push(proposal.smaregiProductId);
      continue;
    }
    manifest.push({
      productId: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      productName: product.name,
      fields: proposal.fields,
      confidence: 'HIGH',
      sources: proposal.sources,
    });
    const fieldsToFill = Object.fromEntries(
      Object.entries(proposal.fields).filter(([field]) => {
        const key = field as FieldName;
        return key === 'alcoholPercentage'
          ? product.alcoholPercentage === null
          : isBlank(product[key] as string | null);
      }),
    ) as ProductEnrichmentFields;
    if (!Object.keys(fieldsToFill).length) continue;
    candidates.push({
      productId: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      fields: fieldsToFill,
    });
  }
  return { candidates, manifest, skipped };
};

const markdownTable = (products: AuditedProduct[], imageStatuses: Map<string, number | null>) => {
  const rows = products
    .filter((product) => missingFields(product).length > 0 || product.images.length === 0)
    .map((product) => {
      const broken = product.images.some(({ imageUrl }) => {
        const status = imageStatuses.get(imageUrl);
        return status === undefined || status === null || status < 200 || status >= 300;
      });
      return `| ${product.smaregiProductId} | ${product.productCode} | ${product.name} | ${product.category.name} | ${product.producer ?? '—'} | ${product.origin ?? '—'} | ${product.volume ?? '—'} | ${product.alcoholPercentage?.toString() ?? '—'} | ${product.description ? 'あり' : 'なし'} | ${product.tastingNotes ? 'あり' : 'なし'} | ${product.images.length} | ${broken ? 'BROKEN_IMAGE' : '—'} | ${missingFields(product).join(', ') || '—'} |`;
    });
  return [
    '| Smaregi ID | Product Code | 商品名 | Category | Producer | Origin | Volume | ABV | Description | Tasting Notes | Images | Image status | Missing fields |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- |',
    ...rows,
  ].join('\n');
};

const unresolvedReason = (product: AuditedProduct) => {
  const fields = missingFields(product);
  const reasons: string[] = [];
  if (fields.includes('producer') || fields.includes('origin')) {
    reasons.push(
      product.category.name.includes('ワイン')
        ? '生産者名が商品名・現行画像から一意に確定できないため、ボトル表ラベルまたは生産者の公式テクニカルシートが必要です。'
        : '生産主体または産地を公式資料で当該リリースに紐付けて確認できる資料が必要です。',
    );
  }
  if (fields.includes('volume') || fields.includes('alcoholPercentage')) {
    reasons.push(
      '容量・度数はヴィンテージ、バッチ、旧ラベルで変わり得るため、当該ボトルの背ラベルまたは一致する公式仕様が必要です。',
    );
  }
  if (fields.includes('tastingNotes')) {
    reasons.push(
      '当該リリースに一致する公式テイスティングノートが未確認です。類似ボトルや現行品からは補いません。',
    );
  }
  return reasons.join(' ');
};

const writeReports = async (input: {
  before: ReturnType<typeof summarize>;
  after?: ReturnType<typeof summarize>;
  products: AuditedProduct[];
  imageStatuses: Map<string, number | null>;
  manifest: ReturnType<typeof proposalCandidates>['manifest'];
  skippedProposals: string[];
  applied: boolean;
}) => {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  const serializableProducts = input.products.map((product) => ({
    productId: product.id,
    smaregiProductId: product.smaregiProductId,
    productCode: product.productCode,
    productName: product.name,
    category: product.category.name,
    producer: product.producer,
    origin: product.origin,
    volume: product.volume,
    alcoholPercentage: product.alcoholPercentage?.toString() ?? null,
    hasDescription: !isBlank(product.description),
    hasTastingNotes: !isBlank(product.tastingNotes),
    imageCount: product.images.length,
    imageStatuses: product.images.map(({ imageUrl }) => ({ imageUrl, status: input.imageStatuses.get(imageUrl) ?? null })),
    missingFields: missingFields(product),
  }));
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: input.applied ? 'APPLY' : 'DRY_RUN',
    publicVisibility: 'isActive && isEcAvailable && !isManuallyHidden && standalone identity',
    before: input.before,
    after: input.after ?? input.before,
    proposedHighConfidenceFields: input.manifest,
    skippedIdentityChangedProposals: input.skippedProposals,
    products: serializableProducts,
  };
  await writeFile(AUDIT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(APPLY_MANIFEST_PATH, `${JSON.stringify(input.manifest, null, 2)}\n`, 'utf8');

  const after = input.after ?? input.before;
  const markdown = [
    `# Published product metadata audit (${REPORT_DATE})`,
    '',
    `Mode: ${input.applied ? 'APPLY' : 'DRY RUN'}`,
    '',
    '## Public visibility policy',
    '',
    'Only active, EC-enabled, non-manually-hidden standalone products are included. Package-only and service-only identities are excluded using the same policy as the public catalog.',
    '',
    '## Before / after',
    '',
    '| Metric | Before | After |',
    '| --- | ---: | ---: |',
    ...Object.entries(input.before).map(([key, value]) => `| ${key} | ${value} | ${after[key as keyof typeof after]} |`),
    '',
    '## HIGH-confidence apply manifest',
    '',
    `Eligible records: ${input.manifest.length}; fields: ${input.manifest.reduce((total, item) => total + Object.keys(item.fields).length, 0)}.`,
    '',
    ...input.manifest.map((item) => `- ${item.smaregiProductId} ${item.productName}: ${Object.entries(item.fields).map(([field, value]) => `${field}=${value}`).join(', ')} (${item.sources.map(({ url }) => url).join(', ')})`),
    '',
    '## Incomplete published products',
    '',
    markdownTable(input.products, input.imageStatuses),
    '',
  ].join('\n');
  await writeFile(AUDIT_REPORT_PATH, markdown, 'utf8');

  const unresolved = input.products
    .filter((product) => missingFields(product).length > 0 || product.images.length === 0)
    .map((product) => {
      const fields = missingFields(product);
      return `- ${product.smaregiProductId} ${product.name} (${product.productCode}) — missing: ${fields.join(', ')}. ${unresolvedReason(product)}`;
    });
  await writeFile(
    UNRESOLVED_REPORT_PATH,
    ['# Published product metadata unresolved', '', ...unresolved, ''].join('\n'),
    'utf8',
  );
};

const main = async () => {
  const apply = process.argv.includes(APPLY_FLAG);
  const beforeProducts = await getPublishedProducts();
  const beforeImageStatuses = await checkImageUrls(beforeProducts);
  const before = summarize(beforeProducts, beforeImageStatuses);
  const plan = proposalCandidates(beforeProducts);
  if (apply && plan.candidates.length) {
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(APPLY_BASELINE_PATH, `${JSON.stringify(before, null, 2)}\n`, 'utf8');
  }
  if (apply && plan.candidates.length) {
    await new ProductEnrichmentBatchService().apply(plan.candidates, 10);
  }
  const afterProducts = apply ? await getPublishedProducts() : beforeProducts;
  const afterImageStatuses = apply ? await checkImageUrls(afterProducts) : beforeImageStatuses;
  const after = summarize(afterProducts, afterImageStatuses);
  const persistedBaseline = apply
    ? await readFile(APPLY_BASELINE_PATH, 'utf8')
        .then((content) => JSON.parse(content) as ReturnType<typeof summarize>)
        .catch(() => null)
    : null;
  const reportBefore = persistedBaseline ?? before;
  await writeReports({
    before: reportBefore,
    after,
    products: afterProducts,
    imageStatuses: afterImageStatuses,
    manifest: plan.manifest,
    skippedProposals: plan.skipped,
    applied: apply,
  });
  process.stdout.write(
    `${JSON.stringify({ before: reportBefore, after, proposedProducts: plan.manifest.length, proposedFields: plan.manifest.reduce((total, item) => total + Object.keys(item.fields).length, 0), applied: apply }, null, 2)}\n`,
  );
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown audit failure.';
    process.stderr.write(`Published product metadata audit failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
