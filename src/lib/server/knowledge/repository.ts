import "server-only";

import { ObjectId } from "mongodb";
import {
  chatbotKnowledgeChunks,
  chatbotKnowledgeSources,
} from "@/lib/server/db/collections";
import type {
  KnowledgeSourceDoc,
  KnowledgeSourceType,
} from "@/lib/server/db/types";
import { chunkText } from "@/lib/chatbot/chunk";
import { extractText, type KnowledgeFormat } from "@/lib/chatbot/extract";

/**
 * Knowledge-base data access and ingestion, tenant-scoped by
 * `ownerId + chatbotId`.
 *
 * Ingestion runs the deterministic part of the pipeline — extract text, chunk
 * it, store the chunks — and moves the source through
 * queued → processing → indexed | failed so the UI can show progress. The
 * embedding step is intentionally left out here: it needs a provider and an
 * Atlas Vector index, so chunks are stored with an empty `embedding` and
 * embedded later when that infrastructure exists. Nothing else in the pipeline
 * changes when embeddings are added.
 */

export interface KnowledgeSourceSummary {
  id: string;
  type: KnowledgeSourceType;
  origin: string;
  status: KnowledgeSourceDoc["status"];
  chunkCount: number;
  bytes: number;
  error: string | null;
  createdAt: Date;
}

function toSummary(doc: KnowledgeSourceDoc): KnowledgeSourceSummary {
  return {
    id: doc._id?.toHexString() ?? "",
    type: doc.type,
    origin: doc.origin,
    status: doc.status,
    chunkCount: doc.chunkCount,
    bytes: doc.bytes,
    error: doc.error,
    createdAt: doc.createdAt,
  };
}

export async function listSources(
  ownerId: string,
  chatbotId: string,
): Promise<KnowledgeSourceSummary[]> {
  const collection = await chatbotKnowledgeSources();
  const docs = await collection
    .find({ ownerId, chatbotId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toSummary);
}

async function createSource(input: {
  ownerId: string;
  chatbotId: string;
  type: KnowledgeSourceType;
  origin: string;
  bytes: number;
}): Promise<string> {
  const collection = await chatbotKnowledgeSources();
  const now = new Date();
  const result = await collection.insertOne({
    ownerId: input.ownerId,
    chatbotId: input.chatbotId,
    type: input.type,
    origin: input.origin,
    status: "queued",
    bytes: input.bytes,
    chunkCount: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
  } as KnowledgeSourceDoc);
  return result.insertedId.toHexString();
}

async function setStatus(
  sourceId: string,
  status: KnowledgeSourceDoc["status"],
  extra: Partial<Pick<KnowledgeSourceDoc, "chunkCount" | "error">> = {},
): Promise<void> {
  const collection = await chatbotKnowledgeSources();
  await collection.updateOne(
    { _id: new ObjectId(sourceId) },
    { $set: { status, updatedAt: new Date(), ...extra } },
  );
}

async function storeChunks(
  ownerId: string,
  chatbotId: string,
  sourceId: string,
  chunks: { ord: number; text: string; tokenCount: number }[],
  meta: { title: string | null; url: string | null },
): Promise<void> {
  if (chunks.length === 0) return;
  const collection = await chatbotKnowledgeChunks();
  const now = new Date();
  await collection.insertMany(
    chunks.map((c) => ({
      ownerId,
      chatbotId,
      sourceId,
      ord: c.ord,
      text: c.text,
      tokenCount: c.tokenCount,
      // Embeddings are added when the vector store exists; empty until then.
      embedding: [],
      meta,
      createdAt: now,
    })),
  );
}

export type IngestResult =
  | { ok: true; sourceId: string; chunkCount: number }
  | { ok: false; sourceId: string; reason: string };

/**
 * Ingests raw content for a chatbot: records a source, extracts text for the
 * given format, chunks it, and stores the chunks. Progress is reflected on the
 * source document throughout, and any failure marks it `failed` with a reason
 * rather than throwing — the UI surfaces that per source.
 */
export async function ingestContent(input: {
  ownerId: string;
  chatbotId: string;
  type: KnowledgeSourceType;
  format: KnowledgeFormat;
  origin: string;
  content: string;
  title?: string | null;
  url?: string | null;
}): Promise<IngestResult> {
  const bytes = Buffer.byteLength(input.content, "utf8");
  const sourceId = await createSource({
    ownerId: input.ownerId,
    chatbotId: input.chatbotId,
    type: input.type,
    origin: input.origin,
    bytes,
  });

  try {
    await setStatus(sourceId, "processing");

    const extracted = extractText(input.content, input.format);
    if (!extracted.ok) {
      await setStatus(sourceId, "failed", {
        error:
          extracted.reason === "unsupported"
            ? "This file type needs a parser we have not enabled yet."
            : extracted.reason === "invalid"
              ? "The content could not be parsed."
              : "The content was empty.",
      });
      return { ok: false, sourceId, reason: extracted.reason };
    }

    const chunks = chunkText(extracted.text);
    await storeChunks(input.ownerId, input.chatbotId, sourceId, chunks, {
      title: input.title ?? null,
      url: input.url ?? null,
    });
    await setStatus(sourceId, "indexed", { chunkCount: chunks.length });
    return { ok: true, sourceId, chunkCount: chunks.length };
  } catch (error) {
    await setStatus(sourceId, "failed", {
      error: error instanceof Error ? error.message : "Ingestion failed.",
    });
    return { ok: false, sourceId, reason: "exception" };
  }
}

/** Deletes a source and all of its chunks. Tenant-scoped. */
export async function deleteSource(
  ownerId: string,
  chatbotId: string,
  sourceId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(sourceId)) return false;
  const sources = await chatbotKnowledgeSources();
  const result = await sources.deleteOne({
    _id: new ObjectId(sourceId),
    ownerId,
    chatbotId,
  });
  if (result.deletedCount !== 1) return false;

  const chunks = await chatbotKnowledgeChunks();
  await chunks.deleteMany({ ownerId, chatbotId, sourceId });
  return true;
}

/** Total indexed chunks for a chatbot — a quick "knowledge size" read. */
export async function countChunks(
  ownerId: string,
  chatbotId: string,
): Promise<number> {
  const chunks = await chatbotKnowledgeChunks();
  return chunks.countDocuments({ ownerId, chatbotId });
}
