/**
 * A deliberately small markdown subset for assistant replies: paragraphs,
 * bullets, bold, italics, and same-site links. Parsing to React-friendly
 * structures keeps model output out of `dangerouslySetInnerHTML` and lets any
 * unexpected syntax fall back to visible text.
 */

export type AssistantInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "link"; text: string; href: string };

export type AssistantBlock =
  | { type: "paragraph"; content: AssistantInline[] }
  | { type: "list"; items: AssistantInline[][] };

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
const BULLET = /^\s*(?:[-*•]|\d{1,2}[.)])\s+(.+)$/;

function safeHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  return /^https:\/\/(?:www\.)?bitecodes\.com(?:\/|$)/.test(href);
}

export function parseAssistantInline(text: string): AssistantInline[] {
  const spans: AssistantInline[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = spans[spans.length - 1];
    if (last?.type === "text") last.text += value;
    else spans.push({ type: "text", text: value });
  };

  let lastIndex = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    pushText(text.slice(lastIndex, index));

    if (match[1] !== undefined && match[2] !== undefined) {
      const label = match[1].trim();
      if (safeHref(match[2])) {
        spans.push({ type: "link", text: label, href: match[2] });
      } else {
        pushText(label);
      }
    } else if (match[3] !== undefined) {
      spans.push({ type: "strong", text: match[3] });
    } else if (match[4] !== undefined) {
      spans.push({ type: "em", text: match[4] });
    }

    lastIndex = index + match[0].length;
  }
  pushText(text.slice(lastIndex));
  return spans;
}

export function parseAssistantMessage(text: string): AssistantBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  const blocks: AssistantBlock[] = [];
  let paragraph: string[] = [];
  let list: AssistantInline[][] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      type: "paragraph",
      content: parseAssistantInline(paragraph.join(" ")),
    });
    paragraph = [];
  };
  const flushList = () => {
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      if (!list) {
        list = [];
        blocks.push({ type: "list", items: list });
      }
      list.push(parseAssistantInline(bullet[1]));
      continue;
    }

    flushList();
    // A model occasionally emits a heading despite the prompt; show its words
    // rather than the hash marks.
    paragraph.push(line.replace(/^#{1,6}\s+/, ""));
  }

  flushParagraph();
  return blocks;
}
