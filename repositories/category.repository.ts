import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const categoryInclude = {
  children: {
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  },
} satisfies Prisma.CategoryInclude;

export type CategoryWithChildren = Prisma.CategoryGetPayload<{
  include: typeof categoryInclude;
}>;

export class CategoryRepository {
  public async findById(id: string): Promise<CategoryWithChildren | null> {
    return prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    });
  }

  public async findBySlug(slug: string): Promise<CategoryWithChildren | null> {
    return prisma.category.findUnique({
      where: { slug },
      include: categoryInclude,
    });
  }

  public async findMany(): Promise<CategoryWithChildren[]> {
    return prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: categoryInclude,
      orderBy: { displayOrder: 'asc' },
    });
  }

  public async findByCategory(
    parentId: string,
  ): Promise<CategoryWithChildren[]> {
    return prisma.category.findMany({
      where: { parentId, isActive: true },
      include: categoryInclude,
      orderBy: { displayOrder: 'asc' },
    });
  }

  public async findActive(): Promise<CategoryWithChildren[]> {
    return this.findMany();
  }
}
