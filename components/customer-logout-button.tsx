'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';

export function CustomerLogoutButton() {
  const { logout } = useAuth();
  const router = useRouter();
  const [working, setWorking] = useState(false);
  return (
    <button
      type="button"
      disabled={working}
      className="text-xs underline disabled:opacity-60"
      onClick={async () => {
        setWorking(true);
        try {
          await logout();
          router.push('/');
          router.refresh();
        } finally {
          setWorking(false);
        }
      }}
    >
      {working ? 'ログアウト中…' : 'ログアウト'}
    </button>
  );
}
