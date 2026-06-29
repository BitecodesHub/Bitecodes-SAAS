import type { Stat } from "@/types/content";

/*
 * Headline metrics. TODO(client): tune these to the real, defensible numbers
 * you are comfortable publishing.
 */
export const stats: Stat[] = [
  { label: "Projects delivered", value: 8, suffix: "+" },
  { label: "Client retention", value: 95, suffix: "%" },
  { label: "Countries served", value: 6, suffix: "" },
  { label: "Avg. Lighthouse score", value: 98, suffix: "/100" },
];
