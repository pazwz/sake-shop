export const ADMIN_INQUIRY_READ_EVENT = 'linxas-admin-inquiry-read';

export function startAdminInquiryPolling(
  refresh: () => Promise<void>,
  visibility: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>,
) {
  let disposed = false;
  let inFlight = false;
  let queued = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const update = async () => {
    if (disposed || visibility.hidden) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    try {
      await refresh();
    } finally {
      inFlight = false;
      if (queued) {
        queued = false;
        void update();
      }
    }
  };
  const onRead = () => void update();
  const onVisibility = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    if (!visibility.hidden) {
      void update();
      timer = setInterval(() => void update(), 30_000);
    }
  };
  onVisibility();
  visibility.addEventListener('visibilitychange', onVisibility);
  events.addEventListener(ADMIN_INQUIRY_READ_EVENT, onRead);
  return () => {
    disposed = true;
    if (timer) clearInterval(timer);
    visibility.removeEventListener('visibilitychange', onVisibility);
    events.removeEventListener(ADMIN_INQUIRY_READ_EVENT, onRead);
  };
}
