import { AdminOrderDetail } from '@/components/admin/admin-order-detail';
import { getCurrentAdmin } from '@/services/admin-authorization.service';

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [admin, { id }] = await Promise.all([getCurrentAdmin(), params]);
  return (
    <AdminOrderDetail
      orderId={id}
      canManage={Boolean(admin)}
    />
  );
}
