import { NotFoundError } from '@/lib/errors';
import { ProductRepository } from '@/repositories/product.repository';
import type { ProductListResult, ProductRecord } from '@/types/product';
import type { ProductQuery } from '@/validators/product.validator';

export class ProductService {
  public constructor(
    private readonly productRepository = new ProductRepository(),
  ) {}

  public async getProducts(query: ProductQuery): Promise<ProductListResult> {
    const { items, total } = await this.productRepository.findActive(query);

    return this.createListResult(items, total, query);
  }

  public async getProduct(identifier: string): Promise<ProductRecord> {
    const product =
      (await this.productRepository.findById(identifier)) ??
      (await this.productRepository.findBySlug(identifier));

    if (!product || !product.isActive || !product.isEcAvailable) {
      throw new NotFoundError('Product not found.');
    }

    return this.toProductRecord(product);
  }

  public async searchProducts(
    keyword: string,
    query: ProductQuery,
  ): Promise<ProductListResult> {
    const { items, total } = await this.productRepository.search(
      keyword,
      query,
    );

    return this.createListResult(items, total, query);
  }

  private createListResult(
    items: Awaited<ReturnType<ProductRepository['findMany']>>['items'],
    total: number,
    query: ProductQuery,
  ): ProductListResult {
    return {
      items: items.map((product) => this.toProductRecord(product)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private toProductRecord(
    product: Awaited<ReturnType<ProductRepository['findById']>> & {},
  ): ProductRecord {
    if (!product) {
      throw new NotFoundError('Product not found.');
    }

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      productCode: product.productCode,
      producer: product.producer,
      origin: product.origin,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
        parent: product.category.parent
          ? {
              id: product.category.parent.id,
              name: product.category.parent.name,
              slug: product.category.parent.slug,
              parent: null,
            }
          : null,
      },
      price: Number(product.price),
      taxRate: Number(product.taxRate),
      volume: product.volume,
      alcoholPercentage: product.alcoholPercentage
        ? Number(product.alcoholPercentage)
        : null,
      description: product.description,
      tastingNotes: product.tastingNotes,
      images: product.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        imageType: image.imageType,
        displayOrder: image.displayOrder,
        altText: image.altText,
      })),
      inventory: product.inventoryMirrors.map((inventory) => ({
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity: inventory.availableQuantity,
        lastSyncedAt: inventory.lastSyncedAt.toISOString(),
      })),
      isEcAvailable: product.isEcAvailable,
      createdAt: product.createdAt.toISOString(),
    };
  }
}
