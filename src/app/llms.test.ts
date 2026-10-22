import { describe, expect, it } from "vitest";
import { GET } from "@/app/llms.txt/route";
import { jobOpenings } from "@/data/careers";
import { answerPages } from "@/data/answers";
import { CURRENCIES, SERVICE_PRICING, formatPrice } from "@/lib/pricing";
import { CREDIT_PACKS, formatPackPrice } from "@/lib/server/billing/packs";

const PRICE_PATTERN = /(?:A\$|₹|\$|£)\s?\d+(?:,\d{2,3})*/g;

/**
 * The machine-readable summary is quoted verbatim by answer engines, so a
 * price that does not exist in the billing or pricing source is a published
 * falsehood, not a typo.
 */
describe("/llms.txt", () => {
  const response = GET();
  const textPromise = response.text();

  it("contains no subscription or trial claims", async () => {
    const text = await textPromise;

    expect(text).not.toMatch(/\/mo\b/i);
    expect(text).not.toMatch(/free trial/i);
    expect(text).not.toMatch(/monthly plan/i);
  });

  it("quotes only prices present in the source data", async () => {
    const text = await textPromise;
    const allowed = new Set<string>();

    for (const pricing of SERVICE_PRICING) {
      for (const currency of CURRENCIES) {
        allowed.add(
          formatPrice(pricing.startingFromUSD, currency.code).replace(
            /\s/g,
            "",
          ),
        );
      }
    }
    for (const pack of CREDIT_PACKS) {
      allowed.add(formatPackPrice(pack).replace(/\s/g, ""));
    }
    for (const job of jobOpenings) {
      allowed.add(`₹${job.stipend.min.toLocaleString("en-IN")}`);
      allowed.add(`₹${job.stipend.max.toLocaleString("en-IN")}`);
    }
    // Answer pages quote market price bands ("$500–$10,000"). Those figures
    // live in answers.ts, so they are sourced data rather than an inline claim
    // added by the llms route.
    for (const answer of answerPages) {
      const corpus = [
        answer.shortAnswer,
        answer.metaDescription,
        ...answer.sections.flatMap((section) => [
          section.heading,
          ...section.paragraphs,
          ...(section.bullets ?? []),
        ]),
        ...answer.faqs.flatMap((faq) => [faq.question, faq.answer]),
      ].join(" ");
      for (const price of corpus.match(PRICE_PATTERN) ?? []) {
        allowed.add(price.replace(/\s/g, ""));
      }
    }

    const found = text.match(PRICE_PATTERN) ?? [];
    expect(found.length).toBeGreaterThan(0);

    for (const price of found) {
      expect(allowed, price).toContain(price.replace(/\s/g, ""));
    }
  });

  it("points at the guarantees and company facts", async () => {
    const text = await textPromise;

    expect(text).toContain("## Company facts");
    expect(text).toContain("/guarantees");
  });
});
