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
 * Removes identifiers and repairs grouped numbers before tokenizing.
 *
 * Both halves fix measured failures on the live knowledge base.
 *
 * **Identifiers are not prose.** An email address and a URL containing the
 * company name each contributed another instance of that name. The contact chunk
 * yielded `bitecode` three times — once as the actual word, once from
 * `bitecodes.global@gmail.com`, once from `https://www.bitecodes.com` — against
 * one for every other chunk. So the contact block outranked everything for any
 * question that named the company, which is every question a company's own
 * chatbot receives. It won "how much is a website?" ahead of the page listing the
 * prices. Stripping them also removes the junk tokens `http`, `www`, `com`,
 * `gmail` and the raw phone digits, none of which are anything a visitor asks
 * about.
 *
 * **Digit groups must survive.** Stripping punctuation turned `$1,600` into
 * `600`, `$2,000` and `$5,000` both into `000`, and `$1,200` into `200`: the
 * leading digit was dropped as a 1-character token and the remainder kept. Prices
 * were unmatchable and several collided on the same meaningless token. Joining
 * digits across a separator first makes `1600` a real, searchable term, so
 * "is a web app around 1600?" now finds the pricing chunk instead of nothing.
 */
export function normalizeForIndex(text: string): string {
  return (
    text
      // Order matters: emails before URLs, because an address can contain a host.
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ")
      .replace(/\bhttps?:\/\/\S+/gi, " ")
      .replace(/\bwww\.\S+/gi, " ")
      // 1,600 -> 1600. Applied repeatedly so 1,234,567 collapses fully.
      .replace(/(\d)[,  ](?=\d{3}\b)/g, "$1")
      .replace(/(\d)[,  ](?=\d{3}\b)/g, "$1")
  );
}

/**
 * Lowercases, strips punctuation, drops stop words and 1-character tokens, then
 * stems. Query and chunk text go through the identical path, so both sides of a
 * comparison are normalised the same way.
 */
export function tokenize(text: string): string[] {
  return normalizeForIndex(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map(stem);
}

/**
 * Words that carry an intent no wording in the knowledge base will share.
 *
 * "How much is a website?" has **no word in common** with "Website development
 * starts from $500". Term overlap cannot bridge that by construction, and it is
 * why the compound question failed even after the tokenizer was fixed: the
 * pricing intent lived entirely in the word "much", which appears in no chunk.
 *
 * Expansion is applied to the QUESTION only, never to stored text, so a chunk
 * cannot be made to look relevant by rewriting the index. It is also only safe
 * because selection now fills a character budget rather than taking a fixed
 * top-N: measured, adding these synonyms under a top-4 cut pushed pricing chunks
 * up so hard that the contact chunk dropped out of "how do I contact you and what
 * do you charge hourly?" — trading one lost topic for another. With nothing being
 * displaced, expansion can only add recall.
 *
 * Deliberately small and domain-neutral. This is not a thesaurus; every entry is
 * a way people ask what something costs, plus the words a price list actually
 * uses. A real synonym dictionary belongs in an embedding model, not here.
 */
const QUESTION_INTENT_SYNONYMS: Record<string, readonly string[]> = {
  much: ["price", "cost", "start", "from", "fee"],
  cost: ["price", "start", "from", "fee"],
  price: ["cost", "start", "from", "fee"],
  pricing: ["price", "cost", "start"],
  charge: ["price", "cost", "start", "fee"],
  fee: ["price", "cost", "charge"],
  rate: ["price", "cost", "hourly", "hour"],
  quote: ["price", "cost", "scope"],
  budget: ["price", "cost"],
  expensive: ["price", "cost"],
  cheap: ["price", "cost"],
  afford: ["price", "cost"],
  reach: ["contact", "email", "phone"],
  phone: ["contact", "whatsapp"],
  call: ["contact", "phone", "whatsapp"],
  email: ["contact"],
};

/**
 * The question's own terms plus intent synonyms, for matching only.
 *
 * `coverage()` deliberately still measures against the unexpanded question, so a
 * synonym can improve what the model is given without inflating the confidence we
 * report to the operator.
 */
export function expandQuestionTerms(terms: readonly string[]): string[] {
  const out = new Set(terms);
  for (const term of terms) {
    for (const synonym of QUESTION_INTENT_SYNONYMS[term] ?? []) {
      out.add(stem(synonym));
    }
  }
  return [...out];
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
  const asked = [...new Set(tokenize(question))];
  const terms = expandQuestionTerms(asked);
  if (terms.length === 0 || chunks.length === 0) return [];

  // Pre-tokenise once; scoring is O(chunks x terms) and this keeps it cheap.
  //
  // The TITLE is indexed alongside the body, which it previously was not. The
  // chunk titled "Pricing: websites and applications" earned nothing for the
  // words "pricing" or "website" in its own heading — the densest and most
  // topical line it has, and the very line already used as its citation label. A
  // visitor asking "what is your pricing?" scored that chunk zero on "pricing"
  // unless the body happened to repeat the word.
  const tokenised = chunks.map((chunk) => {
    const counts = new Map<string, number>();
    const title = chunk.meta?.title ?? "";
    for (const word of tokenize(
      title ? `${title} ${chunk.text}` : chunk.text,
    )) {
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
 * Drops chunks that only trail the best match.
 *
 * `scoreChunks` returns anything with a non-zero score, which is right for
 * ranking but wrong for citation: a question like "what does Bitecodes do" also
 * weakly matches every page that happens to mention the company, and listing
 * those as sources tells the visitor the answer came from documents it did not.
 * Keeping chunks within `minRatio` of the top score is a relative cut, so it
 * adapts to how strong the best match actually was.
 */
export function filterRelevant<T extends RetrievableChunk>(
  ranked: readonly ScoredChunk<T>[],
  minRatio = 0.4,
): ScoredChunk<T>[] {
  if (ranked.length === 0) return [];
  const best = ranked[0].score;
  return ranked.filter((entry) => entry.score >= best * minRatio);
}

/**
 * Everything worth giving the model, in rank order, bounded by the context budget.
 *
 * This replaces "rank, then take the top four". That count was arbitrary and it
 * was the direct cause of a production failure: asked "What does Bitecodes do, and
 * how much is a website?", the four highest-scoring chunks were all about what the
 * company does, the pricing chunk placed fifth, and the assistant told a visitor
 * "we do not have a fixed price for a website" while holding a price list. A single
 * global ranking cannot represent a question with two subjects — it returns the
 * stronger subject repeatedly and silently discards the weaker one.
 *
 * The budget is the honest constraint. This whole knowledge base is 3,206
 * characters; the budget is 6,000. There was never a reason to withhold half of it.
 * Passing everything that matched fixed all six of the measured failing questions
 * with no threshold to tune, and it degrades the right way: only once a knowledge
 * base genuinely exceeds the budget does rank decide what fits, which is precisely
 * when ranking should matter.
 *
 * `maxChunks` is a backstop against a pathological corpus of thousands of tiny
 * chunks, not a relevance decision.
 */
export function selectForContext<T extends RetrievableChunk>(
  question: string,
  chunks: readonly T[],
  options: { maxChars?: number; maxChunks?: number } = {},
): ScoredChunk<T>[] {
  const { maxChars = 6_000, maxChunks = 24 } = options;

  // No limit on the ranking itself; the budget below decides what survives.
  const ranked = scoreChunks(question, chunks, chunks.length);

  const selected: ScoredChunk<T>[] = [];
  let used = 0;
  for (const entry of ranked) {
    if (selected.length >= maxChunks) break;
    const size = entry.chunk.text.length;
    // `continue`, not `break`: one oversized chunk must not discard every
    // lower-ranked chunk that would still have fit.
    if (used + size > maxChars) continue;
    selected.push(entry);
    used += size;
  }
  return selected;
}

/**
 * How much of the question the retrieved set actually accounts for, as 0..1
 * across the union of matched terms.
 *
 * This is the honest grounding signal. "Did anything match at all" is not: a
 * visitor asking "do you sell used motorcycles?" matches the single word "sell"
 * in a sales paragraph, which previously reported the answer as grounded when
 * the knowledge base said nothing about motorcycles.
 */
export function coverage<T extends RetrievableChunk>(
  question: string,
  ranked: readonly ScoredChunk<T>[],
): number {
  const terms = new Set(tokenize(question));
  if (terms.size === 0) return 0;
  const matched = new Set<string>();
  for (const entry of ranked) {
    for (const term of entry.matched) if (terms.has(term)) matched.add(term);
  }
  return matched.size / terms.size;
}

/**
 * Assembles ranked chunks into a context block, stopping before `maxChars` so
 * the prompt cannot exceed the model's window. Each block is labelled with its
 * source so the model can cite it and the operator can see what was used.
 */
const BLOCK_SEPARATOR = "\n\n---\n\n";

export function buildContext<T extends RetrievableChunk>(
  ranked: readonly ScoredChunk<T>[],
  maxChars = 6_000,
): {
  context: string;
  used: number;
  sources: string[];
  /**
   * The entries actually included. The caller needs these, not the input list:
   * grounding must be measured over what the model was really given, or it
   * reports confidence in text that was silently dropped.
   */
  included: ScoredChunk<T>[];
} {
  const parts: string[] = [];
  const sources: string[] = [];
  const included: ScoredChunk<T>[] = [];
  let length = 0;

  for (const entry of ranked) {
    const { chunk } = entry;
    const label =
      chunk.meta?.title || chunk.meta?.url || `Source ${included.length + 1}`;
    const block = `[${label}]\n${chunk.text}`;
    // The separator counts toward the budget. Omitting it let twelve blocks
    // totalling 5,995 characters produce a 6,072-character context — a silent
    // overrun on exactly the tenant large enough to fill the window.
    const cost = block.length + (parts.length > 0 ? BLOCK_SEPARATOR.length : 0);

    // `continue`, not `break`. One oversized block used to terminate the loop and
    // discard every lower-ranked chunk behind it, including ones that would have
    // fitted in the remaining space. With a single long chunk near the top of a
    // large corpus, that silently truncated the entire tail.
    if (length + cost > maxChars) continue;

    parts.push(block);
    length += cost;
    included.push(entry);
    const source = chunk.meta?.url || chunk.meta?.title;
    if (source && !sources.includes(source)) sources.push(source);
  }

  return {
    context: parts.join(BLOCK_SEPARATOR),
    used: included.length,
    sources,
    included,
  };
}
