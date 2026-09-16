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
const RESEARCH_REPORT_PATH = join(
  REPORT_DIRECTORY,
  `published-product-spec-deep-research-${REPORT_DATE}.md`,
);
const RESEARCH_JSON_PATH = join(
  REPORT_DIRECTORY,
  `published-product-spec-deep-research-${REPORT_DATE}.json`,
);
const APPLY_REPORT_PATH = join(
  REPORT_DIRECTORY,
  `published-product-spec-deep-apply-${REPORT_DATE}.json`,
);
const LABEL_PHOTO_REPORT_PATH = join(
  REPORT_DIRECTORY,
  `products-needing-label-photo-${REPORT_DATE}.md`,
);
const APPLY_BASELINE_PATH = join(
  REPORT_DIRECTORY,
  `published-product-spec-deep-baseline-${REPORT_DATE}.json`,
);

type FieldName = 'producer' | 'origin' | 'volume' | 'alcoholPercentage';
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'CONFLICT';
type EvidenceNeed =
  | 'BACK_LABEL_PHOTO'
  | 'FRONT_LABEL_PHOTO'
  | 'OFFICIAL_SPEC'
  | 'IMPORTER_LABEL'
  | 'EXACT_EDITION_CONFIRMATION'
  | 'PACKAGE_SIZE_CONFIRMATION';
type Source = { label: string; url: string };
type ResearchDecision = {
  candidateValue: string | number | null;
  confidence: Confidence;
  decision: 'APPLY_EMPTY_ONLY' | 'UNRESOLVED' | 'CONFLICT';
  sources: Source[];
  reason: string;
  needs: EvidenceNeed[];
};
type Proposal = {
  smaregiProductId: string;
  productCode: string;
  fields: ProductEnrichmentFields;
  sources: Source[];
};

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

type PublicProduct = Prisma.ProductGetPayload<{
  include: { category: { select: { name: true } }; images: { select: { id: true } } };
}>;

const HIGH_CONFIDENCE_PROPOSALS: Proposal[] = [
  {
    smaregiProductId: '8000102',
    productCode: '080686008194',
    fields: { alcoholPercentage: 43 },
    sources: [
      {
        label: 'House of Suntory: Yamazaki Kogei Peated Malt Spanish Oak label (official)',
        url: 'https://www.tfwa.com/sites/tfwa.com/files/2024-05/02_singapore_2024_TUESDAY_ISSUE_WEB.pdf',
      },
    ],
  },
  {
    smaregiProductId: '8000103',
    productCode: '080686008224',
    fields: { volume: '700ml', alcoholPercentage: 43 },
    sources: [
      {
        label: 'House of Suntory: Hakushu Kogei Peated Malt Spanish Oak label (official)',
        url: 'https://www.tfwa.com/sites/tfwa.com/files/2024-05/02_singapore_2024_TUESDAY_ISSUE_WEB.pdf',
      },
    ],
  },
  {
    smaregiProductId: '8000658',
    productCode: '5060307844092',
    fields: { alcoholPercentage: 54 },
    sources: [
      {
        label: '小山本家酒造 貿易部: The Lakes Whiskymaker’s Editions Galáxia product sheet',
        url: 'https://www.oyama-web.com/products/pdf/twsc2025_1.pdf',
      },
    ],
  },
  {
    smaregiProductId: '8000796',
    productCode: '49001777016514',
    fields: { alcoholPercentage: 40 },
    sources: [
      {
        label: 'Chivas Regal Japan: Chivas Mizunara official product information',
        url: 'https://www.chivas.com/ja-jp/collection/chivas-mizunara/',
      },
    ],
  },
  {
    smaregiProductId: '8001538',
    productCode: '49001777017113',
    fields: { alcoholPercentage: 40 },
    sources: [
      {
        label: 'Chivas Regal Japan: Chivas 12 Takumi Reserve official product information',
        url: 'https://www.chivas.com/ja-jp/collection/chivas-12-takumi-reserve/',
      },
    ],
  },
];

const FIELD_NOTES: Partial<Record<string, Partial<Record<FieldName, ResearchDecision>>>> = {
  '8000060': {
    volume: {
      candidateValue: '750ml', confidence: 'MEDIUM', decision: 'UNRESOLVED', sources: [],
      reason: '一致するGTINの流通情報はあるものの、公式または正規輸入元の当該仕様を確認できません。', needs: ['IMPORTER_LABEL', 'BACK_LABEL_PHOTO'],
    },
    alcoholPercentage: {
      candidateValue: 12, confidence: 'MEDIUM', decision: 'UNRESOLVED', sources: [],
      reason: '一致するGTINの流通情報はあるものの、公式または正規輸入元の当該仕様を確認できません。', needs: ['IMPORTER_LABEL', 'BACK_LABEL_PHOTO'],
    },
  },
  '8000071': {
    volume: { candidateValue: '750ml', confidence: 'MEDIUM', decision: 'UNRESOLVED', sources: [], reason: '年号・市場仕様を公式資料で確認できません。', needs: ['OFFICIAL_SPEC', 'BACK_LABEL_PHOTO'] },
    alcoholPercentage: { candidateValue: 12.5, confidence: 'MEDIUM', decision: 'UNRESOLVED', sources: [], reason: '年号・市場仕様を公式資料で確認できません。', needs: ['OFFICIAL_SPEC', 'BACK_LABEL_PHOTO'] },
  },
  '8000096': {
    volume: { candidateValue: '700ml', confidence: 'CONFLICT', decision: 'CONFLICT', sources: [], reason: '一致する流通資料の容量・度数表記と現行公式商品情報が一致しないため、旧ラベルを確認する必要があります。', needs: ['IMPORTER_LABEL', 'BACK_LABEL_PHOTO'] },
    alcoholPercentage: { candidateValue: null, confidence: 'CONFLICT', decision: 'CONFLICT', sources: [], reason: '現行公式は40%表記、一致する流通資料には43%表記があり、当該ボトルを特定できません。', needs: ['IMPORTER_LABEL', 'BACK_LABEL_PHOTO'] },
  },
  '8000459': {
    alcoholPercentage: { candidateValue: null, confidence: 'CONFLICT', decision: 'CONFLICT', sources: [], reason: '同一ヴィンテージの強い流通資料間で13.9%と14.5%が競合しています。', needs: ['OFFICIAL_SPEC', 'BACK_LABEL_PHOTO'] },
  },
  '8000460': {
    alcoholPercentage: { candidateValue: null, confidence: 'CONFLICT', decision: 'CONFLICT', sources: [], reason: '同一ヴィンテージの強い流通資料間で12.5%と13%が競合しています。', needs: ['OFFICIAL_SPEC', 'BACK_LABEL_PHOTO'] },
  },
  '8000514': {
    volume: { candidateValue: '750ml', confidence: 'MEDIUM', decision: 'UNRESOLVED', sources: [], reason: '66.8%の既存値から2023年リリースの可能性は高いものの、公式の当該ボトル仕様を確認できません。', needs: ['EXACT_EDITION_CONFIRMATION', 'BACK_LABEL_PHOTO'] },
  },
  '8001323': {
    volume: { candidateValue: '750ml', confidence: 'MEDIUM', decision: 'UNRESOLVED', sources: [], reason: '既存63.9%は特定バッチと整合するものの、公式の当該ボトル仕様を確認できません。', needs: ['EXACT_EDITION_CONFIRMATION', 'BACK_LABEL_PHOTO'] },
  },
};

const isBlank = (value: string | null) => value === null || value.trim() === '';
const missingFields = (product: PublicProduct): FieldName[] => {
  const fields: FieldName[] = [];
  if (isBlank(product.producer)) fields.push('producer');
  if (isBlank(product.origin)) fields.push('origin');
  if (isBlank(product.volume)) fields.push('volume');
  if (product.alcoholPercentage === null) fields.push('alcoholPercentage');
  return fields;
};

const defaultDecision = (product: PublicProduct, field: FieldName): ResearchDecision => {
  if (field === 'producer' || field === 'origin') {
    return {
      candidateValue: null, confidence: 'LOW', decision: 'UNRESOLVED', sources: [],
      reason: product.category.name.includes('ワイン')
        ? 'アペラシオン名だけでは生産者を一意に特定できず、産地も当該ボトルの根拠に紐付けられません。'
        : '当該リリースに紐付く公式の生産主体または産地を確認できません。',
      needs: ['FRONT_LABEL_PHOTO', 'OFFICIAL_SPEC'],
    };
  }
  return {
    candidateValue: null, confidence: 'LOW', decision: 'UNRESOLVED', sources: [],
    reason: '容量・度数は旧ラベル、ヴィンテージ、バッチ、限定セットで変わり得るため、同名の現行品からは補いません。',
    needs: ['BACK_LABEL_PHOTO', 'EXACT_EDITION_CONFIRMATION'],
  };
};

const highDecision = (field: FieldName, proposal: Proposal): ResearchDecision | null => {
  const value = proposal.fields[field];
  if (value === undefined) return null;
  return {
    candidateValue: value, confidence: 'HIGH', decision: 'APPLY_EMPTY_ONLY',
    sources: proposal.sources,
    reason: '当該リリースに一致する公式または正規輸入元資料で確認済みです。', needs: [],
  };
};

const getPublicProducts = async () => {
  const exclusions = await prisma.smaregiProductExclusion.findMany({
    select: { smaregiProductId: true },
  });
  return prisma.product.findMany({
    where: {
      ...publicProductWhere,
      smaregiProductId: {
        notIn: exclusions.map(({ smaregiProductId }) => smaregiProductId),
      },
    },
    include: { category: { select: { name: true } }, images: { select: { id: true } } },
    orderBy: { smaregiProductId: 'asc' },
  });
};

const stats = (products: PublicProduct[]) => ({
  publishedProducts: products.length,
  missingProducer: products.filter((product) => isBlank(product.producer)).length,
  missingOrigin: products.filter((product) => isBlank(product.origin)).length,
  missingVolume: products.filter((product) => isBlank(product.volume)).length,
  missingAlcoholPercentage: products.filter((product) => product.alcoholPercentage === null).length,
});

const createPlan = (products: PublicProduct[]) => {
  const bySmaregiId = new Map(products.map((product) => [product.smaregiProductId, product]));
  const candidates: ProductEnrichmentCandidate[] = [];
  const manifest: Array<Proposal & { productId: string; productName: string; fields: ProductEnrichmentFields }> = [];
  const skipped: string[] = [];
  for (const proposal of HIGH_CONFIDENCE_PROPOSALS) {
    const product = bySmaregiId.get(proposal.smaregiProductId);
    if (!product || product.productCode !== proposal.productCode) {
      skipped.push(proposal.smaregiProductId);
      continue;
    }
    const fields = Object.fromEntries(Object.entries(proposal.fields).filter(([field]) => {
      const key = field as FieldName;
      return key === 'alcoholPercentage'
        ? product.alcoholPercentage === null
        : isBlank(product[key] as string | null);
    })) as ProductEnrichmentFields;
    manifest.push({ ...proposal, productId: product.id, productName: product.name, fields });
    if (Object.keys(fields).length) candidates.push({
      productId: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      fields,
    });
  }
  return { candidates, manifest, skipped };
};

const serialiseResearch = (products: PublicProduct[]) => {
  const proposalById = new Map(HIGH_CONFIDENCE_PROPOSALS.map((proposal) => [proposal.smaregiProductId, proposal]));
  return products.filter((product) => missingFields(product).length > 0).map((product) => {
    const proposal = proposalById.get(product.smaregiProductId);
    const decisions = Object.fromEntries(missingFields(product).map((field) => [
      field,
      highDecision(field, proposal ?? { smaregiProductId: '', productCode: '', fields: {}, sources: [] })
        ?? FIELD_NOTES[product.smaregiProductId]?.[field]
        ?? defaultDecision(product, field),
    ]));
    return {
      productId: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      productName: product.name,
      slug: product.slug,
      category: product.category.name,
      imageCount: product.images.length,
      values: {
        producer: product.producer,
        origin: product.origin,
        volume: product.volume,
        alcoholPercentage: product.alcoholPercentage?.toString() ?? null,
      },
      fields: decisions,
    };
  });
};

const writeReports = async (input: {
  before: ReturnType<typeof stats>;
  after: ReturnType<typeof stats>;
  products: PublicProduct[];
  plan: ReturnType<typeof createPlan>;
  applied: boolean;
}) => {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  const research = serialiseResearch(input.products);
  const payload = {
    generatedAt: new Date().toISOString(),
    mode: input.applied ? 'APPLY' : 'DRY_RUN',
    publicVisibility: 'isActive && isEcAvailable && !isManuallyHidden && standalone identity',
    before: input.before,
    after: input.after,
    highConfidenceApplyManifest: input.plan.manifest,
    skippedIdentityChangedProposals: input.plan.skipped,
    unresolved: research,
  };
  await writeFile(RESEARCH_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(APPLY_REPORT_PATH, `${JSON.stringify(input.plan.manifest, null, 2)}\n`, 'utf8');

  const tableRows = research.flatMap((product) => Object.entries(product.fields).map(([field, decision]) => {
    const item = decision as ResearchDecision;
    return `| ${product.smaregiProductId} | ${product.productCode} | ${product.productName} | ${field} | ${item.candidateValue ?? '—'} | ${item.confidence} | ${item.decision} | ${item.needs.join(', ') || '—'} | ${item.reason} |`;
  }));
  const markdown = [
    `# Published product specification deep research (${REPORT_DATE})`, '',
    `Mode: ${input.applied ? 'APPLY' : 'DRY RUN'}`, '',
    'Only currently public, active, non-hidden standalone products were reviewed. Only HIGH-confidence values are eligible for empty-only application.', '',
    '## Before / after', '',
    '| Metric | Before | After |', '| --- | ---: | ---: |',
    ...Object.entries(input.before).map(([key, value]) => `| ${key} | ${value} | ${input.after[key as keyof typeof input.after]} |`), '',
    '## HIGH-confidence empty-only manifest', '',
    ...input.plan.manifest.map((item) => `- ${item.smaregiProductId} ${item.productName}: ${Object.entries(item.fields).map(([field, value]) => `${field}=${value}`).join(', ')} — ${item.sources.map((source) => source.url).join(', ')}`), '',
    '## Field-level research ledger', '',
    '| Smaregi ID | Product code | 商品名 | Field | Candidate | Confidence | Decision | Required evidence | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |', ...tableRows, '',
  ].join('\n');
  await writeFile(RESEARCH_REPORT_PATH, markdown, 'utf8');

  const labelRows = research.flatMap((product) => Object.entries(product.fields).flatMap(([field, decision]) => {
    const item = decision as ResearchDecision;
    return item.decision === 'APPLY_EMPTY_ONLY' ? [] : [`- ${product.smaregiProductId} ${product.productName} (${product.productCode}) — ${field}: ${item.needs.join(' / ')}。${item.reason}`];
  }));
  await writeFile(
    LABEL_PHOTO_REPORT_PATH,
    ['# Products needing label / official evidence', '', 'The following fields were deliberately not inferred from similar products.', '', ...labelRows, ''].join('\n'),
    'utf8',
  );
};

const main = async () => {
  const apply = process.argv.includes(APPLY_FLAG);
  const beforeProducts = await getPublicProducts();
  const before = stats(beforeProducts);
  const plan = createPlan(beforeProducts);
  if (apply && plan.candidates.length) {
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(APPLY_BASELINE_PATH, `${JSON.stringify(before, null, 2)}\n`, 'utf8');
    await new ProductEnrichmentBatchService().apply(plan.candidates, 10);
  }
  const afterProducts = apply ? await getPublicProducts() : beforeProducts;
  const after = stats(afterProducts);
  const persistedBaseline = apply
    ? await readFile(APPLY_BASELINE_PATH, 'utf8').then((content) => JSON.parse(content) as ReturnType<typeof stats>).catch(() => before)
    : before;
  await writeReports({ before: persistedBaseline, after, products: afterProducts, plan, applied: apply });
  process.stdout.write(`${JSON.stringify({ before: persistedBaseline, after, candidates: plan.candidates.length, fields: plan.candidates.reduce((total, candidate) => total + Object.keys(candidate.fields).length, 0), skipped: plan.skipped, applied: apply }, null, 2)}\n`);
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown deep research audit failure.';
    process.stderr.write(`Published product specification deep research failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
