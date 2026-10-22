import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { founder } from "@/data/founder";

export function FounderSection() {
  return (
    <Section className="border-border bg-muted/50 border-y">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal direction="right">
            <div className="mx-auto max-w-sm">
              {/* Founder monogram, a quiet on-brand surface until a real
                  portrait is supplied. No texture or decorative backdrop. */}
              <div className="bg-primary text-primary-foreground relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
                <span
                  aria-hidden="true"
                  className="font-display text-8xl font-semibold"
                >
                  {founder.name.charAt(0)}
                </span>
              </div>
              <div className="border-border bg-card mt-4 rounded-2xl border p-4 text-center shadow-[var(--shadow-soft)]">
                <p className="font-semibold">{founder.name}</p>
                <p className="text-muted-foreground text-sm">{founder.title}</p>
              </div>
            </div>
          </Reveal>

          <Reveal direction="left">
            <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-[0.16em] uppercase">
              Founder
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Meet {founder.name}
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              {founder.mission}
            </p>
            <dl className="border-border mt-8 grid gap-4 border-t pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                  Role
                </dt>
                <dd className="mt-1 text-sm font-medium">{founder.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                  Founded
                </dt>
                <dd className="mt-1 text-sm font-medium">{founder.founded}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                  Based in
                </dt>
                <dd className="mt-1 text-sm font-medium">{founder.location}</dd>
              </div>
            </dl>
            <div className="mt-6">
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
                Works on
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {founder.expertise.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
