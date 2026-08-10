import { AdminRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { SmaregiSyncActions } from '@/components/admin/smaregi-sync-actions';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { SyncService } from '@/services/sync.service';

const service = new SyncService();

const formatDate = (value: Date | null | undefined) =>
  value ? value.toLocaleString('ja-JP') : '未実行';

export default async function SmaregiIntegrationPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role === AdminRole.STAFF) redirect('/admin');
  const status = await service.getSmaregiStatus();

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
          <dt className="text-xs text-stone-500">Store ID</dt>
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
      {admin.role === AdminRole.OWNER ? <SmaregiSyncActions /> : null}
      <h2 className="serif mt-14 text-3xl">Recent SyncLog</h2>
      <div className="mt-6 divide-y border-y line text-sm">
        {status.recentLogs.map((log) => (
          <div className="grid gap-2 py-4 md:grid-cols-5" key={log.id}>
            <span>{log.entityType}</span>
            <span>{log.action}</span>
            <span>{log.status}</span>
            <span>Retry {log.retryCount}</span>
            <span>{formatDate(log.completedAt ?? log.createdAt)}</span>
          </div>
        ))}
        {status.recentLogs.length === 0 ? (
          <p className="py-6 text-stone-500">同期履歴はありません。</p>
        ) : null}
      </div>
    </main>
  );
}
