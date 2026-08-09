'use client';

import { useRouter } from 'next/navigation';

export function AdminUserStatus({
  admin,
}: {
  admin: { name: string; role: string };
}) {
  const router = useRouter();
  const logout = async () => {
    await fetch('/api/v1/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };
  return (
    <div className="flex items-center gap-3 text-xs">
      <span>
        {admin.name} / {admin.role}
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        className="border px-3 py-2"
      >
        ログアウト
      </button>
    </div>
  );
}
