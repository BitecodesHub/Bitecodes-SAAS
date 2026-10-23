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
          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-[14px]">
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
            <div className="mt-10">
              <PostBody blocks={post.body} />
            </div>
          </Reveal>

          {post.faq && post.faq.length > 0 && (
            <div className="bg-surface-2 mt-14 rounded-[28px] p-7 sm:p-9">
              <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
                Frequently asked
              </h2>
              <dl className="mt-6 space-y-6">
                {post.faq.map((item) => (
                  <div key={item.question}>
                    <dt className="text-[16px] font-semibold">
                      {item.question}
                    </dt>
                    <dd className="text-muted-foreground mt-2 text-[15px] leading-[1.65]">
                      {item.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {post.internalLinks && post.internalLinks.length > 0 && (
            <div className="mt-12">
              <p className="text-[15px] font-semibold">Explore next</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {post.internalLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      href={link.path}
                      className="bg-surface-2 hover:bg-secondary inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-medium transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/blog"
              className="text-primary -mx-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2.5 text-[15px] font-medium hover:underline"
            >
              <ArrowLeft className="size-4" />
              Back to all articles
            </Link>
          </div>
        </div>
      </Section>

      {related.length > 0 && (
        <Section spacing="sm" className="bg-surface-2">
          <div className="container-page">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">
              Related articles
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group bg-background rounded-[24px] p-7 transition-all duration-300 hover:shadow-[var(--shadow-soft)]"
                >
                  <Badge>{r.category}</Badge>
                  <h3 className="group-hover:text-primary mt-4 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] transition-colors">
                    {r.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-[15px] leading-[1.55]">
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
