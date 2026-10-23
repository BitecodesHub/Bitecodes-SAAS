import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/seo";

export interface LegalSection {
  heading: string;
  body: string[];
}

function anchorFor(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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
        <div className="container-page grid gap-14 lg:grid-cols-[220px_1fr] lg:gap-20">
          <nav
            aria-label="On this page"
            className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
          >
            <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.1em] uppercase">
              On this page
            </p>
            <ul className="mt-4 space-y-1">
              {sections.map((section) => (
                <li key={section.heading}>
                  <a
                    href={`#${anchorFor(section.heading)}`}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-start py-1 text-[13px] leading-snug transition-colors"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="max-w-3xl">
            <p className="text-muted-foreground text-[17px] leading-[1.7] sm:text-[19px]">
              {intro}
            </p>
            <div className="mt-12 space-y-12">
              {sections.map((section) => (
                <section
                  key={section.heading}
                  id={anchorFor(section.heading)}
                  className="scroll-mt-24"
                >
                  <h2 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[28px]">
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {section.body.map((p, i) => (
                      <p
                        key={i}
                        className="text-muted-foreground text-[16px] leading-[1.75]"
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <p className="bg-surface-2 text-muted-foreground mt-14 rounded-[24px] p-6 text-[14px] leading-[1.6]">
              These website terms provide general information. A signed
              proposal, statement of work, or service agreement controls the
              terms of a specific engagement. Seek independent legal advice
              where appropriate.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
