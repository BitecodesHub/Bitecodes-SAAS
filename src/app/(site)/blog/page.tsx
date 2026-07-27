import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { BlogIndex } from "@/components/blog/blog-index";
import { JsonLd } from "@/components/json-ld";
import { blogPosts, blogCategories } from "@/data/blog";
import { createMetadata, breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Blog",
  description:
    "Notes on engineering, performance, AI, and product from the Bitecodes team — practical lessons from building real software.",
  path: "/blog",
});

export default function BlogPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ])}
      />
      <PageHeader
        eyebrow="Blog"
        title="Notes from the workshop"
        description="Practical writing on engineering, performance, applied AI, and product — the lessons we've learned shipping real software."
        breadcrumbs={[
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
        ]}
      />
      <Section>
        <div className="container-page">
          <BlogIndex posts={blogPosts} categories={blogCategories} />
        </div>
      </Section>
    </>
  );
}
