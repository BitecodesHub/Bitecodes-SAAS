import { describe, expect, it } from "vitest";
import {
  csvToText,
  extractText,
  htmlToText,
  jsonToText,
} from "@/lib/chatbot/extract";

describe("htmlToText", () => {
  it("drops scripts and styles and unwraps tags", () => {
    const html =
      "<html><head><style>.x{color:red}</style></head><body><h1>Title</h1><p>Hello <b>world</b></p><script>alert(1)</script></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("Title");
    expect(text).toContain("Hello world");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });

  it("decodes common entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry &lt;3</p>")).toContain(
      "Tom & Jerry <3",
    );
  });
});

describe("jsonToText", () => {
  it("flattens nested objects and arrays to key: value lines", () => {
    const text = jsonToText({
      company: "Bitecodes",
      contact: { email: "hi@example.com" },
      tags: ["a", "b"],
    });
    expect(text).toContain("company: Bitecodes");
    expect(text).toContain("contact.email: hi@example.com");
    expect(text).toContain("tags[0]: a");
  });
});

describe("csvToText", () => {
  it("pairs headers with cells per row", () => {
    const text = csvToText("name,role\nAda,Engineer\nGrace,Admiral");
    expect(text).toContain("name: Ada; role: Engineer");
    expect(text).toContain("name: Grace; role: Admiral");
  });

  it("handles quoted fields with commas", () => {
    const text = csvToText('name,note\n"Doe, John","a, b, c"');
    expect(text).toContain("name: Doe, John");
    expect(text).toContain("note: a, b, c");
  });
});

describe("extractText", () => {
  it("passes through txt and md", () => {
    expect(extractText("# Heading\n\nBody", "md")).toEqual({
      ok: true,
      text: "# Heading\n\nBody",
    });
  });

  it("reports unsupported for pdf/docx", () => {
    expect(extractText("x", "pdf")).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(extractText("x", "docx")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("reports empty and invalid", () => {
    expect(extractText("   ", "txt")).toEqual({ ok: false, reason: "empty" });
    expect(extractText("{not json", "json")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("extracts from html and json", () => {
    const html = extractText("<p>Hi <b>there</b></p>", "html");
    expect(html.ok && html.text).toContain("Hi there");
    const json = extractText('{"a":"b"}', "json");
    expect(json.ok && json.text).toContain("a: b");
  });
});
