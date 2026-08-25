import Link from 'next/link';
import { AdminUserStatus } from '@/components/admin/admin-user-status';
import { BrandLogo } from '@/components/brand-logo';
import { getCurrentAdmin } from '@/services/admin-authorization.service';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getCurrentAdmin();
  return (
    <>
      {admin ? (
        <div className="border-b line bg-[#faf8f4]">
          <div className="wrap flex items-center justify-between py-3">
            <Link href="/admin" className="font-semibold tracking-[.18em]">
              <BrandLogo variant="admin" /> ADMIN
            </Link>
            <AdminUserStatus admin={{ name: admin.name, role: admin.role }} />
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
