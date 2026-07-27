import { afterAll, beforeAll, describe } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Integration-test harness for code that talks to MongoDB.
 *
 * These tests run against a **real MongoDB**, not a mock. The data layer
 * depends on behaviour a hand-rolled fake would get wrong — atomic
 * `findOneAndUpdate` upserts, `$inc` semantics, unique-index violations, TTL
 * fields — so mocking would test the mock rather than the code.
 *
 * Provide a server with `TEST_MONGODB_URI`. CI starts one as a service
 * container (see `.github/workflows/ci.yml`). Locally:
 *
 * ```bash
 * docker run -d -p 27017:27017 --name bitecodes-test-mongo mongo:8
 * export TEST_MONGODB_URI=mongodb://127.0.0.1:27017
 * ```
 *
 * When the variable is absent these suites are **skipped, not silently
 * passed** — `pnpm test` prints a warning naming what did not run, so a green
 * local run is never mistaken for full coverage.
 */

export const TEST_DATABASE_URI = process.env.TEST_MONGODB_URI?.trim() ?? "";
export const hasTestDatabase = TEST_DATABASE_URI.length > 0;

let warned = false;

/**
 * `describe` when a test database is configured, `describe.skip` otherwise.
 * Use for any suite that needs the database.
 */
export function describeWithDatabase(name: string, factory: () => void): void {
  if (hasTestDatabase) {
    describe(name, factory);
    return;
  }

  if (!warned) {
    warned = true;
    console.warn(
      "\n[test] TEST_MONGODB_URI is not set — database integration suites are SKIPPED.\n" +
        "[test] Start one with: docker run -d -p 27017:27017 mongo:8\n" +
        "[test] then: export TEST_MONGODB_URI=mongodb://127.0.0.1:27017\n",
    );
  }
  describe.skip(name, factory);
}

/**
 * Points the application's database layer at the test server, using a fresh
 * database per test file so files cannot interfere with each other, and drops
 * it afterwards.
 */
export function useTestDatabase() {
  const databaseName = `bitecodes_test_${randomUUID().replace(/-/g, "")}`;

  beforeAll(async () => {
    // A small pool per test file, appended to the URI so the application's own
    // connection options are used unchanged otherwise.
    //
    // The application defaults to `maxPoolSize: 10`, which is right in
    // production and wrong here: vitest runs test files in parallel workers, so
    // six database suites meant six independent 10-connection pools plus index
    // creation across 26 collections each. That was enough to make a local
    // container start dropping connections mid-run, which surfaces as dozens of
    // unrelated test failures and sends you looking for a bug in the code.
    process.env.MONGODB_URI = TEST_DATABASE_URI.includes("?")
      ? `${TEST_DATABASE_URI}&maxPoolSize=3`
      : `${TEST_DATABASE_URI}?maxPoolSize=3`;
    process.env.MONGODB_DB_NAME = databaseName;

    // Required by the shared env schema, which validates everything at once.
    // Values are never used by database tests.
    process.env.SMTP_HOST ??= "localhost";
    process.env.SMTP_PORT ??= "1025";
    process.env.SMTP_SECURE ??= "false";
    process.env.SMTP_USER ??= "test";
    process.env.SMTP_PASSWORD ??= "test";
    process.env.SMTP_FROM ??= "Bitecodes <test@example.com>";
    process.env.CONTACT_NOTIFICATION_TO ??= "owner@example.com";
    process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long-000";

    global.__bitecodesMongoClientPromise = undefined;
    global.__bitecodesIndexesPromise = undefined;
  }, 60_000);

  afterAll(async () => {
    try {
      const { getDatabase, closeDatabase } =
        await import("@/lib/server/mongodb");
      const database = await getDatabase();
      await database.dropDatabase();
      await closeDatabase();
    } catch {
      // A suite that never reached the database has nothing to clean up.
    }
    global.__bitecodesMongoClientPromise = undefined;
    global.__bitecodesIndexesPromise = undefined;
  }, 60_000);
}
