import { stats } from "@/data/stats";

/**
 * A compact, verifiable fact bar for placement by the landing package.
 *
 * It reads the same derived figures as the full statistics section, so it can
 * never drift from the founding year, published projects, live products, or
 * services count.
 */
export function ProofBar() {
  return (
    <section
      aria-label="Bitecodes at a glance"
      className="border-border bg-surface-2 border-y"
    >
      <div className="container-page">
        <dl className="grid gap-x-8 gap-y-5 py-7 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-muted-foreground text-sm">{stat.label}</dt>
              <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                {stat.prefix}
                {stat.value}
                {stat.suffix}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
