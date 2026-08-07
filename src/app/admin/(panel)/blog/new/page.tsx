import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import { BlogEditor } from "@/components/admin/blog-editor";

export const metadata: Metadata = { title: "New post" };

/**
 * The only admin page that was missing this, and it is a security control rather
 * than a performance setting: without `cacheComponents` enabled, `force-dynamic`
 * is what guarantees no route-level cache entry can ever be produced for a page
 * rendered behind an authorisation check. The panel layout's `cookies()` call
 * already forces dynamic rendering for the whole segment, so this changes nothing
 * today — it is the second belt, kept consistent across all 17 pages so the
 * invariant is checkable by grep rather than by reasoning about layouts.
 */
export const dynamic = "force-dynamic";

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
