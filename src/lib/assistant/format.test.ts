import { describe, expect, it } from "vitest";
import { parseAssistantInline, parseAssistantMessage } from "./format";

describe("parseAssistantInline", () => {
  it("reads bold, italics and site links", () => {
    expect(
      parseAssistantInline("**From $500.** *Fixed scope* [Pricing](/pricing)"),
    ).toEqual([
      { type: "strong", text: "From $500." },
      { type: "text", text: " " },
      { type: "em", text: "Fixed scope" },
      { type: "text", text: " " },
      { type: "link", text: "Pricing", href: "/pricing" },
    ]);
  });

  it("renders unsafe links as plain labels", () => {
    expect(parseAssistantInline("[click](javascript:alert)")).toEqual([
      { type: "text", text: "click" },
    ]);
    expect(parseAssistantInline("[offsite](https://example.com)")).toEqual([
      { type: "text", text: "offsite" },
    ]);
  });

  it("allows the canonical site host", () => {
    expect(
      parseAssistantInline("[contact](https://www.bitecodes.com/contact)"),
    ).toEqual([
      {
        type: "link",
        text: "contact",
        href: "https://www.bitecodes.com/contact",
      },
    ]);
  });
});

describe("parseAssistantMessage", () => {
  it("splits paragraphs and groups bullets", () => {
    expect(
      parseAssistantMessage(
        "**From $500.**\n\nOptions:\n- Launch\n- Growth\n\nDone.",
      ),
    ).toEqual([
      {
        type: "paragraph",
        content: [{ type: "strong", text: "From $500." }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Options:" }],
      },
      {
        type: "list",
        items: [
          [{ type: "text", text: "Launch" }],
          [{ type: "text", text: "Growth" }],
        ],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Done." }],
      },
    ]);
  });

  it("joins wrapped lines and strips stray headings", () => {
    expect(
      parseAssistantMessage("# Pricing\nThe Launch package is **from $500**."),
    ).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Pricing The Launch package is " },
          { type: "strong", text: "from $500" },
          { type: "text", text: "." },
        ],
      },
    ]);
  });
});
