import { describe, expect, it } from "vitest";
import {
  FOLLOWUP_TEMPLATE_KEYS,
  FOLLOWUP_TEMPLATE_SEEDS,
  SEQUENCE_SEEDS,
} from "@/lib/email/templates/followups";
import { OUTREACH_VARIABLES } from "@/lib/email/templates/outreach";
import { extractVariables, renderEmail } from "@/lib/email/template";
import type { EmailBlock } from "@/lib/server/db/types";

const DECLARED = new Set(OUTREACH_VARIABLES.map((entry) => entry.name));

function templateText(blocks: EmailBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "p":
        case "h2":
        case "signature":
          return block.text;
        case "ul":
          return block.items.join(" ");
        case "cta":
          return `${block.label} ${block.url}`;
      }
    })
    .join(" ");
}

function wordCount(blocks: EmailBlock[]): number {
  return templateText(blocks)
    .replace(/\{\{[^}]+\}\}/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

describe("follow-up copy rules", () => {
  it("has two follow-ups with unique keys", () => {
    expect(FOLLOWUP_TEMPLATE_SEEDS).toHaveLength(2);
    expect(new Set(FOLLOWUP_TEMPLATE_KEYS).size).toBe(2);
    for (const key of FOLLOWUP_TEMPLATE_KEYS) {
      expect(key.startsWith("followup."), key).toBe(true);
    }
  });

  it("keeps every follow-up shorter than a first-contact email", () => {
    // A long follow-up to someone who did not answer the short one is pressure,
    // not persuasion.
    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      expect(wordCount(seed.blocks), seed.key).toBeLessThanOrEqual(70);
    }
  });

  it("uses no guilt or false-continuity phrasing", () => {
    // All of these imply an obligation the recipient never took on.
    const banned = [
      /you (did ?n[o']t|have ?n[o']t) (reply|replied|respond)/i,
      /just (circling back|following up|checking in)/i,
      /did you (see|get|receive) my/i,
      /bumping this/i,
      /in case you missed/i,
      /as promised/i,
      /per my last email/i,
    ];
    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      const text = `${seed.subject} ${templateText(seed.blocks)}`;
      for (const pattern of banned) {
        expect(pattern.test(text), `${seed.key} :: ${pattern}`).toBe(false);
      }
    }
  });

  it("makes no numeric or currency claims", () => {
    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      const text = `${seed.subject} ${templateText(seed.blocks)}`;
      expect(text, seed.key).not.toMatch(/\d+\s?%/);
      expect(text, seed.key).not.toMatch(/[$£€₹]\s?\d/);
    }
  });

  it("offers the exit in every follow-up", () => {
    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      expect(templateText(seed.blocks), seed.key).toContain(
        "{{unsubscribeUrl}}",
      );
    }
  });

  it("states plainly that the final message is the last", () => {
    // Both true and the most effective line in the sequence.
    const final = FOLLOWUP_TEMPLATE_SEEDS.find(
      (seed) => seed.key === "followup.final",
    )!;
    const text = templateText(final.blocks).toLowerCase();
    expect(text).toContain("last email");
    expect(text).toContain("no follow-up after this");
  });

  it("uses only declared variables", () => {
    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      for (const name of extractVariables(
        seed.subject,
        templateText(seed.blocks),
      )) {
        expect(DECLARED.has(name), `${seed.key} uses {{${name}}}`).toBe(true);
      }
    }
  });

  it("renders with nothing left unresolved", () => {
    const variables = Object.fromEntries(
      OUTREACH_VARIABLES.map((entry) => [entry.name, entry.example]),
    );

    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      const rendered = renderEmail({
        subject: seed.subject,
        blocks: seed.blocks,
        variables,
        shell: {
          postalAddress: "1 Example Road",
          unsubscribeUrl: String(variables.unsubscribeUrl),
        },
      });
      expect(rendered.missing, seed.key).toEqual([]);
      expect(rendered.subject, seed.key).toContain("Café Rossi");
      expect(rendered.text.length, seed.key).toBeGreaterThan(60);
    }
  });

  it("points every follow-up at the same report rather than restating the finding", () => {
    for (const seed of FOLLOWUP_TEMPLATE_SEEDS) {
      const ctas = seed.blocks.filter((block) => block.type === "cta");
      expect(ctas, seed.key).toHaveLength(1);
      if (ctas[0]?.type === "cta") {
        expect(ctas[0].url, seed.key).toBe("{{reportUrl}}");
      }
    }
  });
});

describe("default sequence shape", () => {
  const sequence = SEQUENCE_SEEDS[0]!;

  it("is three steps: first contact, a nudge, then a final note", () => {
    expect(SEQUENCE_SEEDS).toHaveLength(1);
    expect(sequence.steps).toHaveLength(3);
    // Step one is resolved per recipient from their classification tag.
    expect(sequence.steps[0]!.templateKey).toBeNull();
    expect(sequence.steps[1]!.templateKey).toBe("followup.nudge");
    expect(sequence.steps[2]!.templateKey).toBe("followup.final");
  });

  it("sends the first email immediately and then leaves real gaps", () => {
    expect(sequence.steps[0]!.delayHours).toBe(0);
    // At least three days between touches; a tighter cadence reads as pestering.
    expect(sequence.steps[1]!.delayHours).toBeGreaterThanOrEqual(72);
    expect(sequence.steps[2]!.delayHours).toBeGreaterThanOrEqual(72);
  });

  it("finishes within about a fortnight", () => {
    const total = sequence.steps.reduce(
      (sum, step) => sum + step.delayHours,
      0,
    );
    expect(total).toBeLessThanOrEqual(24 * 21);
  });

  it("stops on a click by default", () => {
    // A click is the most common precursor to a reply, and replies cannot be
    // detected without IMAP — so this is the main automatic hand-off to a human.
    expect(sequence.stopOnClick).toBe(true);
  });

  it("references only follow-up templates that exist", () => {
    for (const step of sequence.steps) {
      if (!step.templateKey) continue;
      expect(FOLLOWUP_TEMPLATE_KEYS, step.templateKey).toContain(
        step.templateKey,
      );
    }
  });
});
