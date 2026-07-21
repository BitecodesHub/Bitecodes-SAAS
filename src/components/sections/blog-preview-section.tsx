import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { blogPosts } from "@/data/blog";

export function BlogPreviewSection() {
  const latest = [...blogPosts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <Section className="border-border bg-secondary/35 border-y">
      <div className="container-page">
        <SectionHeader
          eyebrow="Writing"
          title="Practical notes from building software"
          description="Engineering, product, performance, security, and applied-AI guidance from the Bitecodes team."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {latest.map((post) => (
            <article
              key={post.slug}
              className="border-border bg-card flex flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">{post.category}</Badge>
                <span className="text-muted-foreground text-xs">
                  {post.readingMinutes} min read
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold">
                <Link
                  href={`/blog/${post.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {post.title}
                </Link>
              </h3>
              <p className="text-muted-foreground mt-3 flex-1 text-sm leading-relaxed">
                {post.excerpt}
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="text-primary mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
              >
                Read article
                <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/blog">
              <BookOpen className="size-4" />
              Explore all articles
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
