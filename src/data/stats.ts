import type { Stat } from "@/types/content";

/* Operational facts that are directly supported by the published site model.
 * Replace or extend these only with measured, attributable business data. */
export const stats: Stat[] = [
  { label: "Service capabilities", value: 19, suffix: "" },
  { label: "Delivery stages", value: 7, suffix: "" },
  { label: "Public case studies", value: 10, suffix: "" },
  { label: "Response target", value: 1, suffix: " business day" },
];
