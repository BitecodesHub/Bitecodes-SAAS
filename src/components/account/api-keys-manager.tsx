"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import {
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/lib/server/chatbot/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  lastUsedAtIso: string | null;
  createdAtIso: string;
}

/**
 * API key management.
 *
 * The secret is shown **once**, at creation, because only its SHA-256 is stored.
 * That is not a limitation to apologise for — it is why a database leak does not
 * hand over working keys — but it does mean the UI has to be emphatic about it,
 * because somebody who closes this panel without copying has lost the key and
 * must issue another.
 *
 * `createApiKeyAction` and `revokeApiKeyAction` have existed since the REST API
 * shipped, and until now nothing rendered them: the routes documented "creating
 * and revoking keys is done in the dashboard", and the dashboard had no such
 * page. Every REST endpoint and the email API were therefore unreachable by
 * anybody, because there was no way to obtain a key.
 */
export function ApiKeysManager({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<{ secret: string; name: string } | null>(
    null,
  );

  function create() {
    const label = name.trim() || "API key";
    start(async () => {
      const result = await createApiKeyAction(label);
      if (result.ok) {
        setIssued({ secret: result.data.secret, name: label });
        setName("");
        router.refresh();
      } else {
        toast({
          title: "Could not create a key",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  function revoke(id: string) {
    start(async () => {
      const result = await revokeApiKeyAction(id);
      if (result.ok) {
        toast({ title: "Key revoked", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not revoke",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", variant: "success" });
    } catch {
      // Clipboard access is denied in some contexts. The value is on screen and
      // selectable, so this is a missing convenience rather than a failure.
      toast({ title: "Select the key and copy it", variant: "error" });
    }
  }

  return (
    <div className="space-y-5">
      {issued && (
        <section
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950"
        >
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            Copy “{issued.name}” now
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
            This is the only time this key will be shown. We store a hash of it,
            not the key itself, so it cannot be shown again — if you lose it,
            revoke it and create another.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="border-border bg-background min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-sm">
              {issued.secret}
            </code>
            <Button onClick={() => copy(issued.secret)} variant="outline">
              <Copy aria-hidden="true" className="size-4" />
              Copy
            </Button>
            <Button onClick={() => setIssued(null)} variant="ghost">
              I have saved it
            </Button>
          </div>
        </section>
      )}

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <KeyRound aria-hidden="true" className="text-primary size-4" />
          API keys
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
          One key per application, so losing one does not mean rotating them
          all. Send it as{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            Authorization: Bearer …
          </code>
          .
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label htmlFor="api-key-name">What is it for?</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production server"
              maxLength={80}
            />
          </div>
          <Button onClick={create} disabled={pending}>
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <Plus aria-hidden="true" className="size-4" />
            )}
            Create key
          </Button>
        </div>

        {keys.length === 0 ? (
          <p className="text-muted-foreground mt-5 text-sm">
            No keys yet. Create one to call the REST API or send email from your
            own application.
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{key.name}</span>
                    <code className="text-muted-foreground font-mono text-xs">
                      {key.prefix}…
                    </code>
                    {key.status !== "active" && (
                      <Badge variant="muted">{key.status}</Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {key.scopes.join(", ") || "no scopes"} ·{" "}
                    {key.lastUsedAtIso
                      ? `last used ${new Date(key.lastUsedAtIso).toLocaleDateString()}`
                      : "never used"}
                  </p>
                </div>
                {key.status === "active" && (
                  <Button
                    onClick={() => revoke(key.id)}
                    disabled={pending}
                    variant="outline"
                    size="sm"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
