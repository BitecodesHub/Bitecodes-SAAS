import { Reveal } from "@/components/motion/reveal";
import { StatCounter } from "@/components/stat-counter";
import { stats } from "@/data/stats";

/**
 * Derived, precisely labelled figures only. Each value comes from published
 * data: the founding year, project URLs, product pages, and the services list.
 */
export function StatsSection() {
  return (
    <section>
      <div className="container-page py-16 sm:py-20">
        <h2 className="sr-only">Bitecodes in numbers</h2>
        <Reveal>
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 text-center lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCounter key={stat.label} stat={stat} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
