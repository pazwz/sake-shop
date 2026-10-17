'use client';
import { useEffect } from 'react';
import { startAdminActivity } from '@/lib/admin-activity';

export function AdminActivity() {
  useEffect(() => startAdminActivity(async () => {
    const response = await fetch('/api/v1/admin/auth/activity', { method: 'POST' });
    if (response.status === 401) {
      window.location.assign('/admin/login');
      return false;
    }
    return true;
  }, document, window), []);
  return null;
}
