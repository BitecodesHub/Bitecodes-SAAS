import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { Marquee } from "@/components/marquee";
import { TechIcon } from "@/components/tech-icon";
import { Button } from "@/components/ui/button";
import { technologies } from "@/data/technologies";

export function TechSection() {
  return (
    <Section id="technologies">
      <div className="container-page">
        <SectionHeader
          eyebrow="Our stack"
          title="Proven technologies, chosen on purpose"
          description="We reach for mature, well-understood tools — and the right new ones — so your software is fast to build and easy to maintain."
        />
      </div>
      <div className="mt-14 space-y-5">
        <Marquee>
          {technologies.slice(0, 11).map((t) => (
            <TechChip key={t.slug} slug={t.slug} name={t.name} />
          ))}
        </Marquee>
        <Marquee className="[&_.animate-marquee]:[animation-direction:reverse]">
          {technologies.slice(11).map((t) => (
            <TechChip key={t.slug} slug={t.slug} name={t.name} />
          ))}
        </Marquee>
      </div>
      <div className="container-page mt-12 flex justify-center">
        <Button asChild variant="outline" size="lg">
          <Link href="/technologies">
            Explore our technologies
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}

function TechChip({ slug, name }: { slug: string; name: string }) {
  return (
    <span className="border-border bg-card mx-2 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-[var(--shadow-soft)]">
      <TechIcon slug={slug} name={name} size="sm" />
      <span className="text-sm font-medium whitespace-nowrap">{name}</span>
    </span>
  );
}
