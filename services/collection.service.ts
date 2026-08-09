import { CollectionType, Season } from '@prisma/client';
import { FeaturedCollectionRepository } from '@/repositories/collection.repository';
export class FeaturedCollectionService {
  constructor(
    private readonly repository = new FeaturedCollectionRepository(),
  ) {}
  async getHome() {
    const all = await this.repository.findHomeCollections();
    const by = (type: CollectionType) =>
      all.filter((item) => item.type === type);
    const current = [
      Season.SPRING,
      Season.SUMMER,
      Season.AUTUMN,
      Season.WINTER,
    ][Math.floor(new Date().getMonth() / 3)];
    return {
      hero: by(CollectionType.HERO),
      currentSeason: current,
      seasonal: by(CollectionType.SEASONAL),
      shopkeeper: by(CollectionType.SHOPKEEPER),
      gift: by(CollectionType.GIFT),
      editorial: by(CollectionType.EDITORIAL),
      story: by(CollectionType.STORY),
    };
  }
}
