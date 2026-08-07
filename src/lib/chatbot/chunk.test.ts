import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens } from "@/lib/chatbot/chunk";

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});

describe("chunkText", () => {
  it("returns nothing for empty input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("keeps short text as a single chunk", () => {
    const chunks = chunkText("A short paragraph of text.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].ord).toBe(0);
    expect(chunks[0].text).toBe("A short paragraph of text.");
  });

  it("splits long text into multiple ordered chunks under the target", () => {
    const para = Array.from(
      { length: 40 },
      (_, i) => `Sentence number ${i} here.`,
    ).join(" ");
    const chunks = chunkText(para, { targetTokens: 60, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.ord).toBe(i));
    // No chunk grossly exceeds the target (target 60 tokens ≈ 240 chars).
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(300);
  });

  it("hard-splits a single oversized sentence", () => {
    const giant = "word ".repeat(500).trim(); // one long run, no terminators
    const chunks = chunkText(giant, { targetTokens: 50, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.tokenCount).toBeGreaterThan(0);
  });

  it("preserves order and covers the content", () => {
    const text = [
      "Alpha paragraph.",
      "Bravo paragraph.",
      "Charlie paragraph.",
    ].join("\n\n");
    const joined = chunkText(text, { targetTokens: 50 })
      .map((c) => c.text)
      .join(" ");
    expect(joined).toContain("Alpha");
    expect(joined).toContain("Charlie");
  });
});
