import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProductIdentityProfile,
  buildProductImageSearchQueries,
  calculateProductMetadataCompleteness,
  evaluateProductImageIdentity,
  parseProductPackage,
} from '@/services/product-identity.service';
import type {
  ProductIdentityInput,
  ProductImageIdentityEvidence,
} from '@/types/product-identity';

const profile = (
  input: Partial<ProductIdentityInput> &
    Pick<ProductIdentityInput, 'originalName'>,
) =>
  buildProductIdentityProfile({
    smaregiProductId: '8000000',
    productCode: '4900000000000',
    producer: null,
    ...input,
  });

const evidence = (
  input: Partial<ProductImageIdentityEvidence>,
): ProductImageIdentityEvidence => ({
  sourceType: 'BRAND_OFFICIAL',
  usableImage: true,
  ...input,
});

test('confirms Ubusuna Kabashiko without requiring Product.producer', () => {
  const product = profile({
    smaregiProductId: '49001777017169',
    productCode: '49001777017169',
    originalName: '産土 香子 四農醸 720ml',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      sourceDomain: 'hananoka.co.jp',
      title: '花の香酒造 産土 うぶすな 香子 かばしこ 四農醸 720ml',
      brand: 'Ubusuna',
      productName: 'Kabashiko',
      variant: '四農醸',
      volume: '720ml',
    }),
  );

  assert.equal(product.producer, null);
  assert.equal(product.knownProducer, '花の香酒造');
  assert.equal(decision.identityConfirmed, true);
  assert.equal(decision.imageIdentityApproved, true);
  assert.equal(decision.rejectionReason, null);
});

test('requires producer to disambiguate a Burgundy appellation and vintage', () => {
  const product = profile({
    originalName: 'CHAMBOLLE-MUSIGNY 2019',
    identityType: 'BURGUNDY_WINE',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      title: 'Chambolle-Musigny 2019 750ml',
      brand: 'Chambolle-Musigny',
      productName: 'Chambolle-Musigny',
      vintage: '2019',
      ambiguousProducerCandidates: ['Producer A', 'Producer B'],
    }),
  );

  assert.equal(decision.identityConfirmed, false);
  assert.equal(decision.imageIdentityApproved, false);
  assert.equal(
    decision.rejectionReason,
    'PRODUCER_REQUIRED_FOR_DISAMBIGUATION',
  );
});

test('infers Burgundy identity from a wine category and appellation-only name', () => {
  const product = profile({
    originalName: 'CHAMBOLLE-MUSIGNY 2019',
    categoryName: 'ワイン',
  });

  assert.equal(product.identityType, 'BURGUNDY_WINE');
  assert.equal(product.vintage, '2019');
});

test('confirms KENZO ESTATE asatsuyu by aliases and vintage', () => {
  const product = profile({
    smaregiProductId: '49001777016270',
    productCode: '49001777016270',
    originalName: 'あさつゆ 2021',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      title: 'KENZO ESTATE asatsuyu 2021 750ml',
      brand: 'KENZO ESTATE',
      productName: 'asatsuyu',
      vintage: '2021',
      volume: '750ml',
    }),
  );

  assert.equal(product.brand, 'KENZO ESTATE');
  assert.equal(decision.identityConfirmed, true);
  assert.equal(decision.imageIdentityApproved, true);
});

test('requires a known batch for a batch release regardless of producer', () => {
  const product = profile({
    originalName: 'Kilkerran Heavily Peated',
    producer: 'Glengyle Distillery',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      title: 'Kilkerran Heavily Peated Batch 8 / Batch 9 / Batch 10',
      brand: 'Kilkerran',
      productName: 'Heavily Peated',
      ambiguousBatchCandidates: ['8', '9', '10'],
    }),
  );

  assert.equal(product.identityType, 'BATCH_RELEASE');
  assert.equal(decision.identityConfirmed, false);
  assert.equal(decision.rejectionReason, 'BATCH_REQUIRED');
});

test('confirms Yamazaki 12 Years without requiring Product.producer', () => {
  const product = profile({ originalName: '山崎12年' });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      title: 'Suntory Yamazaki 12 Years Japanese Whisky',
      brand: 'Suntory Yamazaki',
      productName: 'Yamazaki',
      age: '12',
    }),
  );

  assert.equal(product.producer, null);
  assert.equal(decision.identityConfirmed, true);
  assert.equal(decision.imageIdentityApproved, true);
});

test('treats explicit volume conflict as a hard rejection', () => {
  const product = profile({ originalName: '産土 香子 四農醸 720ml' });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: '産土',
      productName: '香子',
      variant: '四農醸',
      volume: '1800ml',
    }),
  );

  assert.equal(decision.matches.volumeMatch, 'HARD_CONFLICT');
  assert.equal(decision.rejectionReason, 'VOLUME_CONFLICT');
  assert.equal(decision.imageIdentityApproved, false);
});

test('does not approve sake when a known variant is absent from evidence', () => {
  const product = profile({ originalName: '産土 香子 四農醸 720ml' });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: '産土',
      productName: '香子',
      volume: '720ml',
    }),
  );

  assert.equal(decision.imageIdentityApproved, false);
  assert.equal(decision.rejectionReason, 'VARIANT_REQUIRED');
});

test('does not approve an age-stated spirit when candidate age is absent', () => {
  const product = profile({ originalName: '山崎12年' });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({ brand: '山崎', productName: 'Yamazaki' }),
  );

  assert.equal(decision.imageIdentityApproved, false);
  assert.equal(decision.rejectionReason, 'AGE_REQUIRED');
});

test('builds official and alias searches without a persisted producer', () => {
  const product = profile({ originalName: '産土 香子 四農醸 720ml' });
  const queries = buildProductImageSearchQueries(product);

  assert.equal(product.producer, null);
  assert.ok(queries.official.some((query) => query.includes('hananoka.co.jp')));
  assert.ok(queries.aliases.some((query) => query.includes('Ubusuna')));
  assert.deepEqual(queries.productCode, ['"4900000000000"']);
});

test('keeps metadata completeness separate from image identity approval', () => {
  assert.deepEqual(
    calculateProductMetadataCompleteness({
      hasImage: true,
      producer: null,
      description: 'Verified product description.',
    }),
    {
      hasImage: true,
      hasProducer: false,
      hasDescription: true,
      complete: false,
    },
  );
});

test('re-evaluates an earlier rejection when stronger alias evidence appears', () => {
  const product = profile({ originalName: '産土 香子 四農醸 720ml' });
  const first = evaluateProductImageIdentity(
    product,
    evidence({ brand: '産土', productName: '香子', volume: '720ml' }),
  );
  const reviewedAgain = evaluateProductImageIdentity(
    product,
    evidence({
      title: 'Ubusuna Kabashiko 四農醸 720ml',
      brand: 'Ubusuna',
      productName: 'Kabashiko',
      variant: '四農醸',
      volume: '720ml',
    }),
  );

  assert.equal(first.imageIdentityApproved, false);
  assert.equal(reviewedAgain.imageIdentityApproved, true);
});

test('uses the real Japanese sake category when inferring identity type', () => {
  const product = profile({
    originalName: '無登録銘柄 八反錦 720ml',
    categoryName: '日本酒',
  });

  assert.equal(product.identityType, 'SAKE');
  assert.equal(product.brand, '無登録銘柄');
  assert.equal(product.brandSource, 'DB_NAME');
});

test('rejects Jikon Hattan Nishiki with a conflicting 1800ml candidate', () => {
  const product = profile({
    originalName: '而今 八反錦 720ml',
    categoryName: '日本酒',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: 'Jikon',
      productName: '八反錦',
      volume: '1800ml',
    }),
  );

  assert.equal(product.identityType, 'SAKE');
  assert.equal(decision.matches.volumeMatch, 'HARD_CONFLICT');
  assert.deepEqual(decision.hardConflicts, ['volume']);
  assert.equal(decision.rejectionReason, 'VOLUME_CONFLICT');
  assert.equal(decision.approved, false);
});

test('rejects Jikon Hattan Nishiki when the known 720ml volume is unverified', () => {
  const product = profile({
    originalName: '而今 八反錦 720ml',
    categoryName: '日本酒',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({ brand: '而今', productName: '八反錦' }),
  );

  assert.equal(decision.rejectionReason, 'VOLUME_REQUIRED');
  assert.ok(decision.unknownRequiredFields.includes('volume'));
  assert.equal(decision.approved, false);
});

test('rejects an introduced hiire variant when the Jikon DB identity does not specify it', () => {
  const product = profile({
    originalName: '而今 八反錦 720ml',
    categoryName: '日本酒',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      title: '而今 八反錦 火入 720ml',
      brand: '而今',
      productName: '八反錦',
      volume: '720ml',
    }),
  );

  assert.equal(decision.rejectionReason, 'VARIANT_REQUIRED');
  assert.ok(decision.unknownRequiredFields.includes('variant'));
  assert.equal(decision.approved, false);
});

test('recognizes Japanese Kilkerran Heavily Peated as batch-sensitive', () => {
  const product = profile({
    originalName: 'キルケラン ヘビリーピーテッド',
    categoryName: 'スコッチウイスキー',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: 'Kilkerran',
      productName: 'Heavily Peated',
    }),
  );

  assert.equal(product.identityType, 'BATCH_RELEASE');
  assert.ok(decision.requiredFields.includes('batch'));
  assert.equal(decision.rejectionReason, 'BATCH_REQUIRED');
});

for (const [name, expectedBrand] of [
  ['ウィリアム ラルウェラー', 'ウィリアム ラルー ウェラー'],
  ['スタッグ', 'スタッグ'],
  ['ロングロウ 100°PF', 'ロングロウ'],
] as const) {
  test(`recognizes ${name} as a batch/release-sensitive family`, () => {
    const product = profile({
      originalName: name,
      categoryName: 'スコッチウイスキー',
    });
    const decision = evaluateProductImageIdentity(
      product,
      evidence({ brand: expectedBrand, productName: name }),
    );

    assert.equal(product.identityType, 'BATCH_RELEASE');
    assert.equal(decision.rejectionReason, 'BATCH_REQUIRED');
  });
}

for (const name of [
  'NSG Les Proces 2019',
  'VR-Les Hautes Maizieres 2019',
] as const) {
  test(`requires a producer for Burgundy abbreviation ${name}`, () => {
    const product = profile({
      originalName: name,
      categoryName: 'ワイン',
    });
    const decision = evaluateProductImageIdentity(
      product,
      evidence({ productName: product.coreProductName, vintage: '2019' }),
    );

    assert.equal(product.identityType, 'BURGUNDY_WINE');
    assert.equal(
      decision.rejectionReason,
      'PRODUCER_REQUIRED_FOR_DISAMBIGUATION',
    );
    assert.ok(decision.unknownRequiredFields.includes('producer'));
  });
}

test('approves Jean Grivot Richebourg 2016 with producer and vintage', () => {
  const product = profile({
    originalName: 'Jean Grivot Richebourg Grand Cru 2016',
    categoryName: 'ワイン',
    producer: 'Jean Grivot',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      sourceType: 'PRODUCER_OFFICIAL',
      productName: 'Richebourg Grand Cru',
      producer: 'Jean Grivot',
      vintage: '2016',
    }),
  );

  assert.equal(product.identityType, 'BURGUNDY_WINE');
  assert.equal(decision.approved, true);
  assert.deepEqual(decision.unknownRequiredFields, []);
});

test('keeps a generic Moet limited edition unresolved', () => {
  const product = profile({
    originalName: 'モエ リミテッドエディション',
    categoryName: 'シャンパン',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: 'Moet',
      productName: 'Moet Limited Edition',
      edition: 'Limited Edition',
    }),
  );

  assert.equal(product.identityType, 'LIMITED_EDITION');
  assert.equal(product.edition, null);
  assert.equal(decision.rejectionReason, 'EDITION_REQUIRED');
});

test('confirms the specific Hibiki Masters Spring Festival edition', () => {
  const product = profile({
    originalName: '響マスターズ 春節限定ボトル',
    categoryName: 'ジャパニーズウイスキー',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: 'Hibiki',
      productName: 'Masters Select',
      edition: 'Spring Festival',
    }),
  );

  assert.equal(product.identityType, 'LIMITED_EDITION');
  assert.equal(product.edition, 'SPRING_FESTIVAL');
  assert.equal(decision.approved, true);
});

for (const [name, expectedVariant] of [
  ['ドンペリニヨン ルミナス ロゼ', 'ROSE'],
  ['ドンペリニヨン ルミナス ホワイト', 'WHITE'],
] as const) {
  test(`requires vintage for ${name}`, () => {
    const product = profile({ originalName: name, categoryName: 'シャンパン' });
    const decision = evaluateProductImageIdentity(
      product,
      evidence({
        brand: 'Dom Perignon',
        productName: 'Dom Perignon Luminous',
        variant: expectedVariant,
        vintage: '2012',
      }),
    );

    assert.equal(product.identityType, 'VINTAGE_WINE');
    assert.equal(product.variant, expectedVariant);
    assert.equal(decision.rejectionReason, 'VINTAGE_REQUIRED');
  });
}

test('confirms the specific Dom Perignon Takashi Murakami White edition', () => {
  const product = profile({
    originalName: 'ドンペリニヨン 村上隆 白',
    categoryName: 'シャンパン',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: 'Dom Perignon',
      productName: 'Dom Perignon',
      edition: 'Takashi Murakami',
      variant: 'White',
    }),
  );

  assert.equal(product.identityType, 'LIMITED_EDITION');
  assert.equal(product.edition, 'TAKASHI_MURAKAMI');
  assert.equal(product.variant, 'WHITE');
  assert.equal(decision.approved, true);
});

for (const [name, expectedEdition] of [
  ['モエ 2021 Edition', '2021_EDITION'],
  ['モエ Edition 170', 'EDITION_170'],
] as const) {
  test(`extracts specific edition detail: ${name}`, () => {
    const product = profile({ originalName: name, categoryName: 'シャンパン' });
    assert.equal(product.identityType, 'LIMITED_EDITION');
    assert.equal(product.edition, expectedEdition);
    assert.equal(product.editionRequiresDetail, false);
  });
}

test('requires vintage for Louis Roederer Cristal Rose', () => {
  const product = profile({
    originalName: 'ルイロデレール クリスタル ロゼ',
    categoryName: 'シャンパン',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      brand: 'Louis Roederer',
      productName: 'Cristal Rose',
      vintage: '2014',
    }),
  );

  assert.equal(product.identityType, 'VINTAGE_WINE');
  assert.equal(decision.rejectionReason, 'VINTAGE_REQUIRED');
});

for (const alias of [
  'ケンゾーエステート 明日香',
  'ケンゾー エステート 明日香',
  'ケンゾー・エステート 明日香',
  'KENZO ESTATE asuka',
  'Kenzo Estate asuka',
] as const) {
  test(`normalizes KENZO alias: ${alias}`, () => {
    const product = profile({ originalName: alias, categoryName: 'ワイン' });
    assert.equal(product.brand, 'KENZO ESTATE');
    assert.equal(product.brandSource, 'REGISTRY');
    assert.equal(product.identityType, 'VINTAGE_WINE');
  });
}

for (const name of [
  'ケンゾーエステート 明日香',
  'ケンゾーエステート 深穏',
] as const) {
  test(`requires vintage for live KENZO product ${name}`, () => {
    const product = profile({ originalName: name, categoryName: 'ワイン' });
    const decision = evaluateProductImageIdentity(
      product,
      evidence({ brand: 'KENZO ESTATE', productName: product.coreProductName }),
    );
    assert.equal(decision.rejectionReason, 'VINTAGE_REQUIRED');
  });
}

const packageCases = [
  ['商品 箱付き', 'BOX', null, '商品'],
  ['商品 箱無し', 'NO_BOX', null, '商品'],
  ['商品 木箱付き', 'WOODEN_BOX', null, '商品'],
  ['商品 箱有り', 'BOX', null, '商品'],
  ['商品 セット', 'SET', null, '商品'],
  ['商品 3本セット', 'SET', 3, '商品'],
  ['商品 5本セット', 'SET', 5, '商品'],
  ['商品 ギフト', 'GIFT_BOX', null, '商品'],
  ['商品 ギフトボックス', 'GIFT_BOX', null, '商品'],
] as const;

for (const [name, packageType, quantity, expectedCore] of packageCases) {
  test(`parses package without dirty core text: ${name}`, () => {
    const parsed = parseProductPackage(name);
    const product = profile({ originalName: name });
    assert.equal(parsed?.type, packageType);
    assert.equal(parsed?.quantity, quantity);
    assert.equal(product.coreProductName, expectedCore);
  });
}

test('parses live Yamazaki box/no-box identities without suffix fragments', () => {
  const woodenBox = profile({
    originalName: '山崎12年 向獅子 木箱付き',
    categoryName: 'ジャパニーズウイスキー',
  });
  const noBox = profile({
    originalName: '山崎12年 向獅子特級 箱無し',
    categoryName: 'ジャパニーズウイスキー',
  });

  assert.equal(woodenBox.package?.type, 'WOODEN_BOX');
  assert.equal(woodenBox.coreProductName, '向獅子');
  assert.equal(noBox.package?.type, 'NO_BOX');
  assert.equal(noBox.coreProductName, '向獅子特級');
});

test('requires set composition for the live Yoichi Miyagikyo 2018 set', () => {
  const product = profile({
    originalName: '余市宮城峡2018セット',
    categoryName: 'ジャパニーズウイスキー',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({ productName: '余市宮城峡', package: 'セット', vintage: '2018' }),
  );

  assert.equal(product.package?.type, 'SET');
  assert.equal(product.package?.compositionKnown, false);
  assert.equal(decision.rejectionReason, 'PACKAGE_COMPOSITION_REQUIRED');
});

test('can confirm an unregistered inferred brand from a precise official identity', () => {
  const product = profile({ originalName: '架空銘柄 シングルモルト' });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({
      sourceType: 'BRAND_OFFICIAL',
      brand: '架空銘柄',
      productName: 'シングルモルト',
    }),
  );

  assert.equal(product.brand, '架空銘柄');
  assert.equal(product.brandSource, 'DB_NAME');
  assert.equal(decision.approved, true);
});

for (const name of ['マム', 'ミニチュア', 'ランボルギーニ'] as const) {
  test(`keeps generic identity unresolved: ${name}`, () => {
    const product = profile({ originalName: name });
    const decision = evaluateProductImageIdentity(
      product,
      evidence({ productName: name }),
    );
    assert.equal(decision.rejectionReason, 'AMBIGUOUS_GENERIC_NAME');
    assert.equal(decision.approved, false);
  });
}

test('exposes required, matched, unknown, and conflict fields in decisions', () => {
  const product = profile({
    originalName: '而今 八反錦 720ml',
    categoryName: '日本酒',
  });
  const decision = evaluateProductImageIdentity(
    product,
    evidence({ brand: '而今', productName: '八反錦', volume: '1800ml' }),
  );

  assert.equal(decision.identityType, 'SAKE');
  assert.ok(decision.requiredFields.includes('volume'));
  assert.ok(decision.matchedFields.includes('product'));
  assert.ok(decision.hardConflicts.includes('volume'));
  assert.equal(decision.approved, false);
});
