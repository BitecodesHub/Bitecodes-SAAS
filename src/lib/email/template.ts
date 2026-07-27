/**
 * One block of email body content.
 *
 * A closed set rather than free HTML for the same reason blog bodies are: the
 * body is edited in the admin panel and filled with third-party data, so
 * arbitrary markup must never be representable.
 */
export type EmailBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "cta"; label: string; url: string }
  | { type: "signature"; text: string };

/**
 * Email rendering: variables in, HTML and plain text out.
 *
 * Deliberately dependency-free and pure so it can be exhaustively tested, and
 * deliberately **not** a general template engine. Templates are edited in the
 * admin panel and filled with values harvested from third-party sources
 * (business names from OpenStreetMap, page titles from prospect websites), so
 * every interpolated value is untrusted. Escaping is therefore applied by the
 * renderer and cannot be turned off by a template author — there is no "raw"
 * syntax, on purpose.
 */

export type TemplateVariables = Record<
  string,
  string | number | null | undefined
>;

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}

/** Matches `{{ name }}`. Names are restricted so no expression can appear. */
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export interface InterpolationResult {
  text: string;
  /** Variables the template referenced but the caller did not supply. */
  missing: string[];
}

/**
 * Replaces `{{variable}}` placeholders.
 *
 * A missing variable becomes an empty string rather than leaving the raw
 * placeholder in the message — a prospect receiving literal `{{businessName}}`
 * is worse than a slightly terse sentence — but it is also reported so the
 * admin editor can refuse to send an incomplete template.
 */
export function interpolate(
  template: string,
  variables: TemplateVariables,
): InterpolationResult {
  const missing = new Set<string>();

  const text = template.replace(VARIABLE_PATTERN, (_match, name: string) => {
    // `Object.hasOwn` rather than a plain lookup: a plain lookup walks the
    // prototype chain, so `{{toString}}` would render
    // "function toString() { [native code] }" into a customer's inbox, and
    // `{{constructor}}` would leak the Object constructor.
    const value = Object.hasOwn(variables, name) ? variables[name] : undefined;
    if (value === undefined || value === null || value === "") {
      missing.add(name);
      return "";
    }
    return String(value);
  });

  return { text, missing: [...missing] };
}

/** Lists every variable a template body references. Used by the editor. */
export function extractVariables(...sources: string[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(VARIABLE_PATTERN)) {
      found.add(match[1]!);
    }
  }
  return [...found].sort();
}

/**
 * Only `http`, `https`, and `mailto` links are emitted. Blocks
 * `javascript:` and `data:` URLs, which some webmail clients still honour.
 */
export function isSafeEmailUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  missing: string[];
}

export interface EmailShellOptions {
  /** Rendered in the footer. Required by CAN-SPAM for commercial mail. */
  postalAddress?: string | null;
  unsubscribeUrl?: string | null;
  /** Small print under the address, e.g. why the recipient is being emailed. */
  footerNote?: string | null;
  brandName?: string;
  tagline?: string;
}

/**
 * Wraps content in the shared email chrome.
 *
 * Table-free, inline-styled, and light-theme only: email clients have no
 * reliable support for external stylesheets, CSS variables, or
 * `prefers-color-scheme`, so this keeps the same inline-style approach the
 * existing contact emails already use.
 */
export function emailShell(
  contentHtml: string,
  options: EmailShellOptions = {},
) {
  const {
    postalAddress,
    unsubscribeUrl,
    footerNote,
    brandName = "BITECODES",
    tagline = "Software, engineered with intent.",
  } = options;

  const footerParts: string[] = [
    `<p style="margin:0 0 6px">${escapeHtml(tagline)}</p>`,
  ];

  if (postalAddress) {
    footerParts.push(
      `<p style="margin:0 0 6px">${escapeHtml(postalAddress)}</p>`,
    );
  }
  if (footerNote) {
    footerParts.push(`<p style="margin:0 0 6px">${escapeHtml(footerNote)}</p>`);
  }
  if (unsubscribeUrl && isSafeEmailUrl(unsubscribeUrl)) {
    footerParts.push(
      `<p style="margin:0"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6e6a77;text-decoration:underline">Unsubscribe</a></p>`,
    );
  }

  return `<!doctype html><html lang="en"><body style="margin:0;background:#f6f5f2;color:#201f26;font-family:Arial,Helvetica,sans-serif"><div style="max-width:640px;margin:0 auto;padding:40px 20px"><div style="background:#fff;border:1px solid #e6e3eb;border-radius:20px;padding:32px"><p style="margin:0 0 24px;color:#5640b8;font-weight:700;letter-spacing:0.04em">${escapeHtml(brandName)}</p>${contentHtml}</div><div style="color:#6e6a77;font-size:12px;line-height:1.6;text-align:center;padding-top:20px">${footerParts.join("")}</div></div></body></html>`;
}

function renderBlockHtml(block: EmailBlock, variables: TemplateVariables) {
  switch (block.type) {
    case "h2": {
      const { text } = interpolate(block.text, variables);
      return `<h2 style="margin:24px 0 12px;font-size:20px;line-height:1.3">${escapeHtml(text)}</h2>`;
    }
    case "p": {
      const { text } = interpolate(block.text, variables);
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7">${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
    }
    case "ul": {
      const items = block.items
        .map((item) => {
          const { text } = interpolate(item, variables);
          return `<li style="margin:0 0 8px;font-size:15px;line-height:1.6">${escapeHtml(text)}</li>`;
        })
        .join("");
      return `<ul style="margin:0 0 16px;padding-left:20px">${items}</ul>`;
    }
    case "cta": {
      const { text: label } = interpolate(block.label, variables);
      const { text: url } = interpolate(block.url, variables);
      if (!isSafeEmailUrl(url)) {
        // Rather than emit a dead or dangerous link, fall back to plain text.
        return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7">${escapeHtml(label)}</p>`;
      }
      return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#5640b8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;font-weight:600">${escapeHtml(label)}</a></p>`;
    }
    case "signature": {
      const { text } = interpolate(block.text, variables);
      return `<p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#4a4754">${escapeHtml(text).replaceAll("\n", "<br>")}</p>`;
    }
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return "";
    }
  }
}

function renderBlockText(block: EmailBlock, variables: TemplateVariables) {
  switch (block.type) {
    case "h2":
      return `${interpolate(block.text, variables).text}\n`;
    case "p":
      return interpolate(block.text, variables).text;
    case "ul":
      return block.items
        .map((item) => `- ${interpolate(item, variables).text}`)
        .join("\n");
    case "cta": {
      const label = interpolate(block.label, variables).text;
      const url = interpolate(block.url, variables).text;
      return isSafeEmailUrl(url) ? `${label}: ${url}` : label;
    }
    case "signature":
      return interpolate(block.text, variables).text;
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return "";
    }
  }
}

/**
 * Renders a template to both HTML and plain text.
 *
 * A text alternative is not optional: multipart messages with only an HTML
 * part score badly with spam filters, and text-only clients would show nothing.
 */
export function renderEmail({
  subject,
  blocks,
  variables,
  shell = {},
}: {
  subject: string;
  blocks: EmailBlock[];
  variables: TemplateVariables;
  shell?: EmailShellOptions;
}): RenderedEmail {
  const subjectResult = interpolate(subject, variables);

  const missing = new Set(subjectResult.missing);
  const collect = (source: string) => {
    for (const name of interpolate(source, variables).missing)
      missing.add(name);
  };
  for (const block of blocks) {
    if (block.type === "ul") block.items.forEach(collect);
    else if (block.type === "cta") {
      collect(block.label);
      collect(block.url);
    } else collect(block.text);
  }

  const contentHtml = blocks
    .map((block) => renderBlockHtml(block, variables))
    .join("");

  const textParts = [
    ...blocks.map((block) => renderBlockText(block, variables)),
  ].filter((part) => part.trim().length > 0);

  if (shell.postalAddress) textParts.push(`\n${shell.postalAddress}`);
  if (shell.footerNote) textParts.push(shell.footerNote);
  if (shell.unsubscribeUrl && isSafeEmailUrl(shell.unsubscribeUrl)) {
    textParts.push(`Unsubscribe: ${shell.unsubscribeUrl}`);
  }

  return {
    // Newlines in a Subject header would allow header injection.
    subject: subjectResult.text.replace(/[\r\n]+/g, " ").trim(),
    html: emailShell(contentHtml, shell),
    text: textParts.join("\n\n"),
    missing: [...missing],
  };
}
