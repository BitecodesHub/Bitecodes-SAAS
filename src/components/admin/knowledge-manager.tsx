"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addKnowledgeSourceAction,
  deleteKnowledgeSourceAction,
} from "@/lib/server/chatbot/actions";
import type { KnowledgeFormat } from "@/lib/chatbot/extract";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export interface KnowledgeRow {
  id: string;
  origin: string;
  type: string;
  status: "queued" | "processing" | "indexed" | "failed";
  chunkCount: number;
  error: string | null;
}

const STATUS_VARIANT: Record<string, "secondary" | "muted"> = {
  indexed: "secondary",
  processing: "muted",
  queued: "muted",
  failed: "muted",
};

const FORMATS: { value: KnowledgeFormat; label: string }[] = [
  { value: "txt", label: "Plain text" },
  { value: "md", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
];

/**
 * Knowledge-base management for one chatbot: paste or upload text content,
 * watch it index, and remove sources. Binary files (PDF/DOCX) and URL crawling
 * are handled by later slices; this covers the text formats we extract today.
 */
export function KnowledgeManager({
  chatbotId,
  sources,
}: {
  chatbotId: string;
  sources: KnowledgeRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("");
  const [format, setFormat] = useState<KnowledgeFormat>("txt");
  const [content, setContent] = useState("");

  function add() {
    if (origin.trim().length < 1 || content.trim().length < 1) return;
    start(async () => {
      const result = await addKnowledgeSourceAction({
        chatbotId,
        type: "manual",
        format,
        origin: origin.trim(),
        content,
      });
      if (result.ok) {
        toast({
          title: "Indexed",
          description: `${result.data.chunkCount} chunk(s) added.`,
          variant: "success",
        });
        setOrigin("");
        setContent("");
        router.refresh();
      } else {
        toast({
          title: "Could not add",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const result = await deleteKnowledgeSourceAction(chatbotId, id);
      if (result.ok) {
        toast({ title: "Source removed", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not remove",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="text-primary size-4" />
          Add knowledge
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste content the assistant should answer from. It is chunked and
          indexed immediately.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="k-origin">Name</Label>
            <Input
              id="k-origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Returns policy"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-format">Format</Label>
            <select
              id="k-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as KnowledgeFormat)}
              className="border-border bg-background h-9 rounded-md border px-3 text-sm"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="k-content">Content</Label>
          <Textarea
            id="k-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Paste text, markdown, HTML, JSON, or CSV…"
            className="font-mono text-sm"
          />
        </div>
        <Button
          onClick={add}
          disabled={pending || !origin.trim() || !content.trim()}
          className="mt-4"
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Index this content
        </Button>
      </section>

      <section className="border-border bg-card rounded-2xl border shadow-[var(--shadow-soft)]">
        {sources.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 p-10 text-center text-sm">
            <FileText className="size-6" />
            <p>
              No knowledge yet. Add a source above so the bot has something to
              answer from.
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.origin}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {s.type} · {s.chunkCount} chunk
                    {s.chunkCount === 1 ? "" : "s"}
                    {s.error ? ` · ${s.error}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[s.status] ?? "muted"}>
                    {s.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove(s.id)}
                    disabled={pending}
                    aria-label="Remove source"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        Retrieval (RAG) answers from these chunks once vector search is enabled.
        PDF/DOCX uploads and website crawling arrive in a later update.
      </p>
    </div>
  );
}
