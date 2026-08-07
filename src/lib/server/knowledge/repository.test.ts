import { beforeEach, expect, it } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/test/mongo";

describeWithDatabase("knowledge repository", () => {
  useTestDatabase();

  const OWNER = "owner-k";
  const BOT = "bot-1";

  beforeEach(async () => {
    const { chatbotKnowledgeSources, chatbotKnowledgeChunks } =
      await import("@/lib/server/db/collections");
    await (await chatbotKnowledgeSources()).deleteMany({});
    await (await chatbotKnowledgeChunks()).deleteMany({});
  });

  it("ingests text into an indexed source with chunks", async () => {
    const { ingestContent, listSources, countChunks } =
      await import("@/lib/server/knowledge/repository");
    const long = Array.from(
      { length: 30 },
      (_, i) => `Fact ${i} about the product.`,
    ).join(" ");
    const result = await ingestContent({
      ownerId: OWNER,
      chatbotId: BOT,
      type: "manual",
      format: "txt",
      origin: "Product facts",
      content: long,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.chunkCount).toBeGreaterThan(0);

    const sources = await listSources(OWNER, BOT);
    expect(sources).toHaveLength(1);
    expect(sources[0].status).toBe("indexed");
    expect(sources[0].chunkCount).toBeGreaterThan(0);
    expect(await countChunks(OWNER, BOT)).toBe(sources[0].chunkCount);
  });

  it("marks a source failed for unsupported formats without throwing", async () => {
    const { ingestContent, listSources } =
      await import("@/lib/server/knowledge/repository");
    const result = await ingestContent({
      ownerId: OWNER,
      chatbotId: BOT,
      type: "file",
      format: "pdf",
      origin: "brochure.pdf",
      content: "%PDF-1.7 ...binary...",
    });
    expect(result.ok).toBe(false);

    const [source] = await listSources(OWNER, BOT);
    expect(source.status).toBe("failed");
    expect(source.error).toBeTruthy();
  });

  it("extracts html to text before chunking", async () => {
    const { ingestContent } = await import("@/lib/server/knowledge/repository");
    const { chatbotKnowledgeChunks } =
      await import("@/lib/server/db/collections");
    await ingestContent({
      ownerId: OWNER,
      chatbotId: BOT,
      type: "manual",
      format: "html",
      origin: "page",
      content:
        "<h1>Returns</h1><p>Refunds within 30 days.</p><script>x()</script>",
    });
    const chunks = await (await chatbotKnowledgeChunks())
      .find({ ownerId: OWNER, chatbotId: BOT })
      .toArray();
    const text = chunks.map((c) => c.text).join(" ");
    expect(text).toContain("Refunds within 30 days");
    expect(text).not.toContain("x()");
  });

  it("deletes a source and its chunks, tenant-scoped", async () => {
    const { ingestContent, deleteSource, listSources, countChunks } =
      await import("@/lib/server/knowledge/repository");
    const r = await ingestContent({
      ownerId: OWNER,
      chatbotId: BOT,
      type: "manual",
      format: "txt",
      origin: "s",
      content: "Some indexable content here.",
    });
    if (!r.ok) throw new Error("ingest failed");

    // A different owner cannot delete it.
    expect(await deleteSource("intruder", BOT, r.sourceId)).toBe(false);
    // The real owner can.
    expect(await deleteSource(OWNER, BOT, r.sourceId)).toBe(true);
    expect(await listSources(OWNER, BOT)).toHaveLength(0);
    expect(await countChunks(OWNER, BOT)).toBe(0);
  });
});
