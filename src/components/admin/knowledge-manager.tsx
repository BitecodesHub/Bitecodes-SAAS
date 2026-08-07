"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
 * Extension → format, for the formats `extractText` actually handles. Anything
 * absent here is rejected in the browser: the server would only reject it too,
 * and a local "we cannot read this" beats a round trip that ends in a failed
 * source row the operator then has to delete.
 */
const EXTENSION_FORMATS: Record<string, KnowledgeFormat> = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
  json: "json",
  csv: "csv",
};

const ACCEPT = ".txt,.text,.md,.markdown,.html,.htm,.json,.csv";

/** The cap `addKnowledgeSourceAction` itself enforces. */
const MAX_CONTENT_CHARS = 500_000;
/**
 * UTF-8 never uses fewer than one byte per character, so a file inside this
 * byte budget is always inside the character budget too — one number, checked
 * before the file is read rather than after a wasted round trip.
 */
const MAX_FILE_BYTES = MAX_CONTENT_CHARS;
const MAX_LABEL = "500 KB";

/**
 * Character budget for one Q&A pair, mirroring `chunkText`'s defaults (a 500
 * token target at ~4 characters per token). Pairs are emitted as single
 * paragraphs, and the chunker only ever splits a paragraph that exceeds the
 * target — so a pair under this length is guaranteed to reach retrieval with
 * its question and answer still together.
 */
const PAIR_CHAR_BUDGET = 2000;

interface QaPair {
  question: string;
  answer: string;
}

/** Bytes → a short human figure for the file summary line. */
function formatBytes(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : `${(bytes / 1024).toLocaleString("en-GB", {
        maximumFractionDigits: 1,
      })} KB`;
}

/**
 * Renders pairs as `Q:` / `A:` lines separated by blank lines. The single
 * newline inside a pair and the blank line between pairs are load-bearing:
 * `chunkText` splits on blank lines, so each pair becomes one indivisible unit
 * and no chunk boundary can land between a question and its answer.
 */
function formatPairs(pairs: QaPair[]): string {
  return pairs
    .map((p) => `Q: ${p.question.trim()}\nA: ${p.answer.trim()}`)
    .join("\n\n");
}

/**
 * Knowledge-base management for one chatbot: paste text, upload a text file, or
 * enter Q&A pairs; watch each source index; remove sources.
 *
 * Uploads are read in the browser with the File API and submitted as text, so
 * the server keeps its single text-in contract and we need no upload endpoint.
 * Binary files (PDF/DOCX) and URL crawling are not supported server-side, so no
 * control is offered for them.
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

  // File path: the text is read once, on pick, and held here until submitted.
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBytes, setFileBytes] = useState(0);
  const [fileText, setFileText] = useState("");
  const [reading, setReading] = useState(false);

  // FAQ path: several pairs are collected before a single source is written.
  const [pairs, setPairs] = useState<QaPair[]>([]);
  const [draft, setDraft] = useState<QaPair>({ question: "", answer: "" });

  /** Two-step delete: id awaiting confirmation, since removal is permanent. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const draftReady =
    draft.question.trim().length > 0 && draft.answer.trim().length > 0;
  // Operators forget to press "Add pair"; a complete draft still gets saved.
  const allPairs = draftReady ? [...pairs, draft] : pairs;

  function ingest(
    type: "manual" | "file" | "faq",
    body: string,
    bodyFormat: KnowledgeFormat,
    clear: () => void,
  ) {
    const name = origin.trim();
    if (!name || !body.trim()) return;
    if (body.length > MAX_CONTENT_CHARS) {
      toast({
        title: "Too much content",
        description: `Keep a single source under ${MAX_CONTENT_CHARS.toLocaleString()} characters (about ${MAX_LABEL}). Split it into a few sources.`,
        variant: "error",
      });
      return;
    }
    start(async () => {
      const result = await addKnowledgeSourceAction({
        chatbotId,
        type,
        format: bodyFormat,
        origin: name,
        content: body,
      });
      if (result.ok) {
        toast({
          title: "Indexed",
          description: `${result.data.chunkCount} chunk(s) added.`,
          variant: "success",
        });
        setOrigin("");
        clear();
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

  function addManual() {
    ingest("manual", content, format, () => setContent(""));
  }

  function addFile() {
    ingest("file", fileText, format, () => {
      setFileText("");
      setFileName(null);
      setFileBytes(0);
    });
  }

  function addFaq() {
    // Plain text, not markdown: extraction treats them identically and the
    // Q:/A: prefixes are the only structure retrieval needs.
    ingest("faq", formatPairs(allPairs), "txt", () => {
      setPairs([]);
      setDraft({ question: "", answer: "" });
    });
  }

  async function pickFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    // Reset the element so re-picking the same file fires `change` again.
    input.value = "";
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const inferred = EXTENSION_FORMATS[extension];
    if (!inferred) {
      setFileName(null);
      setFileText("");
      setFileBytes(0);
      toast({
        title: "Unsupported file",
        description: `We can read .txt, .md, .html, .json and .csv. Export “${file.name}” to one of those first — PDF and DOCX need a parser we have not enabled.`,
        variant: "error",
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileName(null);
      setFileText("");
      setFileBytes(0);
      toast({
        title: "File too large",
        description: `“${file.name}” is ${formatBytes(file.size)}. The limit is ${MAX_LABEL} per source — split it and upload the parts.`,
        variant: "error",
      });
      return;
    }

    setReading(true);
    try {
      const text = await file.text();
      if (!text.trim()) {
        toast({
          title: "Nothing to index",
          description: `“${file.name}” appears to be empty.`,
          variant: "error",
        });
        return;
      }
      setFileName(file.name);
      setFileBytes(file.size);
      setFileText(text);
      setFormat(inferred);
      // Only pre-fill the name if the operator has not written their own.
      setOrigin((current) => (current.trim() ? current : file.name));
    } catch {
      toast({
        title: "Could not read that file",
        description: "Check it is still on disk and try again.",
        variant: "error",
      });
    } finally {
      setReading(false);
    }
  }

  function remove(id: string) {
    start(async () => {
      const result = await deleteKnowledgeSourceAction(chatbotId, id);
      if (result.ok) {
        setConfirming(null);
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

  const formatSelect = (id: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Format</Label>
      <select
        id={id}
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
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="text-primary size-4" />
          Add knowledge
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Give the assistant something to answer from. Every source is chunked
          and indexed immediately.
        </p>

        <Tabs defaultValue="manual" className="mt-4">
          <TabsList className="rounded-xl p-1">
            <TabsTrigger value="manual" className="rounded-lg px-3 py-1.5">
              <FileText className="mr-1.5 size-4" />
              Paste text
            </TabsTrigger>
            <TabsTrigger value="file" className="rounded-lg px-3 py-1.5">
              <Upload className="mr-1.5 size-4" />
              Upload a file
            </TabsTrigger>
            <TabsTrigger value="faq" className="rounded-lg px-3 py-1.5">
              <HelpCircle className="mr-1.5 size-4" />
              Q&amp;A pairs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="k-origin">Name</Label>
                <Input
                  id="k-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Returns policy"
                />
              </div>
              {formatSelect("k-format", "How the pasted text is parsed.")}
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
              onClick={addManual}
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
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="k-file">File</Label>
              <input
                id="k-file"
                type="file"
                accept={ACCEPT}
                onChange={(e) => void pickFile(e.currentTarget)}
                disabled={pending || reading}
                className="border-border bg-background file:bg-muted file:text-foreground hover:file:bg-muted/70 block w-full rounded-md border px-3 py-1.5 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:px-2.5 file:py-1 file:text-sm"
              />
              <p className="text-muted-foreground text-xs">
                .txt, .md, .html, .json or .csv, up to {MAX_LABEL}. The file is
                read in your browser and its text is sent — nothing is stored as
                a file. PDF and DOCX are not supported yet; export them to text
                first.
              </p>
            </div>

            {reading && (
              <p
                role="status"
                className="text-muted-foreground mt-3 flex items-center gap-2 text-sm"
              >
                <Loader2 className="size-4 animate-spin" />
                Reading the file…
              </p>
            )}

            {fileName && (
              <>
                <p className="border-border bg-muted/40 mt-3 rounded-xl border p-3 text-sm">
                  <span className="font-medium">{fileName}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatBytes(fileBytes)} ·{" "}
                    {fileText.length.toLocaleString()} characters read
                  </span>
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor="k-file-origin">Name</Label>
                    <Input
                      id="k-file-origin"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder={fileName}
                    />
                  </div>
                  {formatSelect(
                    "k-file-format",
                    "Inferred from the extension — change it if the contents differ.",
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="k-file-preview">What will be indexed</Label>
                  <Textarea
                    id="k-file-preview"
                    value={fileText}
                    readOnly
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              </>
            )}

            <Button
              onClick={addFile}
              disabled={
                pending || reading || !fileText.trim() || !origin.trim()
              }
              className="mt-4"
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Index this file
            </Button>
          </TabsContent>

          <TabsContent value="faq" className="mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="k-faq-origin">Name</Label>
              <Input
                id="k-faq-origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Delivery FAQ"
              />
            </div>

            {pairs.length > 0 && (
              <ul className="divide-border border-border mt-3 divide-y rounded-xl border">
                {pairs.map((pair, i) => (
                  <li
                    key={`${i}-${pair.question}`}
                    className="flex items-start justify-between gap-3 p-3"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{pair.question}</p>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">
                        {pair.answer}
                      </p>
                      {pair.question.length + pair.answer.length >
                        PAIR_CHAR_BUDGET && (
                        <p className="mt-1 text-xs text-amber-600">
                          Long enough that it may be split across chunks. A
                          shorter answer retrieves better.
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        setPairs((p) => p.filter((_, j) => j !== i))
                      }
                      disabled={pending}
                      aria-label={`Remove the pair “${pair.question}”`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 space-y-1.5">
              <Label htmlFor="k-faq-question">Question</Label>
              <Input
                id="k-faq-question"
                value={draft.question}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, question: e.target.value }))
                }
                placeholder="How long does delivery take?"
              />
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="k-faq-answer">Answer</Label>
              <Textarea
                id="k-faq-answer"
                value={draft.answer}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, answer: e.target.value }))
                }
                rows={4}
                placeholder="Two to three working days across the UK, next day if ordered before 2pm."
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!draftReady) return;
                  setPairs((p) => [...p, draft]);
                  setDraft({ question: "", answer: "" });
                }}
                disabled={pending || !draftReady}
              >
                <Plus className="size-4" />
                Add pair
              </Button>
              <Button
                onClick={addFaq}
                disabled={pending || allPairs.length === 0 || !origin.trim()}
              >
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <HelpCircle className="size-4" />
                )}
                Index {allPairs.length} pair{allPairs.length === 1 ? "" : "s"}
              </Button>
              <p className="text-muted-foreground text-xs">
                Saved as one source, with each question kept beside its answer
                so a pair is never split between chunks.
              </p>
            </div>
          </TabsContent>
        </Tabs>
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
                  </p>
                  {s.error && (
                    <p className="text-destructive mt-0.5 text-xs">{s.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[s.status] ?? "muted"}>
                    {s.status}
                  </Badge>
                  {confirming === s.id ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">
                        Delete this source and its chunks?
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => remove(s.id)}
                        disabled={pending}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(null)}
                      >
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setConfirming(s.id)}
                      disabled={pending}
                      aria-label={`Remove ${s.origin}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        Retrieval (RAG) answers from these chunks once vector search is enabled.
        Binary files (PDF, DOCX) and website or sitemap crawling are not
        supported yet — convert those to text and add them above.
      </p>
    </div>
  );
}
