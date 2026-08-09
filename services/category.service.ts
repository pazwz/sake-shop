import { CategoryRepository } from '@/repositories/category.repository';
import type { CategoryRecord } from '@/types/product';

export class CategoryService {
  public constructor(
    private readonly categoryRepository = new CategoryRepository(),
  ) {}

  public async getCategories(): Promise<CategoryRecord[]> {
    const categories = await this.categoryRepository.findActive();

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.displayOrder,
      children: category.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        displayOrder: child.displayOrder,
        children: [],
      })),
    }));
  }
}
