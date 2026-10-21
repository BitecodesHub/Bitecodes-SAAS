import type { Metadata } from "next";
import { requireCapability } from "@/lib/server/auth/dal";
import { enqueueJob } from "@/lib/server/jobs/queue";
import { blogPosts } from "@/data/blog";
import type { BlogPost } from "@/types/content";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

/**
 * Admin Content page with tabs for blog, social, and newsletter drafts.
 * Owned by the content-engine package.
 */

const TAB_ITEMS = [
  { key: "blog", label: "Blog Posts" },
  { key: "social", label: "Social Drafts" },
  { key: "newsletter", label: "Newsletter" },
] as const;

export default async function AdminContentPage() {
  await requireCapability("write_content");

  const url =
    typeof window !== "undefined"
      ? new URL(window.location.href)
      : new URL("http://localhost");
  const initialTab = url.searchParams.get("tab") || "blog";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Manage blog, social, and newsletter content.
        </p>
      </header>

      <div className="mb-4 flex border-b">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`flex-1 rounded-md border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors ${initialTab === tab.key ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "text-muted-foreground border-transparent hover:text-indigo-600"}`}
            onClick={() => url.searchParams.set("tab", tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="prose max-w-none">
        {initialTab === "blog" && <BlogDraftsTab />}
        {initialTab === "social" && <SocialDraftsTab />}
        {initialTab === "newsletter" && <NewsletterTab />}
      </section>
    </div>
  );
}

interface BlogPostRow {
  slug: string;
  title: string;
  category: string;
  aiAssisted: boolean;
  status: string;
}

function BlogDraftsTab() {
  const posts = blogPosts;
  const rows: BlogPostRow[] = posts
    .filter(
      (p): p is BlogPost =>
        (p as { status?: string }).status === "draft" ||
        (p.aiAssisted === true && "aiAssisted" in p),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      aiAssisted: p.aiAssisted ?? false,
      status: ((p as { status?: string }).status ?? "published") as string,
    }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Blog Posts</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No draft blog posts found.</p>
      ) : (
        <table className="border-border w-full border-collapse rounded-md">
          <thead>
            <tr className="border-border border-b">
              <th className="p-3 text-left text-sm font-medium">Title</th>
              <th className="p-3 text-left text-sm font-medium">Category</th>
              <th className="p-3 text-left text-sm font-medium">AI Assisted</th>
              <th className="p-3 text-left text-sm font-medium">Status</th>
              <th className="p-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-border border-b">
                <td className="p-3">{row.title}</td>
                <td className="p-3">{row.category}</td>
                <td className="p-3">
                  {row.aiAssisted ? (
                    <span className="text-indigo-600">Yes</span>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </td>
                <td className="p-3">
                  {row.status === "draft" ? (
                    <span className="text-yellow-600">Draft</span>
                  ) : (
                    <span className="text-green-600">Published</span>
                  )}
                </td>
                <td className="p-3">
                  <button className="text-indigo-600 underline">Edit</button>
                  <button className="ml-2 text-red-500 underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4">
        <button className="inline-flex items-center rounded-md border border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
          + New Blog Post
          <svg
            className="-mr-1 ml-1 h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SocialDraftsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Social Drafts</h2>
      <p className="text-muted-foreground">
        Weekly LinkedIn post drafts. No posts are published automatically.
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        Last draft week key: Not yet generated. Run the social.drafts job to
        generate drafts.
      </p>
      <div className="mt-4">
        <button
          className="inline-flex items-center rounded-md border border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          onClick={() => {
            enqueueJob({
              type: "social.drafts",
              payload: {},
              idempotencyKey: "social-drafts-manual",
            });
          }}
        >
          Generate LinkedIn Drafts Now
        </button>
      </div>
    </div>
  );
}

function NewsletterTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Newsletter</h2>
      <p className="text-muted-foreground">
        Weekly newsletter drafts for approval. Nothing is sent automatically.
      </p>
      <div className="mt-4">
        <button
          className="inline-flex items-center rounded-md border border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          onClick={() => {
            enqueueJob({
              type: "newsletter.draft",
              payload: {},
              idempotencyKey: "newsletter-draft-manual",
            });
          }}
        >
          Draft Newsletter Now
        </button>
      </div>
    </div>
  );
}
