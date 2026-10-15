export const ADMIN_INQUIRY_READ_EVENT = 'linxas-admin-inquiry-read';
export const ADMIN_IDLE_MS = 15 * 60_000;
export const ADMIN_ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'focus'] as const;

/** Historical export name retained; there is deliberately no polling interval. */
export function startAdminInquiryPolling(
  refresh: () => Promise<void>,
  visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>,
) {
  let disposed = false;
  let inFlight = false;
  let queuedRead = false;
  let lastActivity = Date.now();
  let lastRefresh = -Infinity;
  const update = async (localRead = false) => {
    if (disposed || visibility.hidden || Date.now() - lastActivity >= ADMIN_IDLE_MS) return;
    if (inFlight) { if (localRead) queuedRead = true; return; }
    if (!localRead && Date.now() - lastRefresh < 250) return;
    inFlight = true;
    lastRefresh = Date.now();
    try { await refresh(); }
    finally {
      inFlight = false;
      if (queuedRead) { queuedRead = false; void update(true); }
    }
  };
  const onRead = () => void update(true);
  const onVisibility = () => { if (!visibility.hidden) void update(); };
  const onActivity = (event: Event) => {
    if (visibility.hidden) return;
    const idle = Date.now() - lastActivity >= ADMIN_IDLE_MS;
    lastActivity = Date.now();
    if (idle || event.type === 'focus') void update();
  };
  void update();
  visibility.addEventListener('visibilitychange', onVisibility);
  events.addEventListener(ADMIN_INQUIRY_READ_EVENT, onRead);
  for (const name of ADMIN_ACTIVITY_EVENTS) events.addEventListener(name, onActivity);
  return () => {
    disposed = true;
    visibility.removeEventListener('visibilitychange', onVisibility);
    events.removeEventListener(ADMIN_INQUIRY_READ_EVENT, onRead);
    for (const name of ADMIN_ACTIVITY_EVENTS) events.removeEventListener(name, onActivity);
  };
}
