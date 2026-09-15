import { NotFoundError } from '@/lib/errors';
import { SyncLogItemRepository } from '@/repositories/sync-log-item.repository';

export class SmaregiSyncDetailService {
  public constructor(private readonly repository = new SyncLogItemRepository()) {}

  public async getItems(syncLogId: string, page: number, limit: number) {
    const result = await this.repository.findBySyncLogId(syncLogId, page, limit);
    if (page > 1 && result.items.length === 0 && result.total === 0)
      throw new NotFoundError('同期明細が見つかりません。');
    return {
      ...result,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    };
  }
}
