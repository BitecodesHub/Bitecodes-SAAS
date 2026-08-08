"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Copy,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  createChatbotAction,
  deleteChatbotAction,
  rotatePublicTokenAction,
  setChatbotStatusAction,
} from "@/lib/server/chatbot/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface ChatbotRow {
  chatbotId: string;
  name: string;
  status: "active" | "paused";
  websiteName: string | null;
  allowedDomains: string[];
}

/**
 * Chatbot management surface for the admin panel. Lists bots, creates them,
 * shows the copy-paste embed snippet (with a freshly minted public token that
 * is shown once), and toggles/deletes. All mutations go through capability-
 * gated server actions.
 */
export function ChatbotManager({
  chatbots,
  siteUrl,
  basePath,
}: {
  chatbots: ChatbotRow[];
  siteUrl: string;
  /** `/admin` or `/app` — the same list is rendered in both areas. */
  basePath: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [domains, setDomains] = useState("");
  /** chatbotId → freshly issued public token, shown once for the snippet. */
  const [tokens, setTokens] = useState<Record<string, string>>({});

  function create() {
    if (name.trim().length < 2) return;
    start(async () => {
      const result = await createChatbotAction({
        name: name.trim(),
        allowedDomains: domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      });
      if (result.ok) {
        setTokens((t) => ({
          ...t,
          [result.data.chatbotId]: result.data.publicToken,
        }));
        setName("");
        setDomains("");
        toast({ title: "Chatbot created", variant: "success" });
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

  function toggle(id: string, status: "active" | "paused") {
    start(async () => {
      const result = await setChatbotStatusAction(id, status);
      if (result.ok) router.refresh();
      else
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
    });
  }

  function rotate(id: string) {
    start(async () => {
      const result = await rotatePublicTokenAction(id);
      if (result.ok) {
        setTokens((t) => ({ ...t, [id]: result.data.publicToken }));
        toast({
          title: "New token issued",
          description: "The old embed stops working.",
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

  function remove(id: string) {
    start(async () => {
      const result = await deleteChatbotAction(id);
      if (result.ok) {
        toast({ title: "Chatbot deleted", variant: "success" });
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

  function snippet(id: string): string {
    const token = tokens[id] ?? "PUBLIC_TOKEN";
    return `<script src="${siteUrl}/widget.js"\n  data-chatbot="${id}"\n  data-token="${token}">\n</script>`;
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
          New chatbot
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cb-name">Name</Label>
            <Input
              id="cb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Support assistant"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cb-domains">
              Allowed domains (comma-separated)
            </Label>
            <Input
              id="cb-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="example.com, *.example.com"
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
          Create chatbot
        </Button>
      </section>

      {chatbots.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border p-10 text-center text-sm shadow-[var(--shadow-soft)]">
          <Bot className="size-6" />
          <p>
            No chatbots yet. Create one above, then paste its snippet on any
            site.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {chatbots.map((bot) => (
            <li
              key={bot.chatbotId}
              className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <Link
                      href={`${basePath}/chatbots/${bot.chatbotId}`}
                      className="hover:text-primary"
                    >
                      {bot.name}
                    </Link>
                    <Badge
                      variant={bot.status === "active" ? "secondary" : "muted"}
                    >
                      {bot.status}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {bot.allowedDomains.length
                      ? bot.allowedDomains.join(", ")
                      : "No domains yet — add some so it can run."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggle(
                        bot.chatbotId,
                        bot.status === "active" ? "paused" : "active",
                      )
                    }
                    disabled={pending}
                  >
                    {bot.status === "active" ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    {bot.status === "active" ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rotate(bot.chatbotId)}
                    disabled={pending}
                  >
                    <RefreshCw className="size-4" />
                    New token
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => remove(bot.chatbotId)}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="border-border bg-muted/30 relative mt-4 overflow-x-auto rounded-xl border p-3">
                <button
                  type="button"
                  onClick={() => copy(snippet(bot.chatbotId))}
                  className="text-muted-foreground hover:text-foreground absolute top-2 right-2 inline-flex items-center gap-1 text-xs"
                >
                  <Copy className="size-3.5" /> Copy
                </button>
                <pre className="text-foreground/90 text-xs leading-relaxed">
                  <code>{snippet(bot.chatbotId)}</code>
                </pre>
              </div>
              {tokens[bot.chatbotId] ? (
                <p className="mt-2 text-xs text-amber-600">
                  Copy this now — the token is shown once and cannot be
                  retrieved later.
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">
                  Use “New token” to reveal a fresh public token for the
                  snippet.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
