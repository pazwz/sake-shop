import { AdminWorkspace } from '@/components/admin/workspace';
import { getCurrentAdmin } from '@/services/admin-authorization.service';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getCurrentAdmin();
  return admin ? (
    <AdminWorkspace admin={{ name: admin.name }}>
      {children}
    </AdminWorkspace>
  ) : (
    children
  );
}
