import { Reveal } from "@/components/motion/reveal";
import { StatCounter } from "@/components/stat-counter";
import { stats } from "@/data/stats";

/**
 * Derived, precisely labelled figures only. Each value comes from published
 * data: the founding year, project URLs, product pages, and the services list.
 */
export function StatsSection() {
  return (
    <section className="container-page py-16 sm:py-20">
      <h2 className="sr-only">Bitecodes in numbers</h2>
      <Reveal>
        <div className="border-border grid gap-10 border-y py-12 text-center sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCounter key={stat.label} stat={stat} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
