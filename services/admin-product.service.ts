import { Prisma } from '@prisma/client';
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import {
  AdminProductRepository,
  type AdminProductWithRelations,
} from '@/repositories/admin-product.repository';
import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';
import { projectApprovedInventory } from '@/services/inventory-projection.service';
import { ProductPublicationService } from '@/services/product-publication.service';
import type {
  AdminProductListResult,
  AdminProductRecord,
} from '@/types/admin-product';
import type {
  AdminProductImageInput,
  AdminProductQuery,
  AdminProductUpdate,
} from '@/validators/admin-product.validator';

export class AdminProductService {
  public constructor(
    private readonly repository = new AdminProductRepository(),
    private readonly reservations = new InventoryReservationRepository(),
    private readonly publication = new ProductPublicationService(repository),
  ) {}

  public async getProducts(
    query: AdminProductQuery,
  ): Promise<AdminProductListResult> {
    const { items, total, categories } = await this.repository.findMany(query);
    const activeReservations =
      await this.reservations.getActiveReservedQuantities(
        items.map(({ id }) => id),
      );
    return {
      items: await Promise.all(
        items.map((product) =>
          this.toRecord(
            product,
            activeReservations.get(product.id) ?? 0,
            false,
          ),
        ),
      ),
      categories,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async getProduct(id: string): Promise<AdminProductRecord> {
    const product = await this.requireProduct(id);
    const reservations = await this.reservations.getActiveReservedQuantities([
      id,
    ]);
    return this.toRecord(product, reservations.get(id) ?? 0, true);
  }

  public async updateProduct(id: string, input: AdminProductUpdate) {
    const product = await this.requireProduct(id);
    const data = this.normalizeUpdate(input);
    const candidate = { ...product, ...data };
    const activeReservations =
      await this.reservations.getActiveReservedQuantities([id]);
    if (!product.isEcAvailable && candidate.isEcAvailable) {
      const validation = await this.publication.validateProduct(
        candidate,
        activeReservations.get(id) ?? 0,
      );
      if (!validation.canPublish)
        throw new AppError(
          validation.errors.map(({ message }) => message).join('\n'),
          'PUBLICATION_VALIDATION_FAILED',
          422,
        );
    }
    try {
      const updated = await this.repository.update(id, data);
      return this.toRecord(updated, activeReservations.get(id) ?? 0, true);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError(
          'このURLスラッグは別の商品で使用されています。',
        );
      }
      throw error;
    }
  }

  public async addImage(id: string, input: AdminProductImageInput) {
    await this.requireProduct(id);
    if (!this.isCloudFrontImage(input.imageUrl))
      throw new ValidationError(
        '商品画像には管理画面からアップロードした画像を使用してください。',
      );
    return this.repository.createImage(id, input);
  }

  public async deleteImage(productId: string, imageId: string) {
    const product = await this.requireProduct(productId);
    const image = await this.repository.findImage(productId, imageId);
    if (!image) throw new NotFoundError('商品画像が見つかりません。');
    if (product.isEcAvailable && product.images.length <= 1)
      throw new ConflictError(
        '公開中の商品には1枚以上の商品画像が必要です。先に商品を非公開にしてください。',
      );
    await this.repository.deleteImage(imageId);
    return { id: imageId };
  }

  public async reorderImages(productId: string, imageIds: string[]) {
    await this.requireProduct(productId);
    const result = await this.repository.reorderImages(productId, imageIds);
    if (!result) throw new ConflictError('商品画像の状態が更新されています。');
    return result;
  }

  private async requireProduct(id: string) {
    const product = await this.repository.findById(id);
    if (!product) throw new NotFoundError('商品が見つかりません。');
    return product;
  }

  private normalizeUpdate(input: AdminProductUpdate): AdminProductUpdate {
    const nullable = (value: string | null | undefined) =>
      value === undefined ? undefined : value || null;
    return {
      ...input,
      ...(input.producer !== undefined
        ? { producer: nullable(input.producer) }
        : {}),
      ...(input.origin !== undefined ? { origin: nullable(input.origin) } : {}),
      ...(input.volume !== undefined ? { volume: nullable(input.volume) } : {}),
      ...(input.description !== undefined
        ? { description: nullable(input.description) }
        : {}),
      ...(input.tastingNotes !== undefined
        ? { tastingNotes: nullable(input.tastingNotes) }
        : {}),
    };
  }

  private isCloudFrontImage(imageUrl: string) {
    const configuredDomain = process.env.AWS_CLOUDFRONT_DOMAIN?.replace(
      /^https?:\/\//,
      '',
    )
      .replace(/\/+$/, '')
      .toLowerCase();
    if (!configuredDomain) return false;
    try {
      const url = new URL(imageUrl);
      return (
        url.protocol === 'https:' &&
        url.hostname === configuredDomain &&
        url.pathname.startsWith('/uploads/')
      );
    } catch {
      return false;
    }
  }

  private async toRecord(
    product: AdminProductWithRelations,
    activeReservedQuantity: number,
    checkSlugOwner: boolean,
  ): Promise<AdminProductRecord> {
    const projection = projectApprovedInventory(
      product.inventoryMirrors,
      activeReservedQuantity,
    );
    return {
      id: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      name: product.name,
      category: { id: product.category.id, name: product.category.name },
      price: Number(product.price),
      taxRate: Number(product.taxRate),
      isActive: product.isActive,
      lastSyncedAt: product.lastSyncedAt?.toISOString() ?? null,
      source: product.lastSyncedAt ? 'smaregi' : 'local',
      slug: product.slug,
      producer: product.producer,
      origin: product.origin,
      volume: product.volume,
      alcoholPercentage: product.alcoholPercentage
        ? Number(product.alcoholPercentage)
        : null,
      description: product.description,
      tastingNotes: product.tastingNotes,
      isEcAvailable: product.isEcAvailable,
      images: product.images.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        imageType: image.imageType,
        displayOrder: image.displayOrder,
        altText: image.altText,
      })),
      inventory: product.inventoryMirrors.map((inventory) => ({
        smaregiStoreId: inventory.smaregiStoreId,
        quantity: inventory.quantity,
        lastSyncedAt: inventory.lastSyncedAt.toISOString(),
      })),
      physicalTotalApproved: projection.physicalTotalApproved,
      activeReservedQuantity: projection.activeReservedQuantity,
      availableQuantity: projection.availableQuantity,
      publication: await this.publication.validateProduct(
        product,
        activeReservedQuantity,
        checkSlugOwner,
      ),
    };
  }
}
