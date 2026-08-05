import type { BlogBlock } from "@/types/content";

/**
 * A markdown-lite bridge between the block array the site renders and a plain
 * textarea an editor can type into. Deliberately small: `## ` → h2, `### ` →
 * h3, lines starting `- ` → a `ul`, `1. ` → an `ol`, everything else a
 * paragraph, blank lines separate blocks. Round-trips the block types a human
 * edits; richer blocks (quote/code/cta) are preserved by the editor form as
 * hidden state rather than serialised here.
 */

export function blocksToText(blocks: BlogBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "h2":
        parts.push(`## ${block.text}`);
        break;
      case "h3":
        parts.push(`### ${block.text}`);
        break;
      case "p":
        parts.push(block.text);
        break;
      case "ul":
        parts.push(block.items.map((i) => `- ${i}`).join("\n"));
        break;
      case "ol":
        parts.push(block.items.map((i, n) => `${n + 1}. ${i}`).join("\n"));
        break;
      case "quote":
        parts.push(`> ${block.text}`);
        break;
      case "code":
        parts.push(`\`\`\`\n${block.text}\n\`\`\``);
        break;
      case "cta":
        parts.push(`[[cta:${block.path}|${block.label}]] ${block.text}`);
        break;
    }
  }
  return parts.join("\n\n");
}

export function textToBlocks(text: string): BlogBlock[] {
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  const blocks: BlogBlock[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim());

    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ type: "ul", items: lines.map((l) => l.slice(2).trim()) });
      continue;
    }
    if (lines.every((l) => /^\d+\.\s/.test(l))) {
      blocks.push({
        type: "ol",
        items: lines.map((l) => l.replace(/^\d+\.\s/, "").trim()),
      });
      continue;
    }
    if (lines.length === 1) {
      const line = lines[0];
      if (line.startsWith("### ")) {
        blocks.push({ type: "h3", text: line.slice(4).trim() });
        continue;
      }
      if (line.startsWith("## ")) {
        blocks.push({ type: "h2", text: line.slice(3).trim() });
        continue;
      }
      if (line.startsWith("> ")) {
        blocks.push({ type: "quote", text: line.slice(2).trim() });
        continue;
      }
    }
    blocks.push({ type: "p", text: chunk });
  }
  return blocks;
}
