import { redirect } from 'next/navigation';
import { OperationsHealthCards } from '@/components/admin/operations-health-cards';
import { requireDeveloper } from '@/services/admin-authorization.service';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { OperationsHealthService } from '@/services/operations-health.service';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  try {
    await requireDeveloper();
  } catch (error) {
    if (error instanceof ForbiddenError) redirect('/admin');
    if (error instanceof UnauthorizedError) redirect('/admin/login');
    throw error;
  }
  const health = await new OperationsHealthService().getHealth();
  return (
    <main className="wrap py-16">
      <p className="eyebrow">ADMIN OPERATIONS</p>
      <h1 className="serif mt-4 text-5xl">System Health</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-stone-600">
        同期・内部 worker・手動確認が必要な payment
        を読み取り専用で確認します。再実行やデータ変更は行いません。
      </p>
      <OperationsHealthCards health={health} />
    </main>
  );
}
