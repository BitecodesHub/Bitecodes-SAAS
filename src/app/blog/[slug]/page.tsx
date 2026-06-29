import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { blogPosts, getPost, relatedPosts } from "@/data/blog";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return createMetadata({ title: "Article not found" });
  const meta = createMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  });
  // Blog posts are articles, not generic web pages.
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = relatedPosts(slug);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: `${siteConfig.url}/opengraph-image`,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Person",
      name: post.author,
      url: `${siteConfig.url}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.url}/icon.svg`,
      },
    },
    keywords: post.tags.join(", "),
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ])}
      />
      <PageHeader
        eyebrow={post.category}
        title={post.title}
        description={post.excerpt}
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: post.title, href: `/blog/${post.slug}` },
        ]}
      />

      <Section spacing="sm">
        <div className="container-page mx-auto max-w-3xl">
          <div className="border-border text-muted-foreground flex flex-wrap items-center gap-4 border-b pb-6 text-sm">
            <span>By {post.author}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(post.date)}</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" />
              {post.readingMinutes} min read
            </span>
          </div>

          <Reveal>
            <article className="mt-8 space-y-6">
              {post.body.map((block, i) => {
                if (block.type === "h2") {
                  return (
                    <h2
                      key={i}
                      className="text-xl font-semibold tracking-tight sm:text-2xl"
                    >
                      {block.text}
                    </h2>
                  );
                }
                if (block.type === "ul") {
                  return (
                    <ul key={i} className="space-y-2">
                      {block.items?.map((item) => (
                        <li
                          key={item}
                          className="text-muted-foreground flex gap-3"
                        >
                          <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={i} className="text-muted-foreground leading-relaxed">
                    {block.text}
                  </p>
                );
              })}
            </article>
          </Reveal>

          <div className="border-border mt-8 flex flex-wrap gap-2 border-t pt-6">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/blog"
              className="text-primary -mx-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium hover:underline"
            >
              <ArrowLeft className="size-4" />
              Back to all articles
            </Link>
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section spacing="sm" className="border-border border-t">
          <div className="container-page">
            <h2 className="text-xl font-semibold tracking-tight">
              Related articles
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group border-border bg-card hover:border-primary/30 rounded-2xl border p-6 shadow-[var(--shadow-soft)] transition-colors"
                >
                  <Badge>{r.category}</Badge>
                  <h3 className="group-hover:text-primary mt-3 leading-snug font-semibold">
                    {r.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {r.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

      <CtaSection />
    </>
  );
}
