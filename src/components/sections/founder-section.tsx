import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { founder } from "@/data/founder";

export function FounderSection() {
  return (
    <Section className="bg-surface-2">
      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal direction="right">
            <div className="mx-auto w-full max-w-md">
              {/* A monogram, not a stock portrait: the honest stand-in until a
                  real photograph of the founder is supplied. */}
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[32px] bg-[#1d1d1f] text-white">
                <span
                  aria-hidden="true"
                  className="text-[clamp(7rem,18vw,12rem)] leading-none font-semibold tracking-[-0.08em] text-white/90"
                >
                  {founder.name.charAt(0)}
                </span>
                <span className="absolute bottom-6 left-6 text-[13px] font-medium tracking-[0.14em] text-white/45 uppercase">
                  Founder
                </span>
              </div>
              <div className="mt-4 text-center">
                <p className="text-[17px] font-semibold">{founder.name}</p>
                <p className="text-muted-foreground text-[14px]">
                  {founder.title}
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal direction="left">
            <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
              Founder
            </p>
            <h2 className="mt-4 text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
              Meet {founder.name}
            </h2>
            <p className="text-muted-foreground mt-5 text-[17px] leading-[1.6]">
              {founder.mission}
            </p>
            <dl className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-[13px] font-semibold tracking-[0.08em] uppercase">
                  Role
                </dt>
                <dd className="mt-1 text-[15px] font-medium">
                  {founder.title}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-[13px] font-semibold tracking-[0.08em] uppercase">
                  Founded
                </dt>
                <dd className="mt-1 text-[15px] font-medium">
                  {founder.founded}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground text-[13px] font-semibold tracking-[0.08em] uppercase">
                  Based in
                </dt>
                <dd className="mt-1 text-[15px] font-medium">
                  {founder.location}
                </dd>
              </div>
            </dl>
            <div className="mt-8">
              <p className="text-muted-foreground text-[13px] font-semibold tracking-[0.08em] uppercase">
                Works on
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {founder.expertise.map((skill) => (
                  <span
                    key={skill}
                    className="bg-background rounded-full px-3.5 py-1.5 text-[13px] font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
