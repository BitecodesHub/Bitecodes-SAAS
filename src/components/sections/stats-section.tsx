import { Reveal } from "@/components/motion/reveal";
import { StatCounter } from "@/components/stat-counter";
import { stats } from "@/data/stats";

export function StatsSection() {
  return (
    <section className="container-page py-16 sm:py-20">
      <Reveal>
        <div className="border-border bg-card/40 grid gap-8 rounded-3xl border p-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCounter key={stat.label} stat={stat} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
