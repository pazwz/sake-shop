import type {
  OperationsHealth,
  OperationsHealthItem,
} from '@/types/operations';

const labels = {
  smaregiSync: 'Smaregi Sync',
  reservationExpiration: 'Reservation Worker',
  emailOutbox: 'Email Worker',
  paymentReview: 'Payment Review',
} as const;

const tone = {
  HEALTHY: 'border-emerald-700/30 bg-emerald-50 text-emerald-900',
  WARNING: 'border-amber-700/30 bg-amber-50 text-amber-900',
  CRITICAL: 'border-red-700/30 bg-red-50 text-red-900',
  UNKNOWN: 'border-stone-400 bg-stone-50 text-stone-700',
} as const;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('ja-JP') : '未実行';

const Card = ({
  label,
  item,
}: {
  label: string;
  item: OperationsHealthItem;
}) => (
  <section className={`border p-5 ${tone[item.status]}`}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">{label}</h2>
      <span className="text-xs font-semibold tracking-wide">{item.status}</span>
    </div>
    <p className="mt-4 text-sm leading-6">{item.summary}</p>
    <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
      <div>
        <dt>最終成功</dt>
        <dd className="mt-1 font-medium">{formatDate(item.lastSuccessAt)}</dd>
      </div>
      <div>
        <dt>最終試行</dt>
        <dd className="mt-1 font-medium">{formatDate(item.lastAttemptAt)}</dd>
      </div>
      <div>
        <dt>失敗数（直近3回）</dt>
        <dd className="mt-1 font-medium">{item.failureCount}</dd>
      </div>
      <div>
        <dt>要確認件数</dt>
        <dd className="mt-1 font-medium">{item.backlogCount}</dd>
      </div>
    </dl>
  </section>
);

export function OperationsHealthCards({
  health,
}: {
  health: OperationsHealth;
}) {
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => (
        <Card key={key} label={labels[key]} item={health[key]} />
      ))}
    </div>
  );
}
