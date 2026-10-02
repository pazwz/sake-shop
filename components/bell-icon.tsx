export function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.5 18.75a2.75 2.75 0 0 1-5 0m8.6-3.1c-.7-.8-1.35-1.9-1.35-3.65v-1.2a4.75 4.75 0 1 0-9.5 0V12c0 1.75-.65 2.85-1.35 3.65-.32.37-.06.93.43.93h11.34c.49 0 .75-.56.43-.93Z"
      />
    </svg>
  );
}
