'use client';
import { useEffect } from 'react';
export function CustomerAnnouncementDetail({ id }: { id: string }) { useEffect(() => { void fetch(`/api/v1/customer/notifications/announcements/${id}/read`, { method: 'POST' }); }, [id]); return null; }
