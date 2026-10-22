/**
 * Near-duplicate detection for blog titles.
 *
 * Two posts aimed at the same search intent compete with each other and
 * neither ranks. Exact topic matching is not enough: different seed topics can
 * produce near-identical titles ("what to look for" vs "how to choose"). This
 * compares the meaningful words in two titles and treats a high overlap as the
 * same intent.
 *
 * Deliberately lexical, not semantic: no model call, no cost, and the result is
 * explainable when a draft is skipped.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "but",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "should",
  "so",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "vs",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Lowercase, punctuation-free, stop-word-free word stems. */
export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
      .map(stem),
  );
}

/**
 * Jaccard overlap of meaningful words. Titles at or above the threshold are
 * treated as the same intent. 0.55 catches "what to look for in a web
 * application development partner" against "how to choose a web application
 * development partner" without flagging posts that merely share a topic word.
 */
export function titlesAreNearDuplicate(
  a: string,
  b: string,
  threshold = 0.55,
): boolean {
  const left = titleTokens(a);
  const right = titleTokens(b);
  if (left.size === 0 || right.size === 0) return false;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return intersection / union >= threshold;
}
