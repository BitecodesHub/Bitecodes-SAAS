import { describe, expect, it } from "vitest";
import {
  emailShell,
  escapeHtml,
  extractVariables,
  interpolate,
  isSafeEmailUrl,
  renderEmail,
  type EmailBlock,
} from "@/lib/email/template";

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<>&'"`)).toBe("&lt;&gt;&amp;&#39;&quot;");
  });

  it("leaves safe text untouched", () => {
    expect(escapeHtml("Café Rossi — Ahmedabad")).toBe("Café Rossi — Ahmedabad");
  });

  it("escapes the ampersand before other entities, not after", () => {
    // Escaping in the wrong order produces &amp;lt; — a visible bug in email.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("interpolate", () => {
  it("substitutes values", () => {
    expect(interpolate("Hi {{name}}", { name: "Ada" }).text).toBe("Hi Ada");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(interpolate("Hi {{  name  }}", { name: "Ada" }).text).toBe("Hi Ada");
  });

  it("substitutes numbers", () => {
    expect(interpolate("Score {{score}}", { score: 0 }).text).toBe("Score 0");
    expect(interpolate("Score {{score}}", { score: 42 }).text).toBe("Score 42");
  });

  it("replaces every occurrence, not just the first", () => {
    expect(interpolate("{{a}}-{{a}}-{{a}}", { a: "x" }).text).toBe("x-x-x");
  });

  it("reports missing variables and leaves no placeholder behind", () => {
    const result = interpolate("Hi {{name}}, from {{city}}", { name: "Ada" });
    expect(result.text).toBe("Hi Ada, from ");
    expect(result.missing).toEqual(["city"]);
    // A prospect must never receive a literal placeholder.
    expect(result.text).not.toContain("{{");
  });

  it("treats null, undefined, and empty string as missing", () => {
    const result = interpolate("{{a}}{{b}}{{c}}", {
      a: null,
      b: undefined,
      c: "",
    });
    expect(result.text).toBe("");
    expect(result.missing.sort()).toEqual(["a", "b", "c"]);
  });

  it("does not treat zero as missing", () => {
    expect(interpolate("{{n}}", { n: 0 }).missing).toEqual([]);
  });

  it("ignores syntax that is not a plain variable name", () => {
    // No expression language: nothing here should be evaluated or replaced.
    const templates = [
      "{{ 1 + 1 }}",
      "{{a.b}}",
      "{{a-b}}",
      "{{}}",
      "{{ }}",
      "{ single }",
      "{{{triple}}}",
      "{{constructor}}",
    ];
    for (const template of templates) {
      const result = interpolate(template, {});
      if (template === "{{{triple}}}") {
        // The inner {{triple}} is a valid name; the outer braces stay literal.
        expect(result.text).toBe("{}");
      } else if (template === "{{constructor}}") {
        // A real name, so it is looked up — and must not resolve to the
        // prototype's constructor.
        expect(result.text).toBe("");
        expect(result.missing).toEqual(["constructor"]);
      } else {
        expect(result.text).toBe(template);
      }
    }
  });

  it("does not resolve inherited object properties", () => {
    // Guards against `{{toString}}` rendering "function toString()..." into a
    // customer's inbox. Names starting with an underscore are not valid
    // variable names at all, so `{{__proto__}}` is left literal like any other
    // unrecognised syntax — the requirement in every case is that nothing from
    // the prototype chain is ever resolved.
    for (const name of [
      "toString",
      "valueOf",
      "hasOwnProperty",
      "constructor",
    ]) {
      const result = interpolate(`{{${name}}}`, {});
      expect(result.text, name).toBe("");
      expect(result.missing, name).toEqual([name]);
    }

    expect(interpolate("{{__proto__}}", {}).text).toBe("{{__proto__}}");
    for (const name of ["toString", "constructor", "__proto__"]) {
      expect(interpolate(`{{${name}}}`, {}).text).not.toContain("native code");
    }
  });
});

describe("extractVariables", () => {
  it("collects and sorts unique names across sources", () => {
    expect(extractVariables("Hi {{name}}", "from {{city}}, {{name}}")).toEqual([
      "city",
      "name",
    ]);
  });

  it("returns an empty list when there are none", () => {
    expect(extractVariables("no variables here")).toEqual([]);
  });
});

describe("isSafeEmailUrl", () => {
  it("accepts http, https, and mailto", () => {
    expect(isSafeEmailUrl("https://bitecodes.com/report/abc")).toBe(true);
    expect(isSafeEmailUrl("http://localhost:3000/x")).toBe(true);
    expect(isSafeEmailUrl("mailto:hello@bitecodes.com")).toBe(true);
  });

  it("rejects script and data URLs", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "file:///etc/passwd",
      "not a url",
      "",
    ]) {
      expect(isSafeEmailUrl(url), url).toBe(false);
    }
  });
});

describe("renderEmail", () => {
  const blocks: EmailBlock[] = [
    { type: "h2", text: "About {{businessName}}" },
    { type: "p", text: "Hi there,\nWe looked at your site." },
    { type: "ul", items: ["No mobile layout", "Score {{auditScore}}/100"] },
    { type: "cta", label: "See the report", url: "{{reportUrl}}" },
    { type: "signature", text: "— {{senderName}}" },
  ];

  const variables = {
    businessName: "Rossi & Co",
    auditScore: 42,
    reportUrl: "https://bitecodes.com/report/tok",
    senderName: "Ismail",
  };

  it("produces both HTML and plain text", () => {
    const result = renderEmail({
      subject: "Hi {{businessName}}",
      blocks,
      variables,
    });
    expect(result.html).toContain("<!doctype html>");
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).not.toContain("<");
  });

  it("escapes interpolated values in HTML", () => {
    const result = renderEmail({
      subject: "x",
      blocks: [{ type: "p", text: "Hello {{businessName}}" }],
      variables: { businessName: `<script>alert(1)</script>` },
    });
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });

  it("escapes an ampersand in a real business name", () => {
    // "Rossi & Co" is exactly the kind of name OpenStreetMap returns.
    const result = renderEmail({
      subject: "Hi {{businessName}}",
      blocks,
      variables,
    });
    expect(result.html).toContain("Rossi &amp; Co");
    // Plain text keeps the literal ampersand.
    expect(result.text).not.toContain("&amp;");
  });

  it("strips newlines from the subject to prevent header injection", () => {
    const result = renderEmail({
      subject: "Hello\r\nBcc: victim@example.com",
      blocks: [],
      variables: {},
    });
    expect(result.subject).toBe("Hello Bcc: victim@example.com");
    expect(result.subject).not.toMatch(/[\r\n]/);
  });

  it("strips newlines injected through a variable", () => {
    const result = renderEmail({
      subject: "Hi {{businessName}}",
      blocks: [],
      variables: { businessName: "X\nBcc: victim@example.com" },
    });
    expect(result.subject).not.toMatch(/[\r\n]/);
  });

  it("renders a CTA as a link when the URL is safe", () => {
    const result = renderEmail({ subject: "x", blocks, variables });
    expect(result.html).toContain('href="https://bitecodes.com/report/tok"');
    expect(result.text).toContain(
      "See the report: https://bitecodes.com/report/tok",
    );
  });

  it("degrades a dangerous CTA URL to plain text instead of emitting it", () => {
    const result = renderEmail({
      subject: "x",
      blocks: [{ type: "cta", label: "Click", url: "javascript:alert(1)" }],
      variables: {},
    });
    expect(result.html).not.toContain("javascript:");
    expect(result.html).toContain("Click");
    expect(result.text).toBe("Click");
  });

  it("degrades a CTA whose URL variable is missing", () => {
    const result = renderEmail({
      subject: "x",
      blocks: [{ type: "cta", label: "Click", url: "{{missingUrl}}" }],
      variables: {},
    });
    expect(result.html).not.toContain("href");
    expect(result.missing).toContain("missingUrl");
  });

  it("aggregates missing variables from the subject and every block", () => {
    const result = renderEmail({
      subject: "Hi {{a}}",
      blocks: [
        { type: "p", text: "{{b}}" },
        { type: "ul", items: ["{{c}}"] },
        { type: "cta", label: "{{d}}", url: "{{e}}" },
        { type: "signature", text: "{{f}}" },
      ],
      variables: {},
    });
    expect(result.missing.sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("converts newlines to <br> in paragraphs but not into markup", () => {
    const result = renderEmail({
      subject: "x",
      blocks: [{ type: "p", text: "one\ntwo" }],
      variables: {},
    });
    expect(result.html).toContain("one<br>two");
  });

  it("includes the postal address and unsubscribe link in both parts", () => {
    const result = renderEmail({
      subject: "x",
      blocks: [{ type: "p", text: "hello" }],
      variables: {},
      shell: {
        postalAddress: "Bitecodes, Ahmedabad, India",
        unsubscribeUrl: "https://bitecodes.com/unsubscribe?t=abc",
        footerNote:
          "You received this because your business is listed publicly.",
      },
    });
    expect(result.html).toContain("Bitecodes, Ahmedabad, India");
    expect(result.html).toContain("/unsubscribe?t=abc");
    expect(result.text).toContain("Bitecodes, Ahmedabad, India");
    expect(result.text).toContain(
      "Unsubscribe: https://bitecodes.com/unsubscribe?t=abc",
    );
  });

  it("omits an unsafe unsubscribe URL rather than rendering it", () => {
    const result = renderEmail({
      subject: "x",
      blocks: [],
      variables: {},
      shell: { unsubscribeUrl: "javascript:alert(1)" },
    });
    expect(result.html).not.toContain("javascript:");
    expect(result.text).not.toContain("Unsubscribe");
  });

  it("handles an empty block list without producing broken HTML", () => {
    const result = renderEmail({ subject: "x", blocks: [], variables: {} });
    expect(result.html).toContain("</html>");
    expect(result.text).toBe("");
  });
});

describe("emailShell", () => {
  it("escapes the brand name and address", () => {
    const html = emailShell("<p>body</p>", {
      brandName: "A & B",
      postalAddress: "<script>x</script>",
      tagline: "Tag & line",
    });
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("keeps caller-provided content HTML intact", () => {
    // Block content is escaped by the block renderers, so the shell must not
    // double-escape it.
    const html = emailShell('<p style="margin:0">hi</p>');
    expect(html).toContain('<p style="margin:0">hi</p>');
  });
});
