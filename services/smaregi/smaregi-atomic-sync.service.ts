import { SmaregiAtomicSyncRepository } from '@/repositories/smaregi-atomic-sync.repository';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import { getSmaregiTargetDate } from '@/services/smaregi/smaregi-tax-resolver';
import { selectApprovedSmaregiStores } from '@/services/smaregi/smaregi-store-policy';
import type { SmaregiApiClient } from '@/types/smaregi';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

type AtomicSyncPersistence = Pick<
  SmaregiAtomicSyncRepository,
  'applyValidatedPlan'
>;

export class SmaregiAtomicSyncService {
  public constructor(
    private readonly client: SmaregiApiClient = new SmaregiClient(),
    private readonly repository: AtomicSyncPersistence = new SmaregiAtomicSyncRepository(),
  ) {}

  public async prepareValidatedPlan(targetDate = getSmaregiTargetDate()) {
    const syncedAt = new Date();
    const [stores, categories, products, standardTaxRates, reduceTaxRates] =
      await Promise.all([
        this.client.getStores(),
        this.client.getCategories(),
        this.client.getProducts(),
        this.client.getConsumptionTaxRates(),
        this.client.getReduceTaxRates(),
      ]);
    const approvedStores = selectApprovedSmaregiStores(stores);
    const stock = (
      await Promise.all(
        approvedStores.map((store) => this.client.getStock(store.storeId)),
      )
    ).flat();

    return buildValidatedSmaregiSyncPlan({
      targetDate,
      syncedAt,
      stores: approvedStores,
      categories,
      products,
      stock,
      standardTaxRates,
      reduceTaxRates,
    });
  }

  public executeApprovedSync(plan: ValidatedSmaregiSyncPlan) {
    return this.repository.applyValidatedPlan(plan);
  }
}
