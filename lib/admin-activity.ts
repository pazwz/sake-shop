import { ADMIN_ACTIVITY_EVENTS } from '@/lib/admin-inquiry-polling';

/** Only real browser interactions renew the session, at most once per minute. No heartbeat. */
export function startAdminActivity(
  renew: () => Promise<boolean>,
  visibility: Pick<Document, 'hidden'>,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>,
) {
  let lastAttempt = -Infinity;
  let inFlight = false;
  let disposed = false;
  let expired = false;
  const activity = async (event: Event) => {
    if (!event.isTrusted || visibility.hidden || disposed || expired || inFlight || Date.now() - lastAttempt < 60_000) return;
    lastAttempt = Date.now();
    inFlight = true;
    try { expired = !(await renew()); }
    catch { /* Network failure does not extend the server-side deadline. */ }
    finally { inFlight = false; }
  };
  const onActivity = (event: Event) => { void activity(event); };
  for (const name of ADMIN_ACTIVITY_EVENTS) events.addEventListener(name, onActivity);
  return () => { disposed = true; for (const name of ADMIN_ACTIVITY_EVENTS) events.removeEventListener(name, onActivity); };
}
