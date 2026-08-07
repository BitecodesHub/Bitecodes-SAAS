import { describe, expect, it } from "vitest";
import {
  buildContext,
  coverage,
  filterRelevant,
  scoreChunks,
  stem,
  tokenize,
} from "@/lib/chatbot/retrieval";

describe("tokenize", () => {
  it("lowercases, strips punctuation, drops stop words, and stems plurals", () => {
    expect(tokenize("What are the Refund policies?!")).toEqual([
      "refund",
      "policy",
    ]);
  });

  it("drops single characters and returns nothing for a stop-word-only query", () => {
    expect(tokenize("a b c")).toEqual([]);
    expect(tokenize("what is the")).toEqual([]);
  });
});

describe("stem", () => {
  it("folds the plural forms that cause missed matches", () => {
    expect(stem("refunds")).toBe("refund");
    expect(stem("policies")).toBe("policy");
    expect(stem("boxes")).toBe("box");
    expect(stem("classes")).toBe("class");
  });

  it("leaves non-plurals alone", () => {
    // These end in "s" but are singular; stripping it would break matching.
    expect(stem("business")).toBe("business");
    expect(stem("status")).toBe("status");
    expect(stem("analysis")).toBe("analysis");
    expect(stem("api")).toBe("api");
  });

  it("makes a singular query match plural knowledge", () => {
    expect(stem("refund")).toBe(stem("refunds"));
  });
});

describe("scoreChunks", () => {
  const chunks = [
    { text: "Refunds are available within 30 days of purchase." },
    { text: "Our office is in Ahmedabad and opens at 10am." },
    { text: "Shipping is free on orders over 500 rupees." },
  ];

  it("ranks the chunk that actually answers the question first", () => {
    const ranked = scoreChunks("what is your refund policy", chunks);
    expect(ranked[0].chunk.text).toContain("Refunds");
  });

  it("drops chunks that match nothing, rather than scoring them zero", () => {
    const ranked = scoreChunks("refund", chunks);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].matched).toEqual(["refund"]);
  });

  it("returns nothing when the question has no searchable terms", () => {
    expect(scoreChunks("what is the", chunks)).toEqual([]);
    expect(scoreChunks("refund", [])).toEqual([]);
  });

  it("prefers broader question coverage over one repeated term", () => {
    const candidates = [
      // Repeats one term many times.
      { text: "shipping shipping shipping shipping shipping" },
      // Matches both terms once.
      { text: "shipping costs and refund terms are listed here" },
    ];
    const ranked = scoreChunks("shipping refund", candidates);
    expect(ranked[0].chunk.text).toContain("refund");
  });

  it("damps a term that appears in every chunk", () => {
    const everywhere = [
      { text: "service details alpha" },
      { text: "service details beta" },
      { text: "service details gamma unique-token" },
    ];
    // "service" is in all three and carries little signal; "unique-token" is
    // rare and should decide the ranking.
    const ranked = scoreChunks("service unique-token", everywhere);
    expect(ranked[0].chunk.text).toContain("unique-token");
  });

  it("honours the limit", () => {
    expect(scoreChunks("refund shipping office", chunks, 2)).toHaveLength(2);
  });
});

describe("buildContext", () => {
  it("labels each block and collects sources", () => {
    const ranked = scoreChunks("refund", [
      {
        text: "Refunds within 30 days.",
        meta: { title: "Policy", url: "https://example.com/policy" },
      },
    ]);
    const { context, used, sources } = buildContext(ranked);
    expect(used).toBe(1);
    expect(context).toContain("[Policy]");
    expect(context).toContain("Refunds within 30 days.");
    expect(sources).toEqual(["https://example.com/policy"]);
  });

  it("stops before exceeding the character budget", () => {
    const big = Array.from({ length: 10 }, (_, i) => ({
      text: `refund ${"x".repeat(500)} ${i}`,
    }));
    const { context, used } = buildContext(
      scoreChunks("refund", big, 10),
      1_200,
    );
    expect(used).toBeLessThan(10);
    expect(context.length).toBeLessThanOrEqual(1_200);
  });

  it("returns an empty context for no ranked chunks", () => {
    expect(buildContext([])).toEqual({
      context: "",
      used: 0,
      sources: [],
      // `included` is what the caller measures grounding over.
      included: [],
    });
  });
});

describe("filterRelevant", () => {
  const entry = (score: number, title: string) => ({
    chunk: { text: title, meta: { title, url: null } },
    score,
    matched: ["x"],
  });

  it("keeps strong matches and drops trailing ones", () => {
    const kept = filterRelevant([
      entry(10, "bullseye"),
      entry(6, "close"),
      entry(1, "incidental"),
    ]);
    expect(kept.map((k) => k.chunk.meta.title)).toEqual(["bullseye", "close"]);
  });

  it("keeps everything when all matches are comparable", () => {
    expect(filterRelevant([entry(10, "a"), entry(9, "b")])).toHaveLength(2);
  });

  it("handles an empty ranking", () => {
    expect(filterRelevant([])).toEqual([]);
  });
});

describe("coverage", () => {
  const chunks = [
    { text: "Refunds are available within 30 days of purchase." },
    { text: "Bitecodes sells an embeddable AI chatbot for websites." },
  ];

  it("is high when the retrieved set accounts for the question", () => {
    const ranked = scoreChunks("What is your refund policy?", chunks);
    // "refund" and "policy" -> "refund" matches; the question is largely covered.
    expect(coverage("What is your refund policy?", ranked)).toBeGreaterThan(
      0.4,
    );
  });

  it("is low when only an incidental word matched", () => {
    // The live bug: "sell" matches, motorcycles are nowhere in the knowledge.
    const ranked = scoreChunks("Do you sell used motorcycles?", chunks);
    expect(coverage("Do you sell used motorcycles?", ranked)).toBeLessThan(0.5);
  });

  it("is zero for no ranking and for a question of only stop words", () => {
    expect(coverage("anything", [])).toBe(0);
    expect(coverage("is it the a", scoreChunks("is it the a", chunks))).toBe(0);
  });
});

describe("buildContext budget handling", () => {
  const entry = (text: string, title: string) => ({
    chunk: { text, meta: { title, url: null } },
    score: 1,
    matched: ["x"],
  });

  it("skips an oversized block instead of discarding the tail", () => {
    // A `break` here dropped every lower-ranked chunk behind one long one, even
    // ones that still fitted. On a large corpus that silently truncated the tail.
    const result = buildContext(
      [
        entry("a".repeat(60), "small-first"),
        entry("b".repeat(500), "too-big"),
        entry("c".repeat(40), "small-last"),
      ],
      200,
    );
    expect(result.sources).toContain("small-first");
    expect(result.sources).toContain("small-last");
    expect(result.sources).not.toContain("too-big");
  });

  it("counts the separator, so the context cannot exceed the budget", () => {
    // Twelve blocks summing to just under the cap produced a context OVER it,
    // because the 7-character joiner between them was never charged.
    const blocks = Array.from({ length: 12 }, (_, i) =>
      entry("x".repeat(90), `t${i}`),
    );
    const result = buildContext(blocks, 1_200);
    expect(result.context.length).toBeLessThanOrEqual(1_200);
  });

  it("reports which entries it actually included", () => {
    const result = buildContext(
      [entry("a".repeat(50), "kept"), entry("b".repeat(5_000), "dropped")],
      200,
    );
    // The caller needs this to measure grounding over what was really sent.
    expect(result.included).toHaveLength(1);
    expect(result.included[0]!.chunk.meta.title).toBe("kept");
    expect(result.used).toBe(1);
  });
});

describe("title indexing", () => {
  it("credits a chunk for the words in its own title", () => {
    // "Pricing: websites and applications" earned nothing for "pricing" — the
    // densest, most topical line it has, and the one used as its citation label.
    const chunks = [
      {
        text: "Website development starts from $500 per project.",
        meta: { title: "Pricing: websites and applications", url: null },
      },
      {
        text: "We are a studio in Ahmedabad building software.",
        meta: { title: "About us", url: null },
      },
    ];
    const ranked = scoreChunks("what is your pricing?", chunks);
    expect(ranked[0]!.chunk.meta.title).toBe(
      "Pricing: websites and applications",
    );
  });
});
