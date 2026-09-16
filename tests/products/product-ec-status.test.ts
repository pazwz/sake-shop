import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProductEcStatus } from '@/services/product-ec-status.service';

const base = {
  isActive: true,
  isEcAvailable: true,
  isManuallyHidden: false,
  isEcExcluded: false,
};

test('resolves every EC publication status', () => {
  assert.equal(resolveProductEcStatus(base), 'PUBLISHED');
  assert.equal(
    resolveProductEcStatus({ ...base, isEcAvailable: false }),
    'PREPARING',
  );
  assert.equal(
    resolveProductEcStatus({ ...base, isManuallyHidden: true }),
    'HIDDEN',
  );
  assert.equal(resolveProductEcStatus({ ...base, isActive: false }), 'RETIRED');
  assert.equal(
    resolveProductEcStatus({ ...base, isEcExcluded: true }),
    'EC_EXCLUDED',
  );
});

test('EC exclusion and retirement have deterministic priority', () => {
  assert.equal(
    resolveProductEcStatus({
      ...base,
      isEcAvailable: false,
      isEcExcluded: true,
    }),
    'EC_EXCLUDED',
  );
  assert.equal(
    resolveProductEcStatus({
      ...base,
      isActive: false,
      isManuallyHidden: true,
    }),
    'RETIRED',
  );
});
