"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { EmailBlock } from "@/lib/email/template";
import {
  previewTemplateAction,
  resetTemplateAction,
  sendTestEmailAction,
  updateTemplateAction,
} from "@/lib/server/email/actions";

/**
 * The template editor.
 *
 * Blocks rather than a rich-text field or raw HTML, for a reason that matters in
 * email specifically: the renderer produces both an HTML and a plain-text version
 * from the same source, and it escapes every interpolated value. A free-text HTML
 * editor would break both — there would be no reliable text alternative (which
 * hurts deliverability), and a template author could inject markup around values
 * harvested from OpenStreetMap.
 *
 * The preview is rendered **on the server** by the same function that renders a
 * real send, rather than approximated in the browser. A preview that can differ
 * from what actually goes out is worse than no preview.
 */

interface TemplateEditorProps {
  templateKey: string;
  initial: {
    name: string;
    description: string;
    subject: string;
    blocks: EmailBlock[];
    enabled: boolean;
    isDefault: boolean;
  };
  variables: Array<{ name: string; description: string; example: string }>;
  canSend: boolean;
  /** Pre-filled test recipient. */
  defaultTestAddress: string;
}

type BlockType = EmailBlock["type"];

const BLOCK_LABELS: Record<BlockType, string> = {
  p: "Paragraph",
  h2: "Heading",
  ul: "Bullet list",
  cta: "Button",
  signature: "Signature",
};

function emptyBlock(type: BlockType): EmailBlock {
  switch (type) {
    case "p":
      return { type: "p", text: "" };
    case "h2":
      return { type: "h2", text: "" };
    case "ul":
      return { type: "ul", items: [""] };
    case "cta":
      return { type: "cta", label: "See what I found", url: "{{reportUrl}}" };
    case "signature":
      return { type: "signature", text: "{{senderName}}, {{companyName}}" };
  }
}

export function TemplateEditor({
  templateKey,
  initial,
  variables,
  canSend,
  defaultTestAddress,
}: TemplateEditorProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [subject, setSubject] = useState(initial.subject);
  const [blocks, setBlocks] = useState<EmailBlock[]>(initial.blocks);
  const [enabled, setEnabled] = useState(initial.enabled);

  const [preview, setPreview] = useState<{
    subject: string;
    html: string;
    text: string;
    missing: string[];
  } | null>(null);
  const [testAddress, setTestAddress] = useState(defaultTestAddress);
  const [pending, startTransition] = useTransition();

  // Debounced server-side preview. Keyed by a token so a slow response for
  // earlier text cannot overwrite the preview for what is on screen now.
  const previewToken = useRef(0);
  useEffect(() => {
    const token = ++previewToken.current;
    const timer = setTimeout(async () => {
      const result = await previewTemplateAction({ subject, blocks });
      if (token !== previewToken.current) return;
      if (result.ok) setPreview(result.data);
    }, 500);
    return () => clearTimeout(timer);
  }, [subject, blocks]);

  const updateBlock = useCallback((index: number, next: EmailBlock) => {
    setBlocks((current) =>
      current.map((block, position) => (position === index ? next : block)),
    );
  }, []);

  const moveBlock = useCallback((index: number, direction: -1 | 1) => {
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }, []);

  const removeBlock = useCallback((index: number) => {
    setBlocks((current) => current.filter((_, position) => position !== index));
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    setBlocks((current) => [...current, emptyBlock(type)]);
  }, []);

  const save = useCallback(() => {
    startTransition(async () => {
      const result = await updateTemplateAction({
        key: templateKey,
        name,
        description,
        subject,
        blocks,
        enabled,
      });

      if (!result.ok) {
        toast({
          title: "Not saved",
          description: result.error,
          variant: "error",
        });
        return;
      }

      const unknown = result.data.unknownVariables;
      toast({
        title: "Template saved",
        description:
          unknown.length > 0
            ? `Heads up: ${unknown.map((v) => `{{${v}}}`).join(", ")} ${
                unknown.length === 1 ? "is" : "are"
              } not a variable the sender supplies, so ${
                unknown.length === 1 ? "it" : "they"
              } will render as nothing.`
            : "This template is now yours — future updates to the shipped default will not overwrite it.",
        variant: unknown.length > 0 ? "warning" : "success",
      });
      router.refresh();
    });
  }, [templateKey, name, description, subject, blocks, enabled, router, toast]);

  const reset = useCallback(() => {
    startTransition(async () => {
      const result = await resetTemplateAction(templateKey);
      if (!result.ok) {
        toast({
          title: "Not reset",
          description: result.error,
          variant: "error",
        });
        return;
      }
      toast({
        title: "Restored to the shipped default",
        description: "Reload to see the original wording.",
        variant: "success",
      });
      router.refresh();
    });
  }, [templateKey, router, toast]);

  const sendTest = useCallback(() => {
    startTransition(async () => {
      const result = await sendTestEmailAction({
        key: templateKey,
        to: testAddress,
      });
      if (!result.ok) {
        toast({
          title: "Test not sent",
          description: result.error,
          variant: "error",
        });
        return;
      }
      toast({
        title: `Test sent to ${testAddress}`,
        description:
          "Sent as transactional, so it does not touch the outreach daily cap. Save first if you changed the wording.",
        variant: "success",
      });
    });
  }, [templateKey, testAddress, toast]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Editor */}
      <div className="space-y-4">
        <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Details</h2>
            <div className="flex items-center gap-3">
              {initial.isDefault ? (
                <Badge variant="muted">Shipped default</Badge>
              ) : (
                <Badge variant="secondary">Edited by you</Badge>
              )}
              <Switch
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                label={enabled ? "In use" : "Switched off"}
              />
            </div>
          </div>

          {!enabled && (
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              While this is off, customers with this tag are skipped entirely
              rather than falling back to another template.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">
              What this is for
              <span className="text-muted-foreground ml-1 font-normal">
                (only you see this)
              </span>
            </Label>
            <Textarea
              id="template-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
            <p
              className={
                subject.length > 78
                  ? "text-destructive text-xs"
                  : "text-muted-foreground text-xs"
              }
            >
              {subject.length} characters
              {subject.length > 78
                ? " — over 78 gets cut off in most inboxes"
                : ""}
            </p>
          </div>
        </section>

        <section className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Body</h2>

          {blocks.map((block, index) => (
            <div
              key={index}
              className="border-border bg-muted/20 space-y-2 rounded-xl border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {BLOCK_LABELS[block.type]}
                </span>
                <div className="flex items-center gap-0.5">
                  <IconButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => moveBlock(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={index === blocks.length - 1}
                    onClick={() => moveBlock(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Delete this block"
                    disabled={blocks.length === 1}
                    onClick={() => removeBlock(index)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>

              {(block.type === "p" ||
                block.type === "h2" ||
                block.type === "signature") && (
                <Textarea
                  rows={block.type === "p" ? 3 : 2}
                  value={block.text}
                  aria-label={BLOCK_LABELS[block.type]}
                  onChange={(event) =>
                    updateBlock(index, { ...block, text: event.target.value })
                  }
                />
              )}

              {block.type === "ul" && (
                <div className="space-y-1.5">
                  {block.items.map((item, itemIndex) => (
                    <Input
                      key={itemIndex}
                      value={item}
                      aria-label={`Bullet ${itemIndex + 1}`}
                      onChange={(event) =>
                        updateBlock(index, {
                          ...block,
                          items: block.items.map((existing, position) =>
                            position === itemIndex
                              ? event.target.value
                              : existing,
                          ),
                        })
                      }
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateBlock(index, {
                        ...block,
                        items: [...block.items, ""],
                      })
                    }
                  >
                    <Plus className="size-4" />
                    Add bullet
                  </Button>
                </div>
              )}

              {block.type === "cta" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={block.label}
                    aria-label="Button text"
                    placeholder="Button text"
                    onChange={(event) =>
                      updateBlock(index, {
                        ...block,
                        label: event.target.value,
                      })
                    }
                  />
                  <Input
                    value={block.url}
                    aria-label="Button link"
                    placeholder="{{reportUrl}}"
                    onChange={(event) =>
                      updateBlock(index, { ...block, url: event.target.value })
                    }
                  />
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Add a block"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  addBlock(event.target.value as BlockType);
                  event.currentTarget.value = "";
                }
              }}
            >
              <option value="">Add a block…</option>
              {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                <option key={type} value={type}>
                  {BLOCK_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>
        </section>

        <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Variables you can use</h2>
          <p className="text-muted-foreground text-xs">
            Type these in the subject or any block. Values are filled per
            customer and always escaped.
          </p>
          <dl className="divide-border divide-y text-sm">
            {variables.map((variable) => (
              <div key={variable.name} className="py-2">
                <dt className="font-mono text-xs">{`{{${variable.name}}}`}</dt>
                <dd className="text-muted-foreground mt-0.5 text-xs">
                  {variable.description}{" "}
                  <span className="text-foreground">
                    e.g. {variable.example}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
          {!initial.isDefault && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={reset}
            >
              <RotateCcw className="size-4" />
              Restore the default
            </Button>
          )}
        </div>
      </div>

      {/* Preview and test */}
      <div className="space-y-4">
        <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Preview</h2>
            <span className="text-muted-foreground text-xs">
              Rendered by the server, with example values
            </span>
          </div>

          {preview?.missing && preview.missing.length > 0 && (
            <p className="text-destructive flex items-start gap-2 text-sm">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {preview.missing.map((name) => `{{${name}}}`).join(", ")} will
                render as nothing. Check the spelling against the list on the
                left.
              </span>
            </p>
          )}

          <p className="border-border bg-muted/30 rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Subject: </span>
            {preview?.subject ?? subject}
          </p>

          {/*
            The rendered email is shown in a sandboxed iframe rather than injected
            with dangerouslySetInnerHTML. The markup is ours, but it embeds values
            and a template body an operator typed, and an email preview is not
            worth handing script execution to the admin page.
          */}
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview?.html ?? "<p>Rendering…</p>"}
            className="border-border h-[520px] w-full rounded-xl border bg-white"
          />
        </section>

        <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-base font-semibold">Plain-text version</h2>
          <p className="text-muted-foreground text-xs">
            Sent alongside the HTML. Some recipients only ever see this, and its
            absence hurts deliverability.
          </p>
          <pre className="border-border bg-muted/30 max-h-72 overflow-auto rounded-xl border p-3 text-xs whitespace-pre-wrap">
            {preview?.text ?? "Rendering…"}
          </pre>
        </section>

        {canSend && (
          <section className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
            <h2 className="text-base font-semibold">Send yourself a test</h2>
            <p className="text-muted-foreground text-xs">
              Uses the saved version, not what is on screen. Save first if you
              have made changes.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-1.5">
                <Label htmlFor="test-address">Send to</Label>
                <Input
                  id="test-address"
                  type="email"
                  value={testAddress}
                  onChange={(event) => setTestAddress(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || testAddress.trim().length < 5}
                onClick={sendTest}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send test
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring grid size-7 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
