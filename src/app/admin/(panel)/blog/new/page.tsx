import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import { BlogEditor } from "@/components/admin/blog-editor";

export const metadata: Metadata = { title: "New post" };

export default async function NewBlogPostPage() {
  await requireCapability("write_content");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
        <p className="text-muted-foreground text-sm">
          Write it here, or generate a draft from the blog list and edit that.
        </p>
      </header>

      <BlogEditor
        post={{
          id: null,
          slug: "",
          title: "",
          excerpt: "",
          category: "Engineering",
          tags: [],
          metaDescription: null,
          body: [],
          faq: [],
          internalLinks: [],
          readingMinutes: 1,
          featured: false,
          status: "draft",
          aiAssisted: false,
        }}
      />
    </div>
  );
}
