import { CategoryRepository } from '@/repositories/category.repository';
import type { CategoryRecord } from '@/types/product';
import type { HeaderNavigationGroup } from '@/types/navigation';

const navigationDefinitions = [
  { id: 'sake', label: '日本酒', terms: ['日本酒', '純米', '吟醸', '大吟醸'] },
  {
    id: 'whisky',
    label: 'ウイスキー',
    terms: ['ウイスキー', 'スコッチ', 'バーボン', 'アメリカン'],
  },
  {
    id: 'wine-champagne',
    label: 'ワイン・シャンパン',
    terms: ['ワイン', 'シャンパン', 'ロゼ'],
  },
  { id: 'shochu', label: '焼酎', terms: ['焼酎'] },
  {
    id: 'brandy-spirits',
    label: 'ブランデー・スピリッツ',
    terms: [
      'ブランデー',
      'ブランディ',
      'コニャック',
      'テキーラ',
      'メスカル',
      'スピリッツ',
      'ジン',
      'ラム',
      'ウォッカ',
    ],
  },
] as const;

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
    return navigationDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
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
