import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductMetadataCompletenessService } from '@/services/product-metadata-completeness.service';

const service = new ProductMetadataCompletenessService();

const completeInput = {
  producer: '生産者',
  origin: '日本',
  volume: '720ml',
  alcoholPercentage: 15,
  description: '商品説明',
  tastingNotes: '香りは穏やかです。',
  images: [{ id: 'image-1' }],
};

test('complete published metadata resolves as COMPLETE', () => {
  assert.deepEqual(service.resolve(completeInput), {
    status: 'COMPLETE',
    missingCoreFields: [],
    missingOptionalFields: [],
    missingFields: [],
  });
});

test('missing ABV is core incomplete while zero is not treated as missing', () => {
  const missing = service.resolve({
    ...completeInput,
    alcoholPercentage: null,
  });
  assert.equal(missing.status, 'CORE_INCOMPLETE');
  assert.deepEqual(missing.missingCoreFields, ['alcoholPercentage']);

  const zero = service.resolve({ ...completeInput, alcoholPercentage: 0 });
  assert.equal(zero.status, 'COMPLETE');
});

test('multiple missing core fields are retained in stable field order', () => {
  const result = service.resolve({
    ...completeInput,
    producer: null,
    volume: null,
  });
  assert.equal(result.status, 'CORE_INCOMPLETE');
  assert.deepEqual(result.missingCoreFields, ['producer', 'volume']);
});

test('missing tasting notes are optional and do not make core metadata incomplete', () => {
  const result = service.resolve({ ...completeInput, tastingNotes: null });
  assert.equal(result.status, 'OPTIONAL_INCOMPLETE');
  assert.deepEqual(result.missingCoreFields, []);
  assert.deepEqual(result.missingOptionalFields, ['tastingNotes']);
});

test('whitespace description and an empty image collection are core incomplete', () => {
  const result = service.resolve({
    ...completeInput,
    description: '  \n\t ',
    images: [],
  });
  assert.equal(result.status, 'CORE_INCOMPLETE');
  assert.deepEqual(result.missingCoreFields, ['description', 'image']);
});
