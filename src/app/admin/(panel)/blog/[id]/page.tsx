import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/server/auth/dal";
import { getPostById } from "@/lib/server/blog/repository";
import { BlogEditor } from "@/components/admin/blog-editor";

export const metadata: Metadata = { title: "Edit post" };
export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCapability("write_content");
  const { id } = await params;
  const doc = await getPostById(id);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit post</h1>
        <p className="text-muted-foreground text-sm">
          Revision {doc.revision} · {doc.status}
        </p>
      </header>

      <BlogEditor
        post={{
          id: doc._id?.toHexString() ?? id,
          slug: doc.slug,
          title: doc.title,
          excerpt: doc.excerpt,
          category: doc.category,
          tags: doc.tags,
          metaDescription: doc.metaDescription,
          body: doc.body,
          faq: doc.faq,
          internalLinks: doc.internalLinks,
          readingMinutes: doc.readingMinutes,
          featured: doc.featured,
          status:
            doc.status === "published"
              ? "published"
              : doc.status === "archived"
                ? "archived"
                : "draft",
          aiAssisted: doc.aiAssisted,
        }}
      />
    </div>
  );
}
