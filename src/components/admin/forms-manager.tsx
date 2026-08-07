"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Copy,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  createFormAction,
  deleteFormAction,
  rotateFormTokenAction,
  setFormStatusAction,
} from "@/lib/server/forms/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface FormRow {
  formId: string;
  name: string;
  status: "active" | "paused";
  allowedDomains: string[];
  submissionCount: number;
  fieldCount: number;
}

/**
 * Forms list and creation, with the copy-paste embed snippets.
 *
 * The public token is revealed once — on creation or after an explicit rotation
 * — because only its hash is stored. The snippet shows a placeholder until then,
 * which is honest about what we can and cannot re-display.
 */
export function FormsManager({
  forms,
  siteUrl,
}: {
  forms: FormRow[];
  siteUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  const [notify, setNotify] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});

  function create() {
    if (name.trim().length < 2) return;
    start(async () => {
      const result = await createFormAction({
        name: name.trim(),
        allowedDomains: domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        notifyEmails: notify
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
      });
      if (result.ok) {
        setTokens((t) => ({
          ...t,
          [result.data.formId]: result.data.publicToken,
        }));
        setName("");
        setDomains("");
        setNotify("");
        toast({ title: "Form created", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not create",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function toggle(formId: string, status: "active" | "paused") {
    start(async () => {
      const result = await setFormStatusAction(formId, status);
      if (result.ok) router.refresh();
      else
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
    });
  }

  function rotate(formId: string) {
    start(async () => {
      const result = await rotateFormTokenAction(formId);
      if (result.ok) {
        setTokens((t) => ({ ...t, [formId]: result.data.publicToken }));
        toast({
          title: "New token issued",
          description: "Update your embed — the old token no longer works.",
          variant: "success",
        });
      } else {
        toast({
          title: "Could not rotate",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function remove(formId: string) {
    start(async () => {
      const result = await deleteFormAction(formId);
      if (result.ok) {
        toast({ title: "Form deleted", variant: "success" });
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

  function scriptSnippet(formId: string): string {
    const token = tokens[formId] ?? "PUBLIC_TOKEN";
    return `<script src="${siteUrl}/form-widget.js"\n  data-form="${formId}"\n  data-token="${token}">\n</script>`;
  }

  function iframeSnippet(formId: string): string {
    const token = tokens[formId] ?? "PUBLIC_TOKEN";
    return `<iframe src="${siteUrl}/form/${formId}?t=${token}"\n  style="width:100%;max-width:560px;height:620px;border:0"\n  title="Form"></iframe>`;
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    toast({ title: "Copied", variant: "success" });
  }

  return (
    <div className="space-y-6">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="text-primary size-4" />
          New form
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-name">Name</Label>
            <Input
              id="f-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact us"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-domains">Allowed domains</Label>
            <Input
              id="f-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="example.com, *.example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-notify">Notify emails</Label>
            <Input
              id="f-notify"
              value={notify}
              onChange={(e) => setNotify(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>
        <Button
          onClick={create}
          disabled={pending || name.trim().length < 2}
          className="mt-4"
        >
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Create form
        </Button>
      </section>

      {forms.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border p-10 text-center text-sm shadow-[var(--shadow-soft)]">
          <ClipboardList className="size-6" />
          <p>
            No forms yet. Create one above, then paste its snippet on any site.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {forms.map((form) => (
            <li
              key={form.formId}
              className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <Link
                      href={`/admin/forms/${form.formId}`}
                      className="hover:text-primary"
                    >
                      {form.name}
                    </Link>
                    <Badge
                      variant={form.status === "active" ? "secondary" : "muted"}
                    >
                      {form.status}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {form.fieldCount} field{form.fieldCount === 1 ? "" : "s"} ·{" "}
                    {form.submissionCount} submission
                    {form.submissionCount === 1 ? "" : "s"} ·{" "}
                    {form.allowedDomains.length
                      ? form.allowedDomains.join(", ")
                      : "no domains yet"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggle(
                        form.formId,
                        form.status === "active" ? "paused" : "active",
                      )
                    }
                    disabled={pending}
                  >
                    {form.status === "active" ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {form.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rotate(form.formId)}
                    disabled={pending}
                  >
                    <RefreshCw className="size-4" />
                    New token
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove(form.formId)}
                    disabled={pending}
                    aria-label="Delete form"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {[
                  { label: "Script embed", code: scriptSnippet(form.formId) },
                  { label: "Iframe embed", code: iframeSnippet(form.formId) },
                ].map((snippet) => (
                  <div
                    key={snippet.label}
                    className="border-border bg-muted/30 relative overflow-x-auto rounded-xl border p-3"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        {snippet.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(snippet.code)}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                      >
                        <Copy className="size-3.5" /> Copy
                      </button>
                    </div>
                    <pre className="text-foreground/90 text-xs leading-relaxed">
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                ))}
              </div>

              {tokens[form.formId] ? (
                <p className="mt-2 text-xs text-amber-600">
                  Copy the snippet now — the token is shown once and cannot be
                  retrieved later.
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  Use “New token” to reveal a fresh public token for the
                  snippets.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
