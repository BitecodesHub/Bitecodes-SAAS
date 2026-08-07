import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("chatbot API keys", () => {
  useTestDatabase();

  const OWNER = "owner-x";

  beforeEach(async () => {
    const { chatbotApiKeys } = await import("@/lib/server/db/collections");
    await (await chatbotApiKeys()).deleteMany({});
  });

  it("creates a key, returns the secret once, and stores only a hash", async () => {
    const { createApiKey, listApiKeys } =
      await import("@/lib/server/chatbot/api-keys");
    const created = await createApiKey({ ownerId: OWNER, name: "CI key" });
    expect(created.secret.startsWith("sk_live_")).toBe(true);

    const keys = await listApiKeys(OWNER);
    expect(keys).toHaveLength(1);
    // The projection must never leak the hash.
    expect(
      (keys[0] as unknown as { keyHash?: string }).keyHash,
    ).toBeUndefined();
    expect(keys[0].prefix).toBe(created.prefix);
  });

  it("verifies a valid secret and rejects a wrong one", async () => {
    const { createApiKey, verifyApiKey } =
      await import("@/lib/server/chatbot/api-keys");
    const created = await createApiKey({ ownerId: OWNER, name: "k" });

    const good = await verifyApiKey(created.secret);
    expect(good?.ownerId).toBe(OWNER);
    expect(await verifyApiKey("sk_live_wrong")).toBeNull();
    expect(await verifyApiKey("not-a-key")).toBeNull();
    expect(await verifyApiKey(null)).toBeNull();
  });

  it("rejects an expired key", async () => {
    const { createApiKey, verifyApiKey } =
      await import("@/lib/server/chatbot/api-keys");
    const created = await createApiKey({
      ownerId: OWNER,
      name: "k",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await verifyApiKey(created.secret)).toBeNull();
  });

  it("rejects a revoked key", async () => {
    const { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } =
      await import("@/lib/server/chatbot/api-keys");
    const created = await createApiKey({ ownerId: OWNER, name: "k" });
    const [row] = await listApiKeys(OWNER);
    const id = row._id!.toHexString();

    expect(await revokeApiKey(OWNER, id)).toBe(true);
    expect(await verifyApiKey(created.secret)).toBeNull();
    // A different owner cannot revoke someone else's key.
    const other = await createApiKey({ ownerId: OWNER, name: "k2" });
    const [, row2] = await listApiKeys(OWNER);
    expect(await revokeApiKey("someone-else", row2._id!.toHexString())).toBe(
      false,
    );
    expect(await verifyApiKey(other.secret)).not.toBeNull();
  });
});
