import { describe, expect, it } from "vitest";
import {
  OUTREACH_TEMPLATE_KEYS,
  OUTREACH_TEMPLATE_SEEDS,
  OUTREACH_VARIABLES,
  outreachTemplateForTag,
} from "@/lib/email/templates/outreach";
import { extractVariables, renderEmail } from "@/lib/email/template";
import { PROSPECT_TAG_LABELS } from "@/lib/prospecting/classify";
import type { EmailBlock, ProspectTag } from "@/lib/server/db/types";

const ALL_TAGS = Object.keys(PROSPECT_TAG_LABELS) as ProspectTag[];
const DECLARED = new Set(OUTREACH_VARIABLES.map((entry) => entry.name));

/** All interpolatable text in a template, for whole-template assertions. */
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

function bodyWordCount(blocks: EmailBlock[]): number {
  return templateText(blocks)
    .replace(/\{\{[^}]+\}\}/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

describe("coverage", () => {
  it("has exactly one template per classification tag", () => {
    // A prospect whose tag had no template would silently never be contacted.
    for (const tag of ALL_TAGS) {
      const found = OUTREACH_TEMPLATE_SEEDS.filter(
        (seed) => seed.prospectTag === tag,
      );
      expect(found, tag).toHaveLength(1);
    }
    expect(OUTREACH_TEMPLATE_SEEDS).toHaveLength(ALL_TAGS.length);
  });

  it("resolves a template for every tag by lookup", () => {
    for (const tag of ALL_TAGS) {
      expect(outreachTemplateForTag(tag)?.prospectTag, tag).toBe(tag);
    }
  });

  it("has unique keys and unique subjects", () => {
    expect(new Set(OUTREACH_TEMPLATE_KEYS).size).toBe(
      OUTREACH_TEMPLATE_KEYS.length,
    );
    const subjects = OUTREACH_TEMPLATE_SEEDS.map((seed) => seed.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it("namespaces every key under outreach", () => {
    for (const key of OUTREACH_TEMPLATE_KEYS) {
      expect(key.startsWith("outreach."), key).toBe(true);
    }
  });
});

describe("honesty rules", () => {
  it("makes no percentage or money claims", () => {
    // Invented statistics are checkable and destroy credibility on contact.
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const text = `${seed.subject} ${templateText(seed.blocks)}`;
      expect(text, seed.key).not.toMatch(/\d+\s?%/);
      expect(text, seed.key).not.toMatch(/[$£€₹]\s?\d/);
      expect(text, seed.key).not.toMatch(/\b\d+x\b/i);
    }
  });

  it("avoids fake familiarity and flattery", () => {
    // Transparently untrue in a templated email, and the recipient knows it.
    const banned = [
      /i (was |have been )?(just )?browsing your/i,
      /i love your/i,
      /big fan of/i,
      /stumbled upon/i,
      /came across your (website|site) and/i,
    ];
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const text = templateText(seed.blocks);
      for (const pattern of banned) {
        expect(pattern.test(text), `${seed.key} :: ${pattern}`).toBe(false);
      }
    }
  });

  it("avoids false-urgency and pressure language", () => {
    const banned = [
      /act now/i,
      /limited time/i,
      /last chance/i,
      /urgent(ly)? (need|require)/i,
      /guarantee/i,
      /risk[- ]free/i,
    ];
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const text = `${seed.subject} ${templateText(seed.blocks)}`;
      for (const pattern of banned) {
        expect(pattern.test(text), `${seed.key} :: ${pattern}`).toBe(false);
      }
    }
  });

  it("stays short enough to be read", () => {
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      expect(bodyWordCount(seed.blocks), seed.key).toBeLessThanOrEqual(130);
    }
  });

  it("keeps subjects short and specific to the business", () => {
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      expect(seed.subject.length, seed.key).toBeLessThanOrEqual(78);
      // A subject naming the business reads as considered rather than blasted.
      expect(seed.subject, seed.key).toContain("{{businessName}}");
    }
  });

  it("offers an easy no in every template", () => {
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const text = templateText(seed.blocks).toLowerCase();
      const hasOptOut =
        text.includes("ignore") || text.includes("unsubscribeurl");
      expect(hasOptOut, seed.key).toBe(true);
    }
  });
});

describe("structure", () => {
  it("references the unsubscribe link in the body of every template", () => {
    // The compliance footer alone reads as boilerplate and gets skipped.
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      expect(templateText(seed.blocks), seed.key).toContain(
        "{{unsubscribeUrl}}",
      );
    }
  });

  it("asks for a click on the report, not for a meeting", () => {
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const cta = seed.blocks.find((block) => block.type === "cta");
      expect(cta, seed.key).toBeDefined();
      if (cta?.type === "cta") {
        expect(cta.url, seed.key).toBe("{{reportUrl}}");
      }

      const text = templateText(seed.blocks);
      expect(text, seed.key).not.toMatch(/\b(15|20|30) minutes?\b/i);
      expect(text, seed.key).not.toMatch(/book a (call|demo)/i);
    }
  });

  it("has exactly one call to action", () => {
    // Two competing buttons reduce clicks on both.
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const ctas = seed.blocks.filter((block) => block.type === "cta");
      expect(ctas, seed.key).toHaveLength(1);
    }
  });

  it("ends with a signature", () => {
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const last = seed.blocks.at(-1);
      expect(last?.type, seed.key).toBe("signature");
    }
  });

  it("carries a name and a description for the admin editor", () => {
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      expect(seed.name.length, seed.key).toBeGreaterThan(3);
      expect(seed.description.length, seed.key).toBeGreaterThan(30);
    }
  });
});

describe("variables", () => {
  it("uses only declared variables", () => {
    // A typo such as {{buisnessName}} renders as an empty string, producing
    // "Hello — I could not find a website for ." in a stranger's inbox.
    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const used = extractVariables(seed.subject, templateText(seed.blocks));
      for (const name of used) {
        expect(DECLARED.has(name), `${seed.key} uses {{${name}}}`).toBe(true);
      }
    }
  });

  it("documents every variable with a description and example", () => {
    for (const entry of OUTREACH_VARIABLES) {
      expect(entry.description.length, entry.name).toBeGreaterThan(10);
      expect(entry.example.length, entry.name).toBeGreaterThan(0);
    }
    expect(new Set(OUTREACH_VARIABLES.map((e) => e.name)).size).toBe(
      OUTREACH_VARIABLES.length,
    );
  });

  it("renders with no variable left unresolved", () => {
    // The real test of the set: fill every declared variable and confirm the
    // renderer reports nothing missing for any template.
    const variables: Record<string, string> = {};
    for (const entry of OUTREACH_VARIABLES)
      variables[entry.name] = entry.example;

    for (const seed of OUTREACH_TEMPLATE_SEEDS) {
      const rendered = renderEmail({
        subject: seed.subject,
        blocks: seed.blocks,
        variables,
        shell: {
          postalAddress: "1 Example Road, Ahmedabad",
          unsubscribeUrl: variables.unsubscribeUrl!,
          footerNote: null,
        },
      });

      expect(rendered.missing, seed.key).toEqual([]);
      expect(rendered.subject, seed.key).toContain("Café Rossi");

      // The body must contain something specific to *this* recipient, not just
      // the subject line. Which detail is right varies: the no-website email
      // names the business, while the outage email names their domain, which is
      // more precise. Requiring `businessName` everywhere would force an
      // awkward "Hello Café Rossi" greeting into templates that read better
      // without one.
      const personalised = ["Café Rossi", "rossi.example.com", "Ahmedabad"];
      for (const rendering of [rendered.html, rendered.text]) {
        expect(
          personalised.some((detail) => rendering.includes(detail)),
          `${seed.key} body has no recipient-specific detail`,
        ).toBe(true);
      }

      // A plain-text alternative is required for deliverability.
      expect(rendered.text.length, seed.key).toBeGreaterThan(80);
    }
  });

  it("escapes a hostile business name rather than emitting markup", () => {
    const variables: Record<string, string> = {};
    for (const entry of OUTREACH_VARIABLES)
      variables[entry.name] = entry.example;
    // Business names come from OpenStreetMap, which anyone can edit.
    variables.businessName = "<script>alert(1)</script>";

    const seed = outreachTemplateForTag("no-website")!;
    const rendered = renderEmail({
      subject: seed.subject,
      blocks: seed.blocks,
      variables,
      shell: {
        postalAddress: "1 Example Road",
        unsubscribeUrl: variables.unsubscribeUrl!,
        footerNote: null,
      },
    });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });
});
