import { getSmaregiConfigurationStatus } from '@/config/smaregi';
import { SyncRepository } from '@/repositories/sync.repository';

export class SyncService {
  public constructor(private readonly repository = new SyncRepository()) {}

  public async getSmaregiStatus() {
    const [lastProductSync, lastInventorySync, recentLogs] = await Promise.all([
      this.repository.findLast('PRODUCT'),
      this.repository.findLast('INVENTORY'),
      this.repository.findRecent(),
    ]);
    return {
      ...getSmaregiConfigurationStatus(),
      lastProductSync,
      lastInventorySync,
      recentLogs,
    };
  }
}
