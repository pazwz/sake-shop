import { CategoryRepository } from '@/repositories/category.repository';
import { PUBLIC_PRODUCT_NAVIGATION } from '@/config/public-navigation';
import type { CategoryRecord } from '@/types/product';
import type { HeaderNavigationGroup } from '@/types/navigation';

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

  public async getHeaderNavigation(): Promise<HeaderNavigationGroup[]> {
    const categories =
      await this.categoryRepository.findPublicProductCategories();
    return PUBLIC_PRODUCT_NAVIGATION.map((definition) => ({
      id: definition.id,
      label: definition.label,
      href: definition.href,
      links: categories
        .filter((category) =>
          definition.terms.some((term) => category.name.includes(term)),
        )
        .map((category) => ({
          label: category.name,
          href: `/products?category=${encodeURIComponent(category.slug)}`,
        })),
    }));
  }
}
