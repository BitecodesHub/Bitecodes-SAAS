/**
 * Plain-text extraction from the knowledge formats we ingest without a binary
 * parser: txt, markdown, html, json, and csv. Pure and dependency-free.
 *
 * PDF and DOCX need binary parsers and are deferred; `extractText` returns a
 * clear `unsupported` result for those rather than guessing.
 */

export type KnowledgeFormat =
  | "txt"
  | "md"
  | "html"
  | "json"
  | "csv"
  | "pdf"
  | "docx";

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "unsupported" | "empty" | "invalid" };

/** Strips HTML to readable text: drops script/style, unwraps tags, decodes basics. */
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutScripts
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/** Flattens JSON to `key: value` lines so string content survives for retrieval. */
export function jsonToText(json: unknown, prefix = ""): string {
  const lines: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, path ? `${path}[${i}]` : `[${i}]`));
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    } else {
      lines.push(path ? `${path}: ${value}` : String(value));
    }
  };
  walk(json, prefix);
  return lines.join("\n");
}

/** Turns CSV into `header: cell` grouped rows, so column meaning is preserved. */
export function csvToText(csv: string): string {
  const rows = parseCsv(csv);
  if (rows.length === 0) return "";
  const [header, ...body] = rows;
  if (body.length === 0) return header.join(" ");
  return body
    .map((row) =>
      row
        .map((cell, i) => `${header[i] ?? `col${i + 1}`}: ${cell}`.trim())
        .filter(Boolean)
        .join("; "),
    )
    .join("\n");
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines in quotes). */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = input.replace(/\r\n/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Extracts plain text for the given format. */
export function extractText(
  content: string,
  format: KnowledgeFormat,
): ExtractResult {
  if (format === "pdf" || format === "docx") {
    return { ok: false, reason: "unsupported" };
  }
  if (!content.trim()) return { ok: false, reason: "empty" };

  let text: string;
  switch (format) {
    case "html":
      text = htmlToText(content);
      break;
    case "json":
      try {
        text = jsonToText(JSON.parse(content));
      } catch {
        return { ok: false, reason: "invalid" };
      }
      break;
    case "csv":
      text = csvToText(content);
      break;
    case "txt":
    case "md":
    default:
      text = content.trim();
  }

  if (!text.trim()) return { ok: false, reason: "empty" };
  return { ok: true, text };
}
