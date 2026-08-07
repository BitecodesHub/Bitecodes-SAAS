/**
 * Retrieval scoring for grounding chatbot answers.
 *
 * Pure and dependency-free so it is exhaustively unit-testable and runs
 * anywhere. Scoring is deterministic term overlap with an inverse-document-
 * frequency weight, which is a genuine (if unglamorous) information-retrieval
 * baseline:
 *
 *   - A term appearing in *few* chunks is a strong signal, so it is weighted
 *     highly. A term in every chunk carries almost none and is damped. This is
 *     what stops a common word like "the" or "service" from dominating.
 *   - Repeated occurrences within a chunk help, but sub-linearly, so one chunk
 *     that merely repeats a keyword cannot outrank a chunk that matches more of
 *     the question.
 *
 * Deliberately not embeddings. Embeddings would rank semantic paraphrase better,
 * but they need a vector index and an embedding call per query; this needs
 * neither, is instant, and is honest about what it does. `scoreChunks` is the
 * seam an embedding ranker would replace later, without touching the gateway.
 */

/** Words carrying little retrieval signal. Kept short on purpose. */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "do",
  "does",
  "did",
  "doing",
  "have",
  "has",
  "had",
  "having",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "about",
  "from",
  "as",
  "into",
  "can",
  "could",
  "will",
  "would",
  "should",
  "may",
  "might",
  "must",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "there",
  "here",
  "not",
  "no",
  "yes",
  "so",
  "up",
  "out",
  "down",
  "off",
  "over",
  "under",
  "again",
  "please",
  "tell",
]);

/**
 * Reduces a word to a crude singular stem.
 *
 * Plural mismatch is the failure that actually bites in practice: a visitor asks
 * about your "refund policy" while the knowledge base says "Refunds are
 * available", and an exact matcher finds nothing. Only plurals are folded —
 * `-ing` and `-ed` stripping needs consonant-doubling rules to avoid mangling
 * words ("shipping" → "shipp"), and the precision lost is not worth the recall
 * gained at this scale.
 */
export function stem(word: string): string {
  if (word.length < 4) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`; // policies → policy
  if (word.endsWith("sses")) return word.slice(0, -2); // classes → class
  if (/(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2); // boxes → box
  // Plain plural, but never for words that merely end in a double s or in "us"
  // ("business", "status"), which are not plurals at all.
  if (word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Lowercases, strips punctuation, drops stop words and 1-character tokens, then
 * stems. Query and chunk text go through the identical path, so both sides of a
 * comparison are normalised the same way.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);
}

export interface RetrievableChunk {
  text: string;
  meta?: { title?: string | null; url?: string | null };
}

export interface ScoredChunk<T extends RetrievableChunk> {
  chunk: T;
  score: number;
  /** Question terms this chunk actually matched, for debugging and citations. */
  matched: string[];
}

/**
 * Ranks chunks against a question, best first. Chunks matching nothing are
 * dropped rather than returned with a zero score, so a caller can distinguish
 * "no relevant knowledge" from "weakly relevant knowledge" and answer honestly.
 */
export function scoreChunks<T extends RetrievableChunk>(
  question: string,
  chunks: readonly T[],
  limit = 5,
): ScoredChunk<T>[] {
  const terms = [...new Set(tokenize(question))];
  if (terms.length === 0 || chunks.length === 0) return [];

  // Pre-tokenise once; scoring is O(chunks x terms) and this keeps it cheap.
  const tokenised = chunks.map((chunk) => {
    const counts = new Map<string, number>();
    for (const word of tokenize(chunk.text)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return { chunk, counts };
  });

  // Document frequency per question term, for the IDF weight.
  const documentFrequency = new Map<string, number>();
  for (const term of terms) {
    let seen = 0;
    for (const entry of tokenised) if (entry.counts.has(term)) seen += 1;
    documentFrequency.set(term, seen);
  }

  const total = chunks.length;
  const scored: ScoredChunk<T>[] = [];

  for (const entry of tokenised) {
    let score = 0;
    const matched: string[] = [];

    for (const term of terms) {
      const occurrences = entry.counts.get(term);
      if (!occurrences) continue;
      matched.push(term);

      const frequency = documentFrequency.get(term) ?? 1;
      // Smoothed IDF: always positive, even for a term present in every chunk.
      const idf = Math.log(1 + total / frequency);
      // Sub-linear term frequency, so repetition cannot dominate coverage.
      score += idf * (1 + Math.log(occurrences));
    }

    if (score > 0) {
      // Reward covering more of the question, not just matching one rare word.
      score *= 1 + matched.length / terms.length;
      scored.push({ chunk: entry.chunk, score, matched });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit));
}

/**
 * Assembles ranked chunks into a context block, stopping before `maxChars` so
 * the prompt cannot exceed the model's window. Each block is labelled with its
 * source so the model can cite it and the operator can see what was used.
 */
export function buildContext<T extends RetrievableChunk>(
  ranked: readonly ScoredChunk<T>[],
  maxChars = 6_000,
): { context: string; used: number; sources: string[] } {
  const parts: string[] = [];
  const sources: string[] = [];
  let length = 0;
  let used = 0;

  for (const { chunk } of ranked) {
    const label = chunk.meta?.title || chunk.meta?.url || `Source ${used + 1}`;
    const block = `[${label}]\n${chunk.text}`;
    if (length + block.length > maxChars) break;
    parts.push(block);
    length += block.length;
    used += 1;
    const source = chunk.meta?.url || chunk.meta?.title;
    if (source && !sources.includes(source)) sources.push(source);
  }

  return { context: parts.join("\n\n---\n\n"), used, sources };
}
