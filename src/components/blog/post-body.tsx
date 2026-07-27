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
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {block.text}
        </h2>
      );

    case "h3":
      return (
        <h3 className="text-base font-semibold tracking-tight sm:text-lg">
          {block.text}
        </h3>
      );

    case "p":
      return (
        <p className="text-muted-foreground leading-relaxed">{block.text}</p>
      );

    case "ul":
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="text-muted-foreground flex gap-3">
              <span
                aria-hidden="true"
                className="bg-primary mt-2 size-1.5 shrink-0 rounded-full"
              />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2">
          {block.items.map((item, index) => (
            <li key={item} className="text-muted-foreground flex gap-3">
              <span
                aria-hidden="true"
                className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              >
                {index + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      );

    case "quote":
      return (
        <blockquote className="border-primary/40 border-l-2 pl-5">
          <p className="text-foreground leading-relaxed italic">{block.text}</p>
          {block.attribution && (
            <footer className="text-muted-foreground mt-2 text-sm not-italic">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );

    case "code":
      return (
        <div className="border-border bg-muted/40 overflow-x-auto rounded-xl border">
          <pre className="p-4 text-sm">
            <code className="font-mono">{block.text}</code>
          </pre>
        </div>
      );

    case "cta":
      return (
        <div className="border-primary/20 bg-primary/5 rounded-2xl border p-6">
          <p className="leading-relaxed font-medium">{block.text}</p>
          <Link
            href={block.path}
            className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline"
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
