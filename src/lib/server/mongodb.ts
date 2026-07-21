import "server-only";

import { MongoClient, type Db } from "mongodb";
import { getServerEnv } from "@/lib/server/env";

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

function getClientPromise() {
  if (process.env.NODE_ENV === "development") {
    global.__bitecodesMongoClientPromise ??= createClientPromise();
    return global.__bitecodesMongoClientPromise;
  }

  return createClientPromise();
}

let productionClientPromise: Promise<MongoClient> | undefined;

export async function getDatabase(): Promise<Db> {
  const { MONGODB_DB_NAME } = getServerEnv();
  productionClientPromise ??= getClientPromise();
  const client = await productionClientPromise;
  const database = client.db(MONGODB_DB_NAME);

  await ensureIndexes(database);
  return database;
}

async function ensureIndexes(database: Db) {
  global.__bitecodesIndexesPromise ??= Promise.all([
    database.collection("contact_enquiries").createIndex({ createdAt: -1 }),
    database
      .collection("contact_enquiries")
      .createIndex({ email: 1, createdAt: -1 }),
    database
      .collection("contact_enquiries")
      .createIndex({ requestId: 1 }, { unique: true }),
  ]).then(() => undefined);

  return global.__bitecodesIndexesPromise;
}
