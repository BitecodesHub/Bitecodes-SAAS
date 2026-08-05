"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import {
  createPostAction,
  updatePostAction,
  deletePostAction,
  setPostStatusAction,
  type BlogPostInput,
} from "@/lib/server/blog/actions";
import { blocksToText, textToBlocks } from "@/lib/blog-text";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BlogBlock } from "@/types/content";

export interface EditorPost {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  metaDescription: string | null;
  body: BlogBlock[];
  faq: { question: string; answer: string }[];
  internalLinks: { label: string; path: string }[];
  readingMinutes: number;
  featured: boolean;
  status: "draft" | "published" | "archived";
  aiAssisted: boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * The post editor. Metadata as fields, body as a markdown-lite textarea (the
 * bridge in `lib/blog-text.ts`), FAQ and internal links preserved as hidden
 * state so an AI draft's structure survives an edit. Non-body block types
 * (quote/code/cta) are also carried through untouched.
 */
export function BlogEditor({ post }: { post: EditorPost }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [category, setCategory] = useState(post.category);
  const [tags, setTags] = useState(post.tags.join(", "));
  const [metaDescription, setMetaDescription] = useState(
    post.metaDescription ?? "",
  );
  const [bodyText, setBodyText] = useState(blocksToText(post.body));
  const [featured, setFeatured] = useState(post.featured);

  // Blocks the textarea does not round-trip (cta/code/quote-with-attribution)
  // are kept verbatim and appended, so editing prose never drops them.
  const preservedBlocks = post.body.filter(
    (b) => b.type === "cta" || b.type === "code",
  );

  function collect(status: EditorPost["status"]): BlogPostInput & {
    status: EditorPost["status"];
  } {
    const bodyFromText = textToBlocks(bodyText);
    return {
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      excerpt: excerpt.trim(),
      category: category.trim() || "Engineering",
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      metaDescription: metaDescription.trim() || null,
      body: [...bodyFromText, ...preservedBlocks],
      faq: post.faq,
      internalLinks: post.internalLinks,
      readingMinutes: Math.max(
        1,
        Math.round(bodyText.split(/\s+/).filter(Boolean).length / 200),
      ),
      featured,
      status,
    };
  }

  function save(status: EditorPost["status"]) {
    start(async () => {
      const payload = collect(status);
      const result = post.id
        ? await updatePostAction(post.id, payload)
        : await createPostAction(
            payload as BlogPostInput & { status: "draft" | "published" },
          );
      if (result.ok) {
        toast({
          title:
            status === "published"
              ? "Published"
              : status === "archived"
                ? "Archived"
                : "Saved",
          variant: "success",
        });
        router.push("/admin/blog");
        router.refresh();
      } else {
        toast({
          title: "Could not save",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function quickStatus(status: EditorPost["status"]) {
    if (!post.id) return;
    start(async () => {
      const result = await setPostStatusAction(post.id!, status);
      if (result.ok) {
        toast({ title: `Marked ${status}`, variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function remove() {
    if (!post.id) return;
    start(async () => {
      const result = await deletePostAction(post.id!);
      if (result.ok) {
        toast({ title: "Deleted", variant: "success" });
        router.push("/admin/blog");
        router.refresh();
      } else {
        toast({
          title: "Could not delete",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      {post.aiAssisted && (
        <p className="border-border bg-muted/40 rounded-xl border p-3 text-sm">
          This draft was written with AI. Review it before publishing — you are
          the editor of record.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!post.id) setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={Boolean(post.id)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="excerpt">Excerpt</Label>
          <Textarea
            id="excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="meta">Meta description</Label>
          <Textarea
            id="meta"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Body</Label>
        <p className="text-muted-foreground text-xs">
          Plain text. <code>## Heading</code>, <code>### Subheading</code>,{" "}
          <code>- bullet</code>, <code>1. numbered</code>; blank lines separate
          paragraphs.
        </p>
        <Textarea
          id="body"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={22}
          className="font-mono text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={featured}
          onChange={(e) => setFeatured(e.target.checked)}
        />
        Feature this post
      </label>

      <div className="border-border flex flex-wrap items-center gap-2 border-t pt-5">
        <Button
          onClick={() => save("published")}
          disabled={pending}
          variant="gradient"
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {post.status === "published" ? "Save & keep live" : "Publish"}
        </Button>
        <Button
          onClick={() => save("draft")}
          disabled={pending}
          variant="outline"
        >
          Save as draft
        </Button>
        {post.id && post.status === "published" && (
          <Button
            onClick={() => quickStatus("archived")}
            disabled={pending}
            variant="ghost"
          >
            Unpublish
          </Button>
        )}
        {post.id && (
          <Button
            onClick={remove}
            disabled={pending}
            variant="ghost"
            className="text-destructive ml-auto"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
