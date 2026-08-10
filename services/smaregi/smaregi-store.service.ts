import { getSmaregiEnvironment } from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import type { SmaregiApiClient } from '@/types/smaregi';

export class SmaregiStoreService {
  public constructor(
    private readonly client: SmaregiApiClient = new SmaregiClient(),
  ) {}

  public async verifyConfiguredStore() {
    const { SMAREGI_STORE_ID } = getSmaregiEnvironment();
    const stores = await this.client.getStores();
    const store = stores.find((item) => item.storeId === SMAREGI_STORE_ID);
    if (!store) {
      throw new AppError(
        'The configured Smaregi store could not be found.',
        'SMAREGI_STORE_NOT_FOUND',
        422,
      );
    }
    return store;
  }
}
