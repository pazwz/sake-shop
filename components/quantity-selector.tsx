'use client';

export function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-12 w-32 items-center justify-between border border-stone-300">
      <button
        aria-label="数量を減らす"
        className="px-4"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        −
      </button>
      <span className="text-sm">{value}</span>
      <button
        aria-label="数量を増やす"
        className="px-4"
        onClick={() => onChange(value + 1)}
      >
        ＋
      </button>
    </div>
  );
}
