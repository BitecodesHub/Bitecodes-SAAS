/**
 * Token-aware text chunking for the knowledge base.
 *
 * Pure and dependency-free so it is fully unit-testable and runs anywhere.
 * Tokens are estimated (no tokenizer dependency) as ~4 characters each — a
 * standard, good-enough heuristic for sizing retrieval chunks. Splitting
 * prefers paragraph then sentence boundaries so a chunk rarely cuts a sentence
 * in half, and consecutive chunks overlap slightly so context that straddles a
 * boundary is not lost at retrieval time.
 */

const CHARS_PER_TOKEN = 4;

export interface Chunk {
  ord: number;
  text: string;
  tokenCount: number;
}

export interface ChunkOptions {
  /** Target chunk size in estimated tokens. */
  targetTokens?: number;
  /** Overlap between consecutive chunks, in estimated tokens. */
  overlapTokens?: number;
}

/** Estimated token count for a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Splits into paragraphs on blank lines, trimming and dropping empties. */
function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Naive sentence split that keeps the terminator with the sentence. */
function sentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return parts ? parts.map((s) => s.trim()).filter(Boolean) : [text];
}

/**
 * Chunks text into overlapping, roughly token-sized pieces.
 *
 * A paragraph larger than the target is broken on sentence boundaries; a
 * single sentence larger than the target is hard-split by characters so no
 * chunk ever exceeds a safe multiple of the target.
 */
export function chunkText(input: string, options: ChunkOptions = {}): Chunk[] {
  const targetTokens = Math.max(50, options.targetTokens ?? 500);
  const overlapTokens = Math.max(0, options.overlapTokens ?? 75);
  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars =
    Math.min(overlapTokens, targetTokens - 1) * CHARS_PER_TOKEN;

  const text = input.trim();
  if (!text) return [];

  // Break into units no larger than the target, on paragraph→sentence→hard.
  const units: string[] = [];
  for (const para of paragraphs(text)) {
    if (para.length <= targetChars) {
      units.push(para);
      continue;
    }
    let buffer = "";
    for (const sentence of sentences(para)) {
      const piece = sentence.length > targetChars ? "" : sentence;
      if (!piece) {
        // A single oversized sentence: flush and hard-split it.
        if (buffer) {
          units.push(buffer.trim());
          buffer = "";
        }
        for (let i = 0; i < sentence.length; i += targetChars) {
          units.push(sentence.slice(i, i + targetChars).trim());
        }
        continue;
      }
      if ((buffer + " " + piece).trim().length > targetChars) {
        if (buffer) units.push(buffer.trim());
        buffer = piece;
      } else {
        buffer = (buffer + " " + piece).trim();
      }
    }
    if (buffer) units.push(buffer.trim());
  }

  // Pack units into chunks up to the target, then add tail overlap.
  const chunks: Chunk[] = [];
  let current = "";
  const flush = () => {
    const trimmed = current.trim();
    if (!trimmed) return;
    chunks.push({
      ord: chunks.length,
      text: trimmed,
      tokenCount: estimateTokens(trimmed),
    });
    // Carry the tail of this chunk into the next for overlap.
    current = overlapChars > 0 ? trimmed.slice(-overlapChars) : "";
  };

  for (const unit of units) {
    if (current && (current + "\n\n" + unit).length > targetChars) {
      flush();
    }
    current = current ? `${current}\n\n${unit}` : unit;
  }
  if (current.trim()) {
    const trimmed = current.trim();
    // Avoid emitting a final chunk that is only the carried-over overlap.
    const last = chunks[chunks.length - 1];
    if (!last || !last.text.endsWith(trimmed)) {
      chunks.push({
        ord: chunks.length,
        text: trimmed,
        tokenCount: estimateTokens(trimmed),
      });
    }
  }

  return chunks;
}
