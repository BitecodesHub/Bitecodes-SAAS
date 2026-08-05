"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Zap } from "lucide-react";
import {
  generateDraftAction,
  runBlogGenerateNowAction,
} from "@/lib/server/blog/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The two ways to make the AI write: a reviewed draft on a topic you type, or
 * a full generate-and-publish pass using the rotating topic bank (the same one
 * the schedule fires twice a week).
 */
export function BlogGenerateControls() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const [publishing, startPublish] = useTransition();

  function draft() {
    setMessage(null);
    startDraft(async () => {
      const result = await generateDraftAction(topic);
      if (result.ok) {
        router.push(`/admin/blog/${result.data.id}`);
      } else {
        setMessage(result.error);
      }
    });
  }

  function publishNow() {
    setMessage(null);
    startPublish(async () => {
      const result = await runBlogGenerateNowAction();
      setMessage(
        result.ok
          ? "A post is being written and published now. It will appear in the list and on /blog within a minute — refresh to see it."
          : result.error,
      );
    });
  }

  return (
    <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="text-primary size-4" />
          Write with AI
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          Type a topic to get a reviewable draft, or publish one now from the
          built-in topic plan. Every post uses only real internal links and the
          site&rsquo;s own facts.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. How to choose an AI automation partner"
          className="flex-1"
          disabled={drafting}
        />
        <Button onClick={draft} disabled={drafting || topic.trim().length < 8}>
          {drafting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Draft for review
        </Button>
        <Button variant="outline" onClick={publishNow} disabled={publishing}>
          {publishing ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Zap className="size-4" />
          )}
          Publish one now
        </Button>
      </div>

      {message && (
        <p className="border-border bg-muted/40 rounded-xl border p-3 text-sm leading-relaxed">
          {message}
        </p>
      )}
    </div>
  );
}
