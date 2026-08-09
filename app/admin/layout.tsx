import Link from 'next/link';
import { AdminUserStatus } from '@/components/admin/admin-user-status';
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
              KURA ADMIN
            </Link>
            <AdminUserStatus admin={admin} />
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
