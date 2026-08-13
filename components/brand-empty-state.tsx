import Link from 'next/link';

export function BrandEmptyState({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="brand-empty-state py-20 text-center" data-reveal>
      <svg
        viewBox="0 0 80 86"
        className="mx-auto h-20 w-20 text-[#6d2227]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        <path d="M19 10h42l-6 42c-1 8-6 12-15 12s-14-4-15-12l-6-42Z" />
        <path d="M26 44h28M40 64v12m-15 0h30" />
      </svg>
      <p className="serif mt-6 text-2xl">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-500">
        {description}
      </p>
      {href && linkLabel ? (
        <Link href={href} className="brand-link mt-7 inline-flex">
          {linkLabel} <i aria-hidden="true">→</i>
        </Link>
      ) : null}
    </div>
  );
}
