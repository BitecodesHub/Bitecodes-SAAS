import type { Metadata } from "next";
import Link from "next/link";
import { requireCapability } from "@/lib/server/auth/dal";
import { listAllPosts } from "@/lib/server/blog/repository";
import { BlogGenerateControls } from "@/components/admin/blog-generate-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PenLine, Plus } from "lucide-react";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "secondary" | "muted"> = {
  published: "secondary",
  draft: "muted",
  scheduled: "muted",
  archived: "muted",
};

export default async function AdminBlogPage() {
  await requireCapability("write_content");
  const posts = await listAllPosts();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Write and publish articles — by hand or with AI. Published posts go
            live on the public blog, the sitemap, and the feeds automatically.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">
            <Plus className="size-4" />
            New post
          </Link>
        </Button>
      </header>

      <BlogGenerateControls />

      <section className="border-border bg-card rounded-2xl border shadow-[var(--shadow-soft)]">
        {posts.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 p-10 text-center text-sm">
            <PenLine className="size-6" />
            <p>
              No database posts yet. The founding articles still show on the
              public blog; anything you write or generate here joins them.
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/blog/${post.id}`}
                    className="hover:text-primary font-medium"
                  >
                    {post.title}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {post.category} · {post.date}
                    {post.aiAssisted ? " · AI-assisted" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[post.status] ?? "muted"}>
                    {post.status}
                  </Badge>
                  {post.status === "published" && (
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="text-primary text-xs underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  )}
                  <Link
                    href={`/admin/blog/${post.id}`}
                    className="text-primary text-xs underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
