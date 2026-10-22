import { describe, expect, it } from "vitest";
import {
  aiVisibilityEmailSchema,
  aiVisibilityInputSchema,
  crawlerRule,
  extractHead,
  extractStructuredData,
  gradeFor,
  parseRobots,
  scoreAiVisibility,
  sumScore,
  type AiVisibilityCheck,
} from "@/lib/ai-visibility";

const goodHtml = `<!doctype html>
<html lang="en">
<head>
  <title>A clear, useful page title</title>
  <meta name="description" content="${"A".repeat(80)}" />
  <link rel="canonical" href="https://example.com/" />
  <meta property="og:title" content="Example" />
  <meta property="og:description" content="Example description" />
  <meta property="og:image" content="https://example.com/og.png" />
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Example"},{"@type":"FAQPage"}]}</script>
</head>
<body><h1>Example</h1><h2>One</h2><h2>Two</h2><h2>Three</h2></body>
</html>`;

const emptyRobots = { checked: true, status: 404, body: "" };
const presentLlms = {
  checked: true,
  status: 200,
  body: "# Example\n\nA factual summary.",
};

describe("AI visibility input", () => {
  it("accepts a URL and rejects unknown fields", () => {
    expect(
      aiVisibilityInputSchema.safeParse({ url: "example.com" }).success,
    ).toBe(true);
    expect(
      aiVisibilityInputSchema.safeParse({ url: "example.com", deep: true })
        .success,
    ).toBe(false);
  });

  it("validates the report email payload and rejects client-supplied scores", () => {
    expect(
      aiVisibilityEmailSchema.safeParse({
        email: "buyer@example.com",
        url: "https://example.com",
        followUp: true,
      }).success,
    ).toBe(true);
    expect(
      aiVisibilityEmailSchema.safeParse({
        email: "buyer@example.com",
        url: "https://example.com",
        score: 100,
      }).success,
    ).toBe(false);
    expect(
      aiVisibilityEmailSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });
});

describe("robots.txt", () => {
  it("allows a crawler when no rules apply", () => {
    expect(crawlerRule("GPTBot", []).allowed).toBe(true);
  });

  it("honours an exact user-agent group over the wildcard", () => {
    const groups = parseRobots(`
      User-agent: *
      Disallow: /
      User-agent: GPTBot
      Allow: /
    `);
    expect(crawlerRule("GPTBot", groups).allowed).toBe(true);
    expect(crawlerRule("ClaudeBot", groups).allowed).toBe(false);
  });

  it("blocks a crawler named in a wildcard group", () => {
    const groups = parseRobots("User-agent: *\nDisallow: /");
    expect(crawlerRule("PerplexityBot", groups)).toEqual({
      allowed: false,
      reason: "Disallow: /",
    });
  });

  it("does not treat a path-specific rule as a full block", () => {
    const groups = parseRobots("User-agent: GPTBot\nDisallow: /admin");
    expect(crawlerRule("GPTBot", groups).allowed).toBe(true);
  });
});

describe("extraction", () => {
  it("reads title, metadata, canonical, and heading counts", () => {
    const head = extractHead(goodHtml);
    expect(head.title).toBe("A clear, useful page title");
    expect(head.description).toHaveLength(80);
    expect(head.canonical).toBe("https://example.com/");
    expect(head.h1Count).toBe(1);
    expect(head.h2Count).toBe(3);
    expect(head.ogImage).toBe("https://example.com/og.png");
  });

  it("finds JSON-LD types including @graph entries", () => {
    const data = extractStructuredData(goodHtml);
    expect(data.blocks).toBe(1);
    expect(data.invalid).toBe(0);
    expect(data.types).toEqual(["Organization", "FAQPage"]);
  });

  it("counts malformed JSON-LD without throwing", () => {
    const data = extractStructuredData(
      '<script type="application/ld+json">{not json}</script>',
    );
    expect(data).toEqual({ scripts: 1, invalid: 1, blocks: 0, types: [] });
  });
});

describe("scoring", () => {
  it("scores a fully visible page at 100", () => {
    const result = scoreAiVisibility({
      html: goodHtml,
      finalUrl: "https://example.com/",
      robots: emptyRobots,
      llmsTxt: presentLlms,
    });
    expect(result.score).toBe(100);
    expect(result.grade).toBe("strong");
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
    expect(result.priorityFixes).toEqual([]);
  });

  it("penalises blocked crawlers, missing llms.txt, and a noindex page", () => {
    const result = scoreAiVisibility({
      html: goodHtml.replace(
        "</head>",
        '<meta name="robots" content="noindex" /></head>',
      ),
      finalUrl: "https://example.com/",
      robots: {
        checked: true,
        status: 200,
        body: "User-agent: *\nDisallow: /",
      },
      llmsTxt: { checked: true, status: 404, body: "" },
    });
    expect(result.score).toBeLessThan(80);
    expect(result.checks.find((c) => c.id === "crawlerAccess")?.status).toBe(
      "fail",
    );
    expect(result.checks.find((c) => c.id === "llmsTxt")?.earned).toBe(0);
    expect(result.priorityFixes.length).toBe(2);
  });

  it("warns rather than guessing when robots.txt cannot be checked", () => {
    const result = scoreAiVisibility({
      html: goodHtml,
      finalUrl: "https://example.com/",
      robots: { checked: false, status: 403, body: "" },
      llmsTxt: presentLlms,
    });
    const check = result.checks.find((c) => c.id === "crawlerAccess");
    expect(check?.status).toBe("warning");
    expect(check?.earned).toBe(15);
  });

  it("fails HTTPS separately from metadata", () => {
    const result = scoreAiVisibility({
      html: goodHtml,
      finalUrl: "http://example.com/",
      robots: emptyRobots,
      llmsTxt: presentLlms,
    });
    expect(result.checks.find((c) => c.id === "https")?.earned).toBe(0);
    expect(result.score).toBe(90);
  });

  it("never exceeds the 100 point ceiling", () => {
    const checks: AiVisibilityCheck[] = [
      {
        id: "crawlerAccess",
        label: "x",
        status: "pass",
        earned: 90,
        max: 25,
        detail: "",
        recommendation: "",
      },
    ];
    expect(sumScore(checks)).toBe(90);
    expect(gradeFor(100)).toBe("strong");
    expect(gradeFor(70)).toBe("fair");
    expect(gradeFor(20)).toBe("weak");
  });
});
