import { AdminRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { ProductionSmaregiSyncPanel } from '@/components/admin/production-smaregi-sync-panel';
import { SmaregiSyncLogDetails } from '@/components/admin/smaregi-sync-log-details';
import { SmaregiProductExclusionsPanel } from '@/components/admin/smaregi-product-exclusions-panel';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { SyncService } from '@/services/sync.service';
import { SmaregiProductExclusionService } from '@/services/smaregi-product-exclusion.service';

const service = new SyncService();
const exclusions = new SmaregiProductExclusionService();

const formatDate = (value: Date | null | undefined) =>
  value ? value.toLocaleString('ja-JP') : '未実行';

export default async function SmaregiIntegrationPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role === AdminRole.STAFF) redirect('/admin');
  const [status, productionStatus, activeExclusions] = await Promise.all([
    service.getSmaregiStatus(),
    service.getProductionSmaregiSyncStatus(),
    exclusions.listActive(),
  ]);

  return (
    <main className="wrap py-16">
      <p className="eyebrow">ADMIN INTEGRATIONS</p>
      <h1 className="serif mt-4 text-5xl">Smaregi Integration</h1>
      <dl className="mt-10 grid gap-5 border-y line py-8 md:grid-cols-2">
        <div>
          <dt className="text-xs text-stone-500">Environment</dt>
          <dd className="mt-2 font-semibold">{status.environment}</dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Contract</dt>
          <dd className="mt-2 font-semibold">
            {status.contractConfigured ? 'Configured' : 'Not configured'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Approved Store IDs</dt>
          <dd className="mt-2 font-semibold">
            {status.storeId ?? 'Not configured'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Client credentials</dt>
          <dd className="mt-2 font-semibold">
            {status.clientConfigured ? 'Configured' : 'Not configured'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Last product sync</dt>
          <dd className="mt-2 font-semibold">
            {formatDate(status.lastProductSync?.completedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Last inventory sync</dt>
          <dd className="mt-2 font-semibold">
            {formatDate(status.lastInventorySync?.completedAt)}
          </dd>
        </div>
      </dl>
      <ProductionSmaregiSyncPanel status={productionStatus} canSync />
      <SmaregiProductExclusionsPanel
        initialItems={activeExclusions.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
      <h2 className="serif mt-14 text-3xl">Recent SyncLog</h2>
      <div className="mt-6 divide-y border-y line text-sm">
        {status.recentLogs.map((log) => (
          <div className="py-4" key={log.id}>
            <div className="grid gap-2 md:grid-cols-5">
              <span>{log.entityType}</span>
              <span>{log.action}</span>
              <span>{log.status}</span>
              <span>Retry {log.retryCount}</span>
              <span>{formatDate(log.completedAt ?? log.createdAt)}</span>
            </div>
            {['PRODUCTION_SYNC', 'EC_PRODUCT_EXCLUSION'].includes(
              log.entityType,
            ) ? (
              <SmaregiSyncLogDetails syncLogId={log.id} />
            ) : null}
          </div>
        ))}
        {status.recentLogs.length === 0 ? (
          <p className="py-6 text-stone-500">同期履歴はありません。</p>
        ) : null}
      </div>
    </main>
  );
}
