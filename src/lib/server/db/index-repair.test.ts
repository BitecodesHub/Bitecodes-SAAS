import { expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("outdated index repair", () => {
  useTestDatabase();

  it("replaces the old unique tokenHash index so many pending sign-ins can coexist", async () => {
    const { getDatabase } = await import("@/lib/server/mongodb");
    const { COLLECTIONS, createDeclaredIndexes } =
      await import("@/lib/server/db/schema");
    const { desktopTokens } = await import("@/lib/server/db/collections");
    await desktopTokens();
    const db = await getDatabase();
    const raw = db.collection(COLLECTIONS.desktopTokens);

    // Reproduce production: the first release's definitions.
    await raw.drop().catch(() => undefined);
    await raw.createIndex({ tokenHash: 1 }, { unique: true });
    await raw.createIndex({ pairingCodeHash: 1 }, { sparse: true });

    await createDeclaredIndexes(db, { awaitNonUnique: true });

    const byName = Object.fromEntries(
      (await raw.indexes()).map((i) => [i.name, i]),
    );
    expect(byName.tokenHash_1?.partialFilterExpression).toEqual({
      tokenHash: { $type: "string" },
    });
    expect(byName.pairingCodeHash_1?.partialFilterExpression).toBeDefined();
    expect(byName.deviceCodeHash_1).toBeDefined(); // was blocked by the conflict before

    // The production failure: a second pending sign-in hit E11000 on tokenHash: null.
    const { startPairing } = await import("@/lib/server/desktop/devices");
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        startPairing({ label: "Notes on macOS" }),
      ),
    );
    expect(new Set(results.map((r) => r.userCode)).size).toBe(5);
  });
});
