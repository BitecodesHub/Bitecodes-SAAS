import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BlogBlock } from "@/types/content";

/**
 * Renders a blog post body from its block list.
 *
 * Shared by the public post page, the admin editor preview, and the admin
 * revision diff so all three stay visually identical. Every member of the
 * `BlogBlock` union must have a branch here — the `never` fallback makes a
 * missing branch a type error rather than a silently blank block.
 */
export function PostBody({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <article className="space-y-6">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </article>
  );
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-4 text-[28px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance">
          {block.text}
        </h2>
      );

    case "h3":
      return (
        <h3 className="mt-2 text-[21px] leading-[1.3] font-semibold tracking-[-0.015em]">
          {block.text}
        </h3>
      );

    case "p":
      return (
        <p className="text-muted-foreground text-[17px] leading-[1.65]">
          {block.text}
        </p>
      );

    case "ul":
      return (
        <ul className="space-y-3">
          {block.items.map((item) => (
            <li key={item} className="text-muted-foreground flex gap-3">
              <span
                aria-hidden="true"
                className="bg-primary mt-2.5 size-1.5 shrink-0 rounded-full"
              />
              <span className="text-[17px] leading-[1.65]">{item}</span>
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-3">
          {block.items.map((item, index) => (
            <li key={item} className="text-muted-foreground flex gap-3">
              <span
                aria-hidden="true"
                className="bg-surface-2 text-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <span className="text-[17px] leading-[1.65]">{item}</span>
            </li>
          ))}
        </ol>
      );

    case "quote":
      return (
        <blockquote className="bg-surface-2 rounded-[24px] p-7">
          <p className="text-foreground text-[21px] leading-[1.45] font-medium tracking-[-0.015em] text-pretty">
            {block.text}
          </p>
          {block.attribution && (
            <footer className="text-muted-foreground mt-3 text-[14px]">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );

    case "code":
      return (
        <div className="bg-surface-2 overflow-x-auto rounded-[20px]">
          <pre className="p-5 text-[13px] leading-[1.6]">
            <code className="font-mono">{block.text}</code>
          </pre>
        </div>
      );

    case "cta":
      return (
        <div className="bg-surface-2 rounded-[24px] p-7">
          <p className="text-[17px] leading-[1.55] font-medium">{block.text}</p>
          <Link
            href={block.path}
            className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 text-[15px] font-medium hover:underline"
          >
            {block.label}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      );

    default: {
      // Exhaustiveness guard: adding a block type without a branch above
      // fails the build here instead of rendering nothing in production.
      const exhaustive: never = block;
      void exhaustive;
      return null;
    }
  }
}
