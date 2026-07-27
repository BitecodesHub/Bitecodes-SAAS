import "server-only";

import { MongoClient, type Db } from "mongodb";
import { getServerEnv } from "@/lib/server/env";
import { createDeclaredIndexes } from "@/lib/server/db/schema";

declare global {
  var __bitecodesMongoClientPromise: Promise<MongoClient> | undefined;
  var __bitecodesIndexesPromise: Promise<void> | undefined;
}

function createClientPromise() {
  const { MONGODB_URI } = getServerEnv();
  const client = new MongoClient(MONGODB_URI, {
    appName: "BitecodesWebsite",
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  return client.connect();
}

/**
 * The connected client, cached on `global`.
 *
 * `global` rather than a module-level variable so that a dev-server hot reload
 * (which re-evaluates the module) reuses the existing connection instead of
 * leaking a new pool, and so tests can reset it between files.
 */
function getClientPromise(): Promise<MongoClient> {
  global.__bitecodesMongoClientPromise ??= createClientPromise();
  return global.__bitecodesMongoClientPromise;
}

export async function getDatabase(): Promise<Db> {
  const { MONGODB_DB_NAME } = getServerEnv();
  const client = await getClientPromise();
  const database = client.db(MONGODB_DB_NAME);

  await ensureIndexes(database);
  return database;
}

/**
 * Creates every index declared in `db/schema.ts`, once per process.
 *
 * The promise is cached on `global` so the work happens on the first query
 * and never again, and so a dev-server hot reload does not re-run it.
 */
async function ensureIndexes(database: Db) {
  global.__bitecodesIndexesPromise ??= createDeclaredIndexes(database);
  return global.__bitecodesIndexesPromise;
}

/**
 * Closes the pooled connection. Only used by tests and one-off scripts — a
 * long-running server should keep the pool for its whole lifetime.
 */
export async function closeDatabase(): Promise<void> {
  const promise = global.__bitecodesMongoClientPromise;
  if (!promise) return;
  global.__bitecodesMongoClientPromise = undefined;
  global.__bitecodesIndexesPromise = undefined;
  try {
    const client = await promise;
    await client.close();
  } catch {
    // A connection that never established has nothing to close.
  }
}
