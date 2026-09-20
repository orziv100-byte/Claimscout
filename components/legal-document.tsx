import { COPYRIGHT } from "@/lib/app-info";

export function LegalDocument({
  title,
  version,
  sections,
}: {
  title: string;
  version: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Version {version}. {COPYRIGHT} No copying, sale, or commercial use without prior written
          permission from Lior Elbaz.
        </p>
      </header>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="font-heading text-xl">{section.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
        </section>
      ))}
    </article>
  );
}
