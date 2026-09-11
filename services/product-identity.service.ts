import {
  GENERIC_PRODUCT_NAMES,
  PRODUCT_BRAND_IDENTITIES,
  PRODUCT_IMAGE_DISCOVERY_SOURCE_PRIORITY,
  type ProductBrandIdentity,
} from '@/config/product-identity';
import type {
  ProductBrandSource,
  ProductIdentityField,
  ProductIdentityFieldMatches,
  ProductIdentityInput,
  ProductIdentityMatch,
  ProductIdentityProfile,
  ProductIdentityRejectionReason,
  ProductIdentityType,
  ProductImageIdentityDecision,
  ProductImageIdentityEvidence,
  ProductMetadataCompleteness,
  ProductPackageIdentity,
  ProductPackageType,
} from '@/types/product-identity';

const EMPTY_MATCHES: ProductIdentityFieldMatches = {
  brandMatch: 'UNKNOWN',
  productMatch: 'UNKNOWN',
  vintageMatch: 'UNKNOWN',
  ageMatch: 'UNKNOWN',
  batchMatch: 'UNKNOWN',
  editionMatch: 'UNKNOWN',
  variantMatch: 'UNKNOWN',
  volumeMatch: 'UNKNOWN',
  packageMatch: 'UNKNOWN',
  productCodeMatch: 'UNKNOWN',
  producerMatch: 'UNKNOWN',
};

const MATCH_FIELD: Record<
  keyof ProductIdentityFieldMatches,
  ProductIdentityField
> = {
  brandMatch: 'brand',
  productMatch: 'product',
  vintageMatch: 'vintage',
  ageMatch: 'age',
  batchMatch: 'batch',
  editionMatch: 'edition',
  variantMatch: 'variant',
  volumeMatch: 'volume',
  packageMatch: 'package',
  productCodeMatch: 'productCode',
  producerMatch: 'producer',
};

export const normalizeProductIdentityText = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/[’'"`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const unique = (values: Array<string | null | undefined>) => [
  ...new Set(values.filter((value): value is string => Boolean(value?.trim()))),
];

const includesAlias = (haystack: string, aliases: string[]) => {
  const normalizedHaystack = normalizeProductIdentityText(haystack);
  return aliases.some((alias) =>
    normalizedHaystack.includes(normalizeProductIdentityText(alias)),
  );
};

const extract = (pattern: RegExp, value: string) =>
  value.match(pattern)?.[1] ?? null;

const extractVintage = (value: string) =>
  extract(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/, value);

const extractAge = (value: string) =>
  extract(/(\d{1,2})\s*(?:years?\s*old|years?|yo|年)/i, value);

const extractBatch = (value: string) =>
  extract(
    /(?:batch|バッチ|edition\s*no\.?|リリース)\s*(?:no\.?\s*)?(\d+)/i,
    value,
  );

const extractVolume = (value: string) => {
  const match = value.normalize('NFKC').match(/(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'l') return `${amount * 1000}ml`;
  if (unit === 'cl') return `${amount * 10}ml`;
  return `${amount}ml`;
};

const PACKAGE_PATTERNS: Array<{
  pattern: RegExp;
  type: ProductPackageType;
}> = [
  { pattern: /木箱(?:付き|付|有り|あり)/u, type: 'WOODEN_BOX' },
  { pattern: /ギフトボックス/u, type: 'GIFT_BOX' },
  { pattern: /(?:箱無し|箱なし)/u, type: 'NO_BOX' },
  { pattern: /(?:箱付き|箱付|箱有り|箱あり)/u, type: 'BOX' },
  { pattern: /\d+本セット/u, type: 'SET' },
  { pattern: /セット/u, type: 'SET' },
  { pattern: /ケース付き/u, type: 'CASE' },
  { pattern: /ケース/u, type: 'CASE' },
  { pattern: /ギフト/u, type: 'GIFT_BOX' },
  { pattern: /(?:box|set|case)/iu, type: 'UNKNOWN' },
  { pattern: /箱/u, type: 'BOX' },
];

export const parseProductPackage = (
  value: string,
): ProductPackageIdentity | null => {
  const normalized = value.normalize('NFKC');
  for (const entry of PACKAGE_PATTERNS) {
    const match = normalized.match(entry.pattern);
    if (!match) continue;
    const quantityMatch = match[0].match(/(\d+)本/u);
    return {
      type: entry.type,
      quantity: quantityMatch ? Number(quantityMatch[1]) : null,
      descriptor: match[0],
      components: [],
      compositionKnown: entry.type !== 'SET',
    };
  }
  return null;
};

const normalizePackage = (
  value: string | ProductPackageIdentity | null | undefined,
) => {
  if (!value) return null;
  return typeof value === 'string' ? parseProductPackage(value) : value;
};

const EDITION_RULES: Array<{
  pattern: RegExp;
  value: string;
  specific: boolean;
}> = [
  {
    pattern: /(?:takashi\s*murakami|村上隆)/iu,
    value: 'TAKASHI_MURAKAMI',
    specific: true,
  },
  { pattern: /吉岡徳仁/iu, value: 'TOKUJIN_YOSHIOKA', specific: true },
  { pattern: /pharrell|ファレル/iu, value: 'PHARRELL', specific: true },
  {
    pattern: /(?:spring\s*festival|春節)/iu,
    value: 'SPRING_FESTIVAL',
    specific: true,
  },
  {
    pattern: /(?:holiday\s*edition|ホリデーエディション)/iu,
    value: 'HOLIDAY_EDITION',
    specific: false,
  },
  { pattern: /(?:luminous|ルミナス)/iu, value: 'LUMINOUS', specific: false },
  {
    pattern: /(?:black\s*edition|ブラックエディション)/iu,
    value: 'BLACK_EDITION',
    specific: false,
  },
];

const extractEdition = (value: string) => {
  const normalized = value.normalize('NFKC');
  const yearEdition = normalized.match(
    /((?:19|20)\d{2})\s*(?:edition|エディション)/iu,
  );
  if (yearEdition)
    return {
      value: `${yearEdition[1]}_EDITION`,
      matchedToken: yearEdition[0],
      requiresDetail: false,
      mentioned: true,
    };
  const numberedEdition = normalized.match(/edition\s*(?:no\.?\s*)?(\d+)/iu);
  if (numberedEdition)
    return {
      value: `EDITION_${numberedEdition[1]}`,
      matchedToken: numberedEdition[0],
      requiresDetail: false,
      mentioned: true,
    };
  for (const rule of EDITION_RULES) {
    const match = normalized.match(rule.pattern);
    if (match)
      return {
        value: rule.value,
        matchedToken: match[0],
        requiresDetail: !rule.specific,
        mentioned: true,
      };
  }
  const generic = normalized.match(
    /(?:limited\s*edition|リミテッドエディション|限定(?:ボトル)?)/iu,
  );
  return generic
    ? {
        value: null,
        matchedToken: generic[0],
        requiresDetail: true,
        mentioned: true,
      }
    : {
        value: null,
        matchedToken: null,
        requiresDetail: false,
        mentioned: false,
      };
};

const VARIANT_RULES: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /特別純米/u, value: 'TOKUBETSU_JUNMAI' },
  { pattern: /純米大吟醸/u, value: 'JUNMAI_DAIGINJO' },
  { pattern: /純米吟醸/u, value: 'JUNMAI_GINJO' },
  { pattern: /大吟醸/u, value: 'DAIGINJO' },
  { pattern: /(?:火入れ?|火入)/u, value: 'HIYIRE' },
  { pattern: /(?:生酒|生詰|生原酒)/u, value: 'NAMA' },
  { pattern: /([一二三四五六七八九十]農醸)/u, value: '$1' },
  { pattern: /(?:ros[eé]|ロゼ)/iu, value: 'ROSE' },
  { pattern: /(?:white|ホワイト|白)(?:\b|$)/iu, value: 'WHITE' },
];

const extractVariant = (value: string) => {
  const matches: string[] = [];
  const tokens: string[] = [];
  for (const rule of VARIANT_RULES) {
    const match = value.normalize('NFKC').match(rule.pattern);
    if (!match) continue;
    matches.push(rule.value === '$1' ? match[1] : rule.value);
    tokens.push(match[0]);
  }
  return {
    value: matches.length > 0 ? [...new Set(matches)].sort().join('+') : null,
    matchedTokens: tokens,
  };
};

const registryAliases = (entry: ProductBrandIdentity) =>
  unique([
    entry.canonicalName,
    ...(entry.aliases.japanese ?? []),
    ...(entry.aliases.kana ?? []),
    ...(entry.aliases.romaji ?? []),
    ...(entry.aliases.english ?? []),
    ...(entry.aliases.chinese ?? []),
  ]);

const findRegistryEntry = (name: string, explicitBrand?: string | null) => {
  const target = `${explicitBrand ?? ''} ${name}`;
  return PRODUCT_BRAND_IDENTITIES.find((entry) => {
    if (includesAlias(target, registryAliases(entry))) return true;
    return Object.values(entry.productAliases ?? {}).some((aliases) =>
      includesAlias(name, aliases),
    );
  });
};

const findProductAlias = (name: string, entry?: ProductBrandIdentity) => {
  if (!entry?.productAliases) return null;
  for (const [canonicalName, aliases] of Object.entries(entry.productAliases)) {
    if (includesAlias(name, [canonicalName, ...aliases]))
      return { canonicalName, aliases: unique([canonicalName, ...aliases]) };
  }
  return null;
};

const isBurgundyName = (name: string) =>
  /(?:^|\b)(?:nsg|vr)(?:\b|-)|chambolle|vosne|nuits[\s-]*saint[\s-]*georges|clos\s*de\s*vougeot|richebourg|musigny|roman[eé]e|grand\s*cru/iu.test(
    name.normalize('NFKC'),
  );

const isBatchReleaseName = (name: string) =>
  /heavily\s*peated|ヘビリーピーテッド|batch|バッチ|release|リリース|edition\s*no\.?|100\s*(?:proof|°\s*pf)|100°pf|william\s*larue\s*weller|ウィリアム\s*ラル(?:ー\s*ウェラー|ウェラー)|(?:^|\s)stagg(?:\s|$)|スタッグ|longrow|ロングロウ/iu.test(
    name.normalize('NFKC'),
  );

const isVintageAwareProduct = (name: string, registry?: ProductBrandIdentity) =>
  /(?:cristal|クリスタル)\s*(?:ros[eé]|ロゼ)|(?:dom\s*p[eé]rignon|ドン\s*ペリニヨン).*?(?:luminous|ルミナス)/iu.test(
    name,
  ) ||
  (registry?.vintageAwareProducts ?? []).some((product) =>
    includesAlias(name, [product]),
  );

const inferDbBrand = (name: string, identityType: ProductIdentityType) => {
  if (identityType === 'BURGUNDY_WINE') return null;
  const normalized = name.normalize('NFKC').trim();
  const firstToken = normalized.split(/[\s・/]+/u)[0] ?? '';
  if (!firstToken || firstToken === normalized) return null;
  return firstToken;
};

const inferIdentityType = (input: {
  explicit?: ProductIdentityType;
  name: string;
  categoryName: string | null;
  registry?: ProductBrandIdentity;
  vintage: string | null;
  volume: string | null;
  package: ProductPackageIdentity | null;
  editionMentioned: boolean;
}): ProductIdentityType => {
  if (input.explicit) return input.explicit;
  if (input.package) return 'PACKAGE_SET';
  if (isBurgundyName(input.name)) return 'BURGUNDY_WINE';
  if (
    isBatchReleaseName(input.name) ||
    input.registry?.identityType === 'BATCH_RELEASE'
  )
    return 'BATCH_RELEASE';
  if (isVintageAwareProduct(input.name, input.registry)) return 'VINTAGE_WINE';
  if (input.editionMentioned) return 'LIMITED_EDITION';
  if (
    input.registry?.identityType === 'SAKE' ||
    /日本酒|清酒|sake/iu.test(input.categoryName ?? '')
  )
    return 'SAKE';
  if (input.volume && Number.parseInt(input.volume, 10) <= 200)
    return 'MINIATURE';
  if (input.registry?.identityType === 'VINTAGE_WINE') return 'VINTAGE_WINE';
  if (input.vintage && /ワイン|wine/iu.test(input.categoryName ?? ''))
    return 'VINTAGE_WINE';
  if (/appellation|grand\s*cru|限定|セット|箱/iu.test(input.name))
    return 'REQUIRES_IDENTITY_REVIEW';
  return 'STANDARD_SPIRIT';
};

const stripKnownIdentityTokens = (value: string, tokens: string[]) => {
  let result = value
    .normalize('NFKC')
    .replace(/\d+(?:\.\d+)?\s*(?:ml|cl|l)\b/giu, ' ')
    .replace(/\d{1,2}\s*(?:years?\s*old|years?|yo|年)/giu, ' ')
    .replace(
      /(?:batch|バッチ|edition\s*no\.?|リリース)\s*(?:no\.?\s*)?\d+/giu,
      ' ',
    )
    .replace(/(?:19|20)\d{2}/g, ' ');
  for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
    result = result.replace(
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'),
      ' ',
    );
  }
  return result.replace(/[\s/・_-]+/g, ' ').trim();
};

const packageSearchLabel = (value: ProductPackageIdentity | null) => {
  if (!value) return null;
  return unique([
    value.descriptor,
    value.quantity ? `${value.quantity}本` : null,
    ...value.components,
  ]).join(' ');
};

export const buildProductIdentityProfile = (
  input: ProductIdentityInput,
): ProductIdentityProfile => {
  const registry = findRegistryEntry(input.originalName, input.brand);
  const productAlias = findProductAlias(input.originalName, registry);
  const vintage = input.vintage ?? extractVintage(input.originalName);
  const age = input.age ?? extractAge(input.originalName);
  const batch = input.batch ?? extractBatch(input.originalName);
  const volume = input.volume ?? extractVolume(input.originalName);
  const packageValue = normalizePackage(input.package ?? input.originalName);
  const extractedEdition = extractEdition(input.originalName);
  const edition = input.edition
    ? (extractEdition(input.edition).value ?? input.edition)
    : extractedEdition.value;
  const extractedVariant = extractVariant(input.originalName);
  const variant = input.variant
    ? (extractVariant(input.variant).value ?? input.variant)
    : extractedVariant.value;
  const categoryName = input.categoryName?.trim() || null;
  const identityType = inferIdentityType({
    explicit: input.identityType,
    name: input.originalName,
    categoryName,
    registry,
    vintage,
    volume,
    package: packageValue,
    editionMentioned: extractedEdition.mentioned || Boolean(input.edition),
  });

  let brand = input.brand?.trim() || registry?.canonicalName || null;
  let brandSource: ProductBrandSource = input.brand?.trim()
    ? registry
      ? 'REGISTRY'
      : 'DB_NAME'
    : registry
      ? 'REGISTRY'
      : 'UNKNOWN';
  if (!brand) {
    brand = inferDbBrand(input.originalName, identityType);
    if (brand) brandSource = 'DB_NAME';
  }
  if (!brand && input.evidenceBrand?.trim()) {
    brand = input.evidenceBrand.trim();
    brandSource = 'EVIDENCE';
  }

  const brandAliases = registry ? registryAliases(registry) : unique([brand]);
  const inferredCoreName =
    productAlias?.canonicalName ||
    stripKnownIdentityTokens(input.originalName, [
      ...brandAliases,
      ...(input.producer ? [input.producer] : []),
      ...(packageValue?.descriptor ? [packageValue.descriptor] : []),
      ...(extractedEdition.matchedToken ? [extractedEdition.matchedToken] : []),
      ...extractedVariant.matchedTokens,
    ]) ||
    brand ||
    input.originalName.trim();
  const coreProductName = input.coreProductName?.trim() || inferredCoreName;
  const productAliases = unique([
    coreProductName,
    ...(productAlias?.aliases ?? []),
    ...(brand &&
    normalizeProductIdentityText(coreProductName) ===
      normalizeProductIdentityText(brand)
      ? brandAliases
      : []),
  ]);
  const ambiguousGenericName = GENERIC_PRODUCT_NAMES.some(
    (name) =>
      normalizeProductIdentityText(name) ===
      normalizeProductIdentityText(input.originalName),
  );

  return {
    smaregiProductId: input.smaregiProductId,
    productCode: input.productCode,
    originalName: input.originalName,
    categoryName,
    identityType,
    brand,
    brandSource,
    coreProductName,
    producer: input.producer?.trim() || null,
    knownProducer: registry?.producerNames?.[0] ?? null,
    age,
    vintage,
    batch,
    edition,
    editionRequiresDetail:
      extractedEdition.requiresDetail ||
      (identityType === 'LIMITED_EDITION' && !edition),
    variant,
    volume,
    package: packageValue,
    aliases: {
      japanese: unique(registry?.aliases.japanese ?? []),
      kana: unique(registry?.aliases.kana ?? []),
      romaji: unique(registry?.aliases.romaji ?? []),
      english: unique(registry?.aliases.english ?? []),
      chinese: unique(registry?.aliases.chinese ?? []),
      normalized: unique([
        normalizeProductIdentityText(input.originalName),
        ...brandAliases.map(normalizeProductIdentityText),
        ...productAliases.map(normalizeProductIdentityText),
      ]),
      brand: brandAliases,
      producer: unique([input.producer, ...(registry?.producerNames ?? [])]),
      product: productAliases,
    },
    officialDomains: unique(registry?.officialDomains ?? []),
    ambiguousGenericName,
  };
};

const compareStructured = (
  expected: string | null,
  actual: string | null,
  hardConflict = false,
): ProductIdentityMatch => {
  if (!expected || !actual) return 'UNKNOWN';
  if (
    normalizeProductIdentityText(expected) ===
    normalizeProductIdentityText(actual)
  )
    return 'STRONG_MATCH';
  return hardConflict ? 'HARD_CONFLICT' : 'UNKNOWN';
};

const compareAliases = (
  aliases: string[],
  structuredValue: string | null | undefined,
  searchableText: string,
): ProductIdentityMatch => {
  if (aliases.length === 0) return 'UNKNOWN';
  if (structuredValue)
    return includesAlias(structuredValue, aliases) ? 'STRONG_MATCH' : 'UNKNOWN';
  return includesAlias(searchableText, aliases)
    ? 'SUPPORTING_MATCH'
    : 'UNKNOWN';
};

const comparePackages = (
  expected: ProductPackageIdentity | null,
  actual: ProductPackageIdentity | null,
): ProductIdentityMatch => {
  if (!expected || !actual) return 'UNKNOWN';
  if (expected.type !== actual.type) return 'HARD_CONFLICT';
  if (
    expected.quantity !== null &&
    actual.quantity !== null &&
    expected.quantity !== actual.quantity
  )
    return 'HARD_CONFLICT';
  if (expected.quantity !== null && actual.quantity === null) return 'UNKNOWN';
  if (expected.compositionKnown) {
    if (!actual.compositionKnown) return 'UNKNOWN';
    const expectedComponents = expected.components
      .map(normalizeProductIdentityText)
      .sort();
    const actualComponents = actual.components
      .map(normalizeProductIdentityText)
      .sort();
    if (expectedComponents.join('|') !== actualComponents.join('|'))
      return 'HARD_CONFLICT';
  }
  return 'STRONG_MATCH';
};

const scoreMatches = (
  matches: ProductIdentityFieldMatches,
  sourceType: ProductImageIdentityEvidence['sourceType'],
) => {
  const weights: Record<keyof ProductIdentityFieldMatches, number> = {
    productCodeMatch: 100,
    brandMatch: 25,
    productMatch: 35,
    vintageMatch: 20,
    ageMatch: 20,
    batchMatch: 25,
    editionMatch: 20,
    variantMatch: 15,
    volumeMatch: 15,
    packageMatch: 15,
    producerMatch: 15,
  };
  const fieldScore = (
    Object.keys(weights) as Array<keyof ProductIdentityFieldMatches>
  ).reduce((score, field) => {
    const match = matches[field];
    if (match === 'STRONG_MATCH') return score + weights[field];
    if (match === 'SUPPORTING_MATCH')
      return score + Math.ceil(weights[field] / 2);
    return score;
  }, 0);
  const sourceScore = {
    BRAND_OFFICIAL: 20,
    PRODUCER_OFFICIAL: 20,
    OFFICIAL_ARCHIVE: 18,
    OFFICIAL_SHOP: 18,
    IMPORTER_DISTRIBUTOR: 15,
    SPECIALIST_RETAILER: 10,
    REGULAR_RETAILER: 5,
    MARKETPLACE: 0,
    IMAGE_SEARCH: 0,
    OTHER: 0,
  }[sourceType];
  return fieldScore + sourceScore;
};

export const getRequiredIdentityFields = (
  profile: ProductIdentityProfile,
): ProductIdentityField[] => {
  const fields: ProductIdentityField[] = ['product'];
  if (profile.brand) fields.push('brand');
  if (profile.age) fields.push('age');
  if (profile.vintage) fields.push('vintage');

  switch (profile.identityType) {
    case 'SAKE':
      if (profile.variant) fields.push('variant');
      if (profile.volume) fields.push('volume');
      break;
    case 'BURGUNDY_WINE':
      fields.push('producer');
      if (!fields.includes('vintage')) fields.push('vintage');
      break;
    case 'VINTAGE_WINE':
      if (!fields.includes('vintage')) fields.push('vintage');
      if (profile.variant) fields.push('variant');
      break;
    case 'BATCH_RELEASE':
      fields.push('batch');
      break;
    case 'LIMITED_EDITION':
      fields.push('edition');
      if (profile.variant) fields.push('variant');
      break;
    case 'MINIATURE':
      if (!fields.includes('volume')) fields.push('volume');
      break;
    case 'PACKAGE_SET':
      fields.push('package');
      if (profile.package?.type === 'SET') fields.push('packageComposition');
      break;
    case 'REQUIRES_IDENTITY_REVIEW':
    case 'STANDARD_SPIRIT':
      break;
  }
  return [...new Set(fields)];
};

const rejectionForMissingField = (
  profile: ProductIdentityProfile,
  unknown: ProductIdentityField[],
): ProductIdentityRejectionReason => {
  if (profile.identityType === 'REQUIRES_IDENTITY_REVIEW')
    return 'REQUIRES_IDENTITY_REVIEW';
  if (unknown.includes('producer'))
    return 'PRODUCER_REQUIRED_FOR_DISAMBIGUATION';
  if (unknown.includes('batch')) return 'BATCH_REQUIRED';
  if (
    unknown.includes('edition') ||
    (profile.identityType === 'LIMITED_EDITION' &&
      profile.editionRequiresDetail)
  )
    return 'EDITION_REQUIRED';
  if (unknown.includes('packageComposition'))
    return 'PACKAGE_COMPOSITION_REQUIRED';
  if (unknown.includes('package')) return 'PACKAGE_CONFLICT';
  if (unknown.includes('variant')) return 'VARIANT_REQUIRED';
  if (unknown.includes('volume')) return 'VOLUME_REQUIRED';
  if (unknown.includes('vintage')) return 'VINTAGE_REQUIRED';
  if (unknown.includes('age')) return 'AGE_REQUIRED';
  return 'IDENTITY_EVIDENCE_INSUFFICIENT';
};

export const evaluateProductImageIdentity = (
  profile: ProductIdentityProfile,
  evidence: ProductImageIdentityEvidence,
  evaluatedAt = new Date(),
): ProductImageIdentityDecision => {
  const searchableText = `${evidence.title ?? ''} ${evidence.brand ?? ''} ${evidence.productName ?? ''}`;
  const evidenceEdition = evidence.edition
    ? (extractEdition(evidence.edition).value ?? evidence.edition)
    : extractEdition(searchableText).value;
  const evidenceVariant = evidence.variant
    ? (extractVariant(evidence.variant).value ?? evidence.variant)
    : extractVariant(searchableText).value;
  const evidencePackage = normalizePackage(evidence.package ?? searchableText);
  const matches: ProductIdentityFieldMatches = {
    ...EMPTY_MATCHES,
    brandMatch: compareAliases(
      profile.aliases.brand,
      evidence.brand,
      searchableText,
    ),
    productMatch: compareAliases(
      profile.aliases.product,
      evidence.productName,
      searchableText,
    ),
    vintageMatch: compareStructured(
      profile.vintage,
      evidence.vintage ?? extractVintage(searchableText),
      true,
    ),
    ageMatch: compareStructured(
      profile.age,
      evidence.age ?? extractAge(searchableText),
      true,
    ),
    batchMatch: compareStructured(
      profile.batch,
      evidence.batch ?? extractBatch(searchableText),
      true,
    ),
    editionMatch: compareStructured(profile.edition, evidenceEdition, true),
    variantMatch: compareStructured(profile.variant, evidenceVariant, true),
    volumeMatch: compareStructured(
      profile.volume,
      evidence.volume ?? extractVolume(searchableText),
      true,
    ),
    packageMatch: comparePackages(profile.package, evidencePackage),
    productCodeMatch:
      evidence.productCode === profile.productCode ? 'STRONG_MATCH' : 'UNKNOWN',
    producerMatch: compareAliases(
      unique([profile.producer, ...profile.aliases.producer]),
      evidence.producer,
      searchableText,
    ),
  };

  const requiredFields = getRequiredIdentityFields(profile);
  const matchedFields = (
    Object.entries(matches) as Array<
      [keyof ProductIdentityFieldMatches, ProductIdentityMatch]
    >
  )
    .filter(
      ([, match]) => match === 'STRONG_MATCH' || match === 'SUPPORTING_MATCH',
    )
    .map(([field]) => MATCH_FIELD[field]);
  if (
    profile.package?.type === 'SET' &&
    profile.package.compositionKnown &&
    matches.packageMatch === 'STRONG_MATCH'
  )
    matchedFields.push('packageComposition');
  const hardConflicts = (
    Object.entries(matches) as Array<
      [keyof ProductIdentityFieldMatches, ProductIdentityMatch]
    >
  )
    .filter(([, match]) => match === 'HARD_CONFLICT')
    .map(([field]) => MATCH_FIELD[field]);
  let unknownRequiredFields = requiredFields.filter(
    (field) => !matchedFields.includes(field),
  );
  if (matches.productCodeMatch === 'STRONG_MATCH') {
    unknownRequiredFields = unknownRequiredFields.filter(
      (field) => field !== 'brand' && field !== 'product',
    );
  }
  if (profile.identityType === 'SAKE' && !profile.variant && evidenceVariant)
    unknownRequiredFields = unique([
      ...unknownRequiredFields,
      'variant',
    ]) as ProductIdentityField[];
  if (
    profile.identityType === 'LIMITED_EDITION' &&
    profile.editionRequiresDetail &&
    !unknownRequiredFields.includes('edition')
  )
    unknownRequiredFields.push('edition');
  if (
    profile.package?.type === 'SET' &&
    !profile.package.compositionKnown &&
    !unknownRequiredFields.includes('packageComposition')
  )
    unknownRequiredFields.push('packageComposition');

  let rejectionReason: ProductIdentityRejectionReason | null = null;
  if (!evidence.usableImage) rejectionReason = 'NO_USABLE_IMAGE';
  else if (profile.ambiguousGenericName)
    rejectionReason = 'AMBIGUOUS_GENERIC_NAME';
  else if (hardConflicts.includes('volume'))
    rejectionReason = 'VOLUME_CONFLICT';
  else if (hardConflicts.includes('package'))
    rejectionReason = 'PACKAGE_CONFLICT';
  else if (hardConflicts.length > 0)
    rejectionReason = 'IDENTITY_EVIDENCE_INSUFFICIENT';
  else if ((evidence.ambiguousProducerCandidates?.length ?? 0) > 1)
    rejectionReason = 'PRODUCER_REQUIRED_FOR_DISAMBIGUATION';
  else if ((evidence.ambiguousBatchCandidates?.length ?? 0) > 1)
    rejectionReason = 'BATCH_REQUIRED';
  else if (unknownRequiredFields.length > 0)
    rejectionReason = rejectionForMissingField(profile, unknownRequiredFields);

  const score = scoreMatches(matches, evidence.sourceType);
  const identityConfirmed = rejectionReason === null && score >= 45;
  if (!identityConfirmed && rejectionReason === null)
    rejectionReason = 'IDENTITY_EVIDENCE_INSUFFICIENT';
  const approved = identityConfirmed && evidence.usableImage;

  return {
    smaregiProductId: profile.smaregiProductId,
    productCode: profile.productCode,
    identityType: profile.identityType,
    identityConfirmed,
    imageIdentityApproved: approved,
    approved,
    score,
    requiredFields,
    matchedFields: [...new Set(matchedFields)],
    unknownRequiredFields,
    hardConflicts,
    rejectionReason,
    matches,
    evaluatedAt: evaluatedAt.toISOString(),
  };
};

export const buildProductImageSearchQueries = (
  profile: ProductIdentityProfile,
) => {
  const names = unique([...profile.aliases.brand, ...profile.aliases.product]);
  const discriminators = unique([
    profile.age ? `${profile.age} years` : null,
    profile.vintage,
    profile.batch ? `Batch ${profile.batch}` : null,
    profile.edition,
    profile.variant,
    profile.volume,
    packageSearchLabel(profile.package),
  ]);
  const identity = [...names, ...discriminators].join(' ');
  return {
    sourcePriority: PRODUCT_IMAGE_DISCOVERY_SOURCE_PRIORITY,
    official: profile.officialDomains.map(
      (domain) => `site:${domain} ${identity}`,
    ),
    productCode: profile.productCode ? [`"${profile.productCode}"`] : [],
    aliases: names.map((name) => `${name} ${discriminators.join(' ')}`.trim()),
  };
};

export const calculateProductMetadataCompleteness = (input: {
  hasImage: boolean;
  producer?: string | null;
  description?: string | null;
}): ProductMetadataCompleteness => {
  const hasProducer = Boolean(input.producer?.trim());
  const hasDescription = Boolean(input.description?.trim());
  return {
    hasImage: input.hasImage,
    hasProducer,
    hasDescription,
    complete: input.hasImage && hasProducer && hasDescription,
  };
};
