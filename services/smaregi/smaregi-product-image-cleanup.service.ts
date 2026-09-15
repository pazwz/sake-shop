import { SmaregiMissingProductRepository } from '@/repositories/smaregi-missing-product.repository';
import type { SmaregiS3CleanupResult } from '@/types/smaregi-missing-product';

type ImageReferenceRepository = Pick<
  SmaregiMissingProductRepository,
  'countImageUrlReferences'
>;
type DeleteObject = (key: string) => Promise<void>;

const safeMessage = 'S3 object deletion failed and can be retried.';

export class SmaregiProductImageCleanupService {
  public constructor(
    private readonly repository: ImageReferenceRepository = new SmaregiMissingProductRepository(),
    private readonly deleteObject: DeleteObject = async (key) => {
      const { deleteFile } = await import('@/lib/aws/s3');
      await deleteFile(key);
    },
  ) {}

  public async cleanup(
    writeResult: {
      deletedProductCount?: number;
      retiredProductCount?: number;
      deletedImages: Array<{
        productId?: string;
        smaregiProductId?: string;
        imageUrl: string;
      }>;
    },
  ): Promise<SmaregiS3CleanupResult> {
    const failures: SmaregiS3CleanupResult['failures'] = [];
    let successCount = 0;
    let retainedSharedCount = 0;
    const urls = [
      ...new Set(writeResult.deletedImages.map((image) => image.imageUrl)),
    ];
    for (const imageUrl of urls) {
      const key = this.cloudFrontKey(imageUrl);
      if (!key) {
        retainedSharedCount += 1;
        continue;
      }
      if ((await this.repository.countImageUrlReferences(imageUrl)) > 0) {
        retainedSharedCount += 1;
        continue;
      }
      try {
        await this.deleteObject(key);
        successCount += 1;
      } catch {
        failures.push({ key, message: safeMessage });
      }
    }
    return {
      successCount,
      failureCount: failures.length,
      retainedSharedCount,
      failures,
    };
  }

  private cloudFrontKey(imageUrl: string) {
    try {
      const url = new URL(imageUrl);
      const domain = process.env.AWS_CLOUDFRONT_DOMAIN?.replace(
        /^https?:\/\//,
        '',
      ).replace(/\/+$/, '');
      if (!domain || url.host !== domain) return null;
      return decodeURIComponent(url.pathname.replace(/^\/+/, '')) || null;
    } catch {
      return null;
    }
  }
}
