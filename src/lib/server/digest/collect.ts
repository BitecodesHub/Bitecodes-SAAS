import "server-only";

import type {
  DigestRange,
  DigestSection,
  DigestSectionBuilder,
} from "@/lib/server/digest/types";

/**
 * Builds every digest section for a reporting window.
 *
 * Sections run in parallel, each with its own timeout and its own try/catch:
 * a slow or failing section is dropped and logged, never allowed to block the
 * owner's digest. Sections that return null (nothing to report) are left out.
 * The order below is the order in the email.
 *
 * Owned by ops-reporting; each section file is owned by its package.
 */

export const DEFAULT_SECTION_TIMEOUT_MS = 15_000;

interface SectionEntry {
  id: string;
  load: () => Promise<DigestSectionBuilder>;
}

export const DIGEST_SECTIONS: SectionEntry[] = [
  {
    id: "leads",
    load: async () =>
      (await import("@/lib/server/digest/sections/leads")).buildSection,
  },
  {
    id: "proposals",
    load: async () =>
      (await import("@/lib/server/digest/sections/proposals")).buildSection,
  },
  {
    id: "prospects",
    load: async () =>
      (await import("@/lib/server/digest/sections/prospects")).buildSection,
  },
  {
    id: "analytics",
    load: async () =>
      (await import("@/lib/server/digest/sections/analytics")).buildSection,
  },
  {
    id: "assistant",
    load: async () =>
      (await import("@/lib/server/digest/sections/assistant")).buildSection,
  },
  {
    id: "content",
    load: async () =>
      (await import("@/lib/server/digest/sections/content")).buildSection,
  },
  {
    id: "customers-lifecycle",
    load: async () =>
      (await import("@/lib/server/digest/sections/customers-lifecycle"))
        .buildSection,
  },
  {
    id: "customers-health",
    load: async () =>
      (await import("@/lib/server/digest/sections/customers-health"))
        .buildSection,
  },
  {
    id: "seo",
    load: async () =>
      (await import("@/lib/server/digest/sections/seo")).buildSection,
  },
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export interface CollectOptions {
  timeoutMs?: number;
  /** Test seam: replaces the section list. */
  sections?: SectionEntry[];
  /** Receives one line per dropped section. Defaults to console.error. */
  onError?: (id: string, message: string) => void;
}

/** Every section with something to report, in display order. */
export async function collectDigestSections(
  range: DigestRange,
  options: CollectOptions = {},
): Promise<DigestSection[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SECTION_TIMEOUT_MS;
  const entries = options.sections ?? DIGEST_SECTIONS;
  const onError =
    options.onError ??
    ((id: string, message: string) =>
      console.error(`[digest] Section "${id}" skipped: ${message}`));

  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const build = await entry.load();
        return await withTimeout(build(range), timeoutMs);
      } catch (error) {
        onError(
          entry.id,
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }
    }),
  );

  return results.filter(
    (section): section is DigestSection => section !== null,
  );
}
