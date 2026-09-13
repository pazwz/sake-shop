import { AgeNotice } from '@/components/age-notice';

export type LegalPolicySection = {
  heading: string;
  paragraphs?: string[];
  rows?: Array<{ label: string; value: React.ReactNode }>;
  items?: string[];
};

export function LegalPolicyPage({
  eyebrow,
  title,
  introduction,
  sections,
  showAlcoholNotice = true,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: LegalPolicySection[];
  showAlcoholNotice?: boolean;
}) {
  return (
    <div className="wrap max-w-4xl py-16 md:py-24">
      <header className="border-b line pb-10 md:pb-14">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="serif mt-5 text-4xl leading-tight md:text-5xl">
          {title}
        </h1>
        <p className="mt-7 max-w-2xl text-sm leading-8 text-stone-600">
          {introduction}
        </p>
        {showAlcoholNotice ? <AgeNotice className="mt-6" /> : null}
      </header>
      <div className="divide-y line">
        {sections.map((section) => (
          <section className="py-10 md:py-12" key={section.heading}>
            <h2 className="serif text-2xl">{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p
                className="mt-5 text-sm leading-8 text-stone-600"
                key={paragraph}
              >
                {paragraph}
              </p>
            ))}
            {section.rows ? (
              <dl className="mt-6 border-y line">
                {section.rows.map((row) => (
                  <div
                    className="grid gap-2 border-b line py-5 text-sm last:border-b-0 md:grid-cols-[220px_1fr]"
                    key={row.label}
                  >
                    <dt className="text-stone-500">{row.label}</dt>
                    <dd className="leading-7">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {section.items ? (
              <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-stone-600">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}

export function PendingLegalInformation({ children }: { children: string }) {
  return (
    <span className="text-stone-500">
      確認中（正式公開前に掲載）：{children}
    </span>
  );
}
