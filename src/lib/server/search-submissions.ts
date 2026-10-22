import "server-only";

import { searchSubmissions } from "@/lib/server/db/collections";

/**
 * Durable retry state for IndexNow submissions.
 *
 * IndexNow answers quickly and is best-effort, but silently dropping a failed
 * submission means a newly published page waits for a crawler to stumble on it.
 * A failure is therefore written to `search_submissions` and retried by the
 * daily `search.ping` job with exponential backoff. After a bounded number of
 * attempts the row is abandoned, so an invalid path or a rejected key cannot
 * create an infinite retry loop.
 */

export const MAX_SEARCH_SUBMISSION_ATTEMPTS = 5;

const BASE_RETRY_MS = 30 * 60 * 1000;
const MAX_RETRY_MS = 24 * 60 * 60 * 1000;
/** Keep one bad URL from filling a document with a provider's HTML error page. */
const MAX_ERROR_LENGTH = 300;

/** Backoff after `attempts` failures: doubling from 30 minutes, capped at a day. */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BASE_RETRY_MS * 2 ** exponent, MAX_RETRY_MS);
}

/**
 * The canonical, site-relative path a submission row is keyed by. Absolute
 * URLs are reduced to their path; query strings and fragments are dropped
 * because they never identify a page for IndexNow.
 */
export function submissionPath(value: string): string | null {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      path = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  const bare = path.split(/[?#]/)[0] ?? "";
  if (!bare || /\s/.test(bare)) return null;
  const withSlash = bare.startsWith("/") ? bare : `/${bare}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") || "/" : "/";
}

/** Paths whose next retry is due, oldest due first. */
export async function dueSearchSubmissions(
  now: Date,
  limit = 100,
): Promise<string[]> {
  const collection = await searchSubmissions();
  const docs = await collection
    .find(
      { state: "pending", nextAttemptAt: { $lte: now } },
      { projection: { _id: 0, path: 1 } },
    )
    .sort({ nextAttemptAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => doc.path);
}

export interface SearchFailureRecord {
  /** Rows that will be tried again. */
  deferred: number;
  /** Rows that hit the attempt ceiling and will not be retried. */
  abandoned: number;
}

/**
 * Records a failed batch. One row per path; an existing row keeps its original
 * `firstFailedAt` so the age of the problem remains visible.
 */
export async function recordSearchFailures(
  paths: readonly string[],
  now: Date,
  error: string,
): Promise<SearchFailureRecord> {
  const unique = [
    ...new Set(
      paths.map(submissionPath).filter((path): path is string => path !== null),
    ),
  ];
  if (unique.length === 0) return { deferred: 0, abandoned: 0 };

  const collection = await searchSubmissions();
  const existing = await collection
    .find(
      { path: { $in: unique } },
      { projection: { _id: 0, path: 1, attempts: 1 } },
    )
    .toArray();
  const attemptsByPath = new Map(
    existing.map((doc) => [doc.path, doc.attempts]),
  );
  const message = error.slice(0, MAX_ERROR_LENGTH);

  let deferred = 0;
  let abandoned = 0;
  await Promise.all(
    unique.map(async (path) => {
      const attempts = (attemptsByPath.get(path) ?? 0) + 1;
      const isAbandoned = attempts >= MAX_SEARCH_SUBMISSION_ATTEMPTS;
      if (isAbandoned) abandoned += 1;
      else deferred += 1;

      await collection.updateOne(
        { path },
        {
          $set: {
            attempts,
            lastAttemptAt: now,
            nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)),
            state: isAbandoned ? "abandoned" : "pending",
            lastError: message,
          },
          $setOnInsert: { path, firstFailedAt: now },
        },
        { upsert: true },
      );
    }),
  );

  return { deferred, abandoned };
}

/** Drops retry rows once IndexNow has accepted the same paths. */
export async function clearSearchFailures(
  paths: readonly string[],
): Promise<void> {
  const unique = [
    ...new Set(
      paths.map(submissionPath).filter((path): path is string => path !== null),
    ),
  ];
  if (unique.length === 0) return;
  const collection = await searchSubmissions();
  await collection.deleteMany({ path: { $in: unique } });
}

export interface SearchSubmissionSummary {
  pending: number;
  due: number;
  abandoned: number;
}

/** Health counters for the admin panel and the job result. */
export async function searchSubmissionSummary(
  now = new Date(),
): Promise<SearchSubmissionSummary> {
  const collection = await searchSubmissions();
  const [pending, due, abandoned] = await Promise.all([
    collection.countDocuments({ state: "pending" }),
    collection.countDocuments({
      state: "pending",
      nextAttemptAt: { $lte: now },
    }),
    collection.countDocuments({ state: "abandoned" }),
  ]);
  return { pending, due, abandoned };
}
