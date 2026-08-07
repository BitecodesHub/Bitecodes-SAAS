import { describe, expect, it } from "vitest";
import { extractJsonPayload } from "@/lib/server/ai-provider";

/**
 * These cases are all shapes actually returned by `integrate.api.nvidia.com`,
 * not hypotheticals. The reason they exist: production had `AI_MODEL` pointed at
 * a reasoning model, which returns an empty `content`, and the previous strict
 * parse turned that into a hard failure for every JSON-producing feature.
 */
describe("extractJsonPayload", () => {
  it("parses a clean JSON content field", () => {
    expect(
      extractJsonPayload({ message: { content: '{"title":"Hello"}' } }),
    ).toEqual({ title: "Hello" });
  });

  it("falls back to reasoning_content when a reasoning model leaves content empty", () => {
    // The failure that broke live: content is "", the answer is in the
    // reasoning channel.
    expect(
      extractJsonPayload({
        message: {
          content: "",
          reasoning_content: '{"title":"From reasoning"}',
        },
      }),
    ).toEqual({ title: "From reasoning" });
  });

  it("prefers content over reasoning_content when both are present", () => {
    expect(
      extractJsonPayload({
        message: {
          content: '{"pick":"content"}',
          reasoning_content: '{"pick":"reasoning"}',
        },
      }),
    ).toEqual({ pick: "content" });
  });

  it("unwraps a fenced code block", () => {
    expect(
      extractJsonPayload({
        message: { content: '```json\n{"title":"Fenced"}\n```' },
      }),
    ).toEqual({ title: "Fenced" });
  });

  it("recovers an object wrapped in prose", () => {
    expect(
      extractJsonPayload({
        message: {
          content: 'Here is the result:\n{"title":"Wrapped"}\nHope that helps.',
        },
      }),
    ).toEqual({ title: "Wrapped" });
  });

  it("throws when the provider reports an error finish_reason", () => {
    expect(() =>
      extractJsonPayload({
        finish_reason: "error",
        message: { content: '{"title":"ignored"}' },
      }),
    ).toThrow("INVALID_PROVIDER_RESPONSE");
  });

  it("throws when both channels are empty", () => {
    expect(() =>
      extractJsonPayload({ message: { content: "", reasoning_content: "" } }),
    ).toThrow("INVALID_PROVIDER_RESPONSE");
    expect(() => extractJsonPayload({})).toThrow("INVALID_PROVIDER_RESPONSE");
  });

  it("throws rather than returning junk when nothing parses", () => {
    expect(() =>
      extractJsonPayload({ message: { content: "I cannot help with that." } }),
    ).toThrow("INVALID_PROVIDER_RESPONSE");
    // A brace span that is still not valid JSON must not slip through.
    expect(() =>
      extractJsonPayload({ message: { content: "prefix {not json} suffix" } }),
    ).toThrow("INVALID_PROVIDER_RESPONSE");
  });
});
