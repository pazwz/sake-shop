import {
  SMAREGI_MISSING_PRODUCT_MODES,
  type SmaregiMissingProductMode,
} from '@/config/smaregi';
import { SMAREGI_NON_STANDALONE_PRODUCT_IDS } from '@/config/public-products';
import { SMAREGI_BOX_CATEGORY_ID } from '@/config/box-products';
import { AppError } from '@/lib/errors';
import {
  SmaregiMissingProductRepository,
  type SmaregiMissingProductRecord,
} from '@/repositories/smaregi-missing-product.repository';
import type {
  SmaregiMissingProductCandidate,
  SmaregiMissingProductPlan,
} from '@/types/smaregi-missing-product';
import type { SmaregiProductSnapshot } from '@/types/smaregi';

type MissingRepository = Pick<
  SmaregiMissingProductRepository,
  'findAbsentFromSource'
>;

const nonStandaloneIds = new Set<string>(SMAREGI_NON_STANDALONE_PRODUCT_IDS);
const validSmaregiIdentity = /^\d+$/;

export class SmaregiMissingProductService {
  public constructor(
    private readonly repository: MissingRepository = new SmaregiMissingProductRepository(),
  ) {}

  public async buildPlan(
    snapshot: SmaregiProductSnapshot,
    mode: SmaregiMissingProductMode,
  ): Promise<SmaregiMissingProductPlan> {
    if (!SMAREGI_MISSING_PRODUCT_MODES.includes(mode))
      throw new AppError(
        'Smaregi missing product mode is invalid.',
        'SMAREGI_MISSING_PRODUCT_MODE_INVALID',
        500,
      );
    if (!snapshot.complete || snapshot.products.length === 0)
      throw new AppError(
        'Smaregi Product snapshot is incomplete.',
        'SMAREGI_PRODUCT_SNAPSHOT_INCOMPLETE',
        503,
      );
    const sourceProductIds = snapshot.products.map(
      (product) => product.productId,
    );
    const identities = new Set(sourceProductIds);
    if (
      identities.size !== snapshot.sourceIdentityCount ||
      identities.size !== snapshot.products.length
    )
      throw new AppError(
        'Smaregi Product snapshot identity set is incomplete.',
        'SMAREGI_PRODUCT_SNAPSHOT_IDENTITY_INVALID',
        503,
      );

    const missing = (
      await this.repository.findAbsentFromSource(sourceProductIds)
    ).filter((product) => this.isManagedStandaloneProduct(product));
    const safeToDelete: SmaregiMissingProductCandidate[] = [];
    const retire: SmaregiMissingProductCandidate[] = [];
    for (const product of missing) {
      const candidate = this.toCandidate(product);
      (this.hasBusinessReferences(candidate) ? retire : safeToDelete).push(
        candidate,
      );
    }
    return {
      mode,
      snapshotComplete: true,
      sourceProductCount: snapshot.products.length,
      sourceIdentityCount: snapshot.sourceIdentityCount,
      sourceProductIds,
      safeToDelete,
      retire,
      blocked: [],
    };
  }

  private isManagedStandaloneProduct(product: SmaregiMissingProductRecord) {
    return (
      validSmaregiIdentity.test(product.smaregiProductId) &&
      !nonStandaloneIds.has(product.smaregiProductId) &&
      product.categorySmaregiId !== SMAREGI_BOX_CATEGORY_ID
    );
  }

  private toCandidate(
    product: SmaregiMissingProductRecord,
  ): SmaregiMissingProductCandidate {
    return {
      id: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      name: product.name,
      imageUrls: product.imageUrls,
      references: {
        ...product.references,
        boxRelations:
          Number(Boolean(product.boxProductId)) +
          Number(Boolean(product.boxedProductId)),
      },
    };
  }

  private hasBusinessReferences(candidate: SmaregiMissingProductCandidate) {
    return Object.values(candidate.references).some((count) => count > 0);
  }
}
