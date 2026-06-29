import { Quote } from "lucide-react";
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
              {/* Founder monogram — a deliberate, on-brand surface until a real
                  portrait is supplied. Solid accent + grid texture, no photo weight. */}
              <div className="bg-primary text-primary-foreground relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl shadow-[var(--shadow-lift)]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-[0.14]"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                    maskImage:
                      "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
                    WebkitMaskImage:
                      "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
                  }}
                />
                <span className="font-display relative text-8xl font-semibold">
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
            <Badge className="mb-4">Founder</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Meet {founder.name}
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              {founder.short}
            </p>
            <figure className="border-border bg-secondary/60 mt-6 rounded-2xl border p-6">
              <Quote className="text-primary/50 size-6" />
              <blockquote className="mt-3 text-lg leading-relaxed font-medium text-pretty">
                “{founder.quote}”
              </blockquote>
            </figure>
            <div className="mt-6 flex flex-wrap gap-2">
              {founder.expertise.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
