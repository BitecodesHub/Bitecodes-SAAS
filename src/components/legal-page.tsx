import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/seo";

export interface LegalSection {
  heading: string;
  body: string[];
}

export function LegalPage({
  title,
  slug,
  updated,
  intro,
  sections,
}: {
  title: string;
  slug: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: title, path: `/${slug}` },
        ])}
      />
      <PageHeader
        eyebrow="Legal"
        title={title}
        description={`Last updated: ${updated}`}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: title, href: `/${slug}` },
        ]}
      />
      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <p className="text-muted-foreground leading-relaxed">{intro}</p>
          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold tracking-tight">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((p, i) => (
                    <p
                      key={i}
                      className="text-muted-foreground leading-relaxed"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <p className="border-border bg-card text-muted-foreground mt-12 rounded-xl border p-4 text-sm">
            These website terms provide general information. A signed proposal,
            statement of work, or service agreement controls the terms of a
            specific engagement. Seek independent legal advice where
            appropriate.
          </p>
        </div>
      </Section>
    </>
  );
}
