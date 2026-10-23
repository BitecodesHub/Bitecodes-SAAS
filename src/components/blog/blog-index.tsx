"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BlogPost } from "@/types/content";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function BlogIndex({
  posts,
  categories,
}: {
  posts: BlogPost[];
  categories: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("All");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const matchesCategory = category === "All" || p.category === category;
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [posts, query, category]);

  const filters = ["All", ...categories];

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="Search articles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-11"
            aria-label="Search articles"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={category === f}
              onClick={() => setCategory(f)}
              className={cn(
                "focus-visible:ring-ring min-h-11 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                category === f
                  ? "bg-foreground text-background"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-2 mt-16 rounded-[24px] p-10 text-center">
          <p className="text-[17px] font-medium">
            No articles match your search
          </p>
          <p className="text-muted-foreground mt-1.5 text-[15px]">
            Try a different phrase or category.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group bg-surface-2 hover:bg-background focus-visible:ring-ring flex flex-col rounded-[24px] p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between">
                <Badge>{post.category}</Badge>
                <ArrowUpRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h2 className="group-hover:text-primary mt-4 text-[21px] leading-[1.25] font-semibold tracking-[-0.015em] transition-colors">
                {post.title}
              </h2>
              <p className="text-muted-foreground mt-2.5 flex-1 text-[15px] leading-[1.55]">
                {post.excerpt}
              </p>
              <div className="text-muted-foreground mt-6 flex items-center gap-2 text-[13px]">
                <span>{formatDate(post.date)}</span>
                <span aria-hidden="true">·</span>
                <span>{post.readingMinutes} min read</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
