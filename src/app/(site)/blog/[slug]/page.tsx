import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { Reveal } from "@/components/motion/reveal";
import { PostBody } from "@/components/blog/post-body";
import { Badge } from "@/components/ui/badge";
import { CtaSection } from "@/components/cta-section";
import { JsonLd } from "@/components/json-ld";
import { blogPosts } from "@/data/blog";
import {
  getPublishedPost,
  getRelatedPublishedPosts,
} from "@/lib/server/blog/repository";
import { createMetadata, breadcrumbSchema, faqSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

// Dynamic so AI-published posts resolve without a redeploy; static posts are
// still pre-known via generateStaticParams below.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  // `image: false`: this segment has its own opengraph-image.tsx (one
  // per post), which createMetadata's generic default would otherwise
  // replace outright rather than merge with.
  if (!post) {
    return createMetadata({ title: "Article not found", image: false });
  }
  const meta = createMetadata({
    title: post.title,
    description: post.metaDescription || post.excerpt,
    path: `/blog/${post.slug}`,
    image: false,
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
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const related = await getRelatedPublishedPosts(slug);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: `${siteConfig.url}/opengraph-image`,
    datePublished: post.date,
    // Real value for database-backed posts, which is most of them post-launch
    // of the blog engine's edit flow; static posts have no independent
    // modification timestamp, so this was always identical to datePublished —
    // a freshness signal that never actually reported freshness.
    dateModified: post.updatedAt ?? post.date,
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
      {post.faq && post.faq.length > 0 && <JsonLd data={faqSchema(post.faq)} />}
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
            <div className="mt-8">
              <PostBody blocks={post.body} />
            </div>
          </Reveal>

          {post.faq && post.faq.length > 0 && (
            <div className="border-border mt-10 border-t pt-8">
              <h2 className="text-xl font-semibold tracking-tight">
                Frequently asked
              </h2>
              <dl className="mt-5 space-y-5">
                {post.faq.map((item) => (
                  <div key={item.question}>
                    <dt className="font-medium">{item.question}</dt>
                    <dd className="text-muted-foreground mt-1.5 leading-relaxed">
                      {item.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {post.internalLinks && post.internalLinks.length > 0 && (
            <div className="border-border mt-8 border-t pt-6">
              <p className="text-sm font-semibold">Explore next</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {post.internalLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      href={link.path}
                      className="border-border hover:border-primary/40 hover:text-primary inline-flex rounded-full border px-3.5 py-1.5 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
