import { NotFoundError } from '@/lib/errors';
import { ProductRepository } from '@/repositories/product.repository';
import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';
import { projectApprovedInventory } from '@/services/inventory-projection.service';
import {
  isPackageOnlyProduct,
  isStandaloneEcProduct,
} from '@/services/product-visibility.service';
import type { ProductListResult, ProductRecord } from '@/types/product';
import type { ProductQuery } from '@/validators/product.validator';

export class ProductService {
  public constructor(
    private readonly productRepository = new ProductRepository(),
    private readonly reservationRepository = new InventoryReservationRepository(),
  ) {}

  public async getProducts(query: ProductQuery): Promise<ProductListResult> {
    const { items, total } = await this.productRepository.findActive(query);

    const reservations =
      await this.reservationRepository.getActiveReservedQuantities(
        items.flatMap((product) => [
          product.id,
          ...(product.boxProduct ? [product.boxProduct.id] : []),
        ]),
      );
    return this.createListResult(items, total, query, reservations);
  }

  public async getProduct(identifier: string): Promise<ProductRecord> {
    const product =
      (await this.productRepository.findById(identifier)) ??
      (await this.productRepository.findBySlug(identifier));

    if (
      !product ||
      !product.isActive ||
      !product.isEcAvailable ||
      !isStandaloneEcProduct(product)
    ) {
      throw new NotFoundError('Product not found.');
    }

    const reservations =
      await this.reservationRepository.getActiveReservedQuantities([
        product.id,
        ...(product.boxProduct ? [product.boxProduct.id] : []),
      ]);
    return this.toProductRecord(
      product,
      reservations.get(product.id) ?? 0,
      product.boxProduct ? (reservations.get(product.boxProduct.id) ?? 0) : 0,
    );
  }

  public async getProductBySlug(slug: string): Promise<ProductRecord> {
    const product = await this.productRepository.findBySlug(slug);

    if (
      !product ||
      !product.isActive ||
      !product.isEcAvailable ||
      !isStandaloneEcProduct(product)
    ) {
      throw new NotFoundError('Product not found.');
    }

    const reservations =
      await this.reservationRepository.getActiveReservedQuantities([
        product.id,
        ...(product.boxProduct ? [product.boxProduct.id] : []),
      ]);
    return this.toProductRecord(
      product,
      reservations.get(product.id) ?? 0,
      product.boxProduct ? (reservations.get(product.boxProduct.id) ?? 0) : 0,
    );
  }

  public async getPreviewProductBySlug(slug: string): Promise<ProductRecord> {
    const product = await this.productRepository.findBySlug(slug);
    if (!product || !isStandaloneEcProduct(product)) {
      throw new NotFoundError('Product not found.');
    }
    const reservations =
      await this.reservationRepository.getActiveReservedQuantities([
        product.id,
        ...(product.boxProduct ? [product.boxProduct.id] : []),
      ]);
    return this.toProductRecord(
      product,
      reservations.get(product.id) ?? 0,
      product.boxProduct ? (reservations.get(product.boxProduct.id) ?? 0) : 0,
    );
  }

  public async isPublicProductSlug(slug: string): Promise<boolean> {
    return this.productRepository.isPublicSlug(slug);
  }

  public async searchProducts(
    keyword: string,
    query: ProductQuery,
  ): Promise<ProductListResult> {
    const { items, total } = await this.productRepository.search(
      keyword,
      query,
    );

    const reservations =
      await this.reservationRepository.getActiveReservedQuantities(
        items.flatMap((product) => [
          product.id,
          ...(product.boxProduct ? [product.boxProduct.id] : []),
        ]),
      );
    return this.createListResult(items, total, query, reservations);
  }

  private createListResult(
    items: Awaited<ReturnType<ProductRepository['findMany']>>['items'],
    total: number,
    query: ProductQuery,
    reservations: Map<string, number>,
  ): ProductListResult {
    return {
      items: items.map((product) =>
        this.toProductRecord(
          product,
          reservations.get(product.id) ?? 0,
          product.boxProduct
            ? (reservations.get(product.boxProduct.id) ?? 0)
            : 0,
        ),
      ),
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
    activeReservedQuantity: number,
    boxActiveReservedQuantity = 0,
  ): ProductRecord {
    if (!product) {
      throw new NotFoundError('Product not found.');
    }

    const projection = projectApprovedInventory(
      product.inventoryMirrors,
      activeReservedQuantity,
    );
    const boxProjection = product.boxProduct
      ? projectApprovedInventory(
          product.boxProduct.inventoryMirrors,
          boxActiveReservedQuantity,
        )
      : null;
    const boxOption =
      product.boxProduct && isPackageOnlyProduct(product.boxProduct)
        ? {
            id: product.boxProduct.id,
            productCode: product.boxProduct.productCode,
            name: product.boxProduct.name,
            price: Number(product.boxProduct.price),
            taxRate: Number(product.boxProduct.taxRate),
            availableQuantity: boxProjection?.availableQuantity ?? 0,
            isAvailable:
              product.boxProduct.isActive &&
              Number(product.boxProduct.price) > 0 &&
              Number(product.boxProduct.taxRate) >= 0 &&
              (boxProjection?.availableQuantity ?? 0) > 0,
          }
        : null;
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
      physicalTotalApproved: projection.physicalTotalApproved,
      store1Physical: projection.store1Physical,
      activeReservedQuantity: projection.activeReservedQuantity,
      availableQuantity: projection.availableQuantity,
      boxOption,
      isEcAvailable: product.isEcAvailable,
      createdAt: product.createdAt.toISOString(),
    };
  }
}
