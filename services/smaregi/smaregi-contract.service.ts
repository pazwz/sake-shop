import { SyncRepository } from '@/repositories/sync.repository';
import type { SmaregiContractNotification } from '@/types/smaregi';

type ContractNotificationPersistence = {
  recordContractNotification(
    notification: Pick<
      SmaregiContractNotification,
      'contractId' | 'event' | 'action' | 'date'
    >,
  ): Promise<unknown>;
};

export class SmaregiContractService {
  public constructor(
    private readonly repository: ContractNotificationPersistence = new SyncRepository(),
  ) {}

  public async receive(
    notification: SmaregiContractNotification,
  ): Promise<void> {
    await this.repository.recordContractNotification(notification);
  }
}
