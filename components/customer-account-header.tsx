import Link from 'next/link';

export function CustomerAccountHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <>
      <Link href="/account" className="text-xs underline">
        マイページへ戻る
      </Link>
      <p className="eyebrow mt-8">{eyebrow}</p>
      <h1 className="serif mt-4 text-4xl md:text-5xl">{title}</h1>
    </>
  );
}
