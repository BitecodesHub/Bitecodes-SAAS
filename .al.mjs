import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";

/**
 * Temporarily adds or removes an allowlist entry on the live chatbot, so the
 * widget can be tested from localhost and then locked back down.
 *
 * Usage: node allowlist.mjs add|remove <domain>
 *
 * This edits a security boundary on a production bot, so it prints the before
 * and after state every time rather than succeeding silently.
 */
const [, , action, domain] = process.argv;
if (!["add", "remove"].includes(action) || !domain) {
  throw new Error("usage: allowlist.mjs add|remove <domain>");
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const BOT = "059f1881-3350-4e43-8b86-276db5265938";
const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const bots = client.db("bitecodes").collection("chatbots");

const before = await bots.findOne({ chatbotId: BOT });
console.log("  before:", JSON.stringify(before?.allowedDomains));

await bots.updateOne(
  { chatbotId: BOT },
  action === "add"
    ? { $addToSet: { allowedDomains: domain }, $set: { updatedAt: new Date() } }
    : { $pull: { allowedDomains: domain }, $set: { updatedAt: new Date() } },
);

const after = await bots.findOne({ chatbotId: BOT });
console.log("  after :", JSON.stringify(after?.allowedDomains));

await client.close();
