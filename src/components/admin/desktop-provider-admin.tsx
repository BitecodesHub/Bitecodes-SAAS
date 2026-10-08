"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
} from "lucide-react";
import {
  saveDesktopProviderAction,
  saveDesktopRoutingAction,
  testDesktopProviderAction,
} from "@/lib/server/desktop/admin-actions";
import type { ProviderView } from "@/lib/server/desktop/providers";
import type { DesktopProviderId } from "@/lib/server/db/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Routing {
  enabled: boolean;
  defaultProvider: DesktopProviderId;
  fallback: DesktopProviderId[];
}

const LABEL: Record<DesktopProviderId, string> = {
  nvidia: "NVIDIA NIM",
  openrouter: "OpenRouter",
  groq: "Groq",
  bedrock: "Amazon Bedrock",
};

const KEY_HELP: Record<DesktopProviderId, string> = {
  nvidia: "build.nvidia.com → API key (nvapi-…). Free tier is rate-limited.",
  openrouter: "openrouter.ai/keys (sk-or-…).",
  groq: "console.groq.com/keys (gsk_…). Very fast; free tier is rate-limited.",
  bedrock:
    "AWS console → Amazon Bedrock → API keys (long-term keys start ABSK…). Enable model access in the chosen region.",
};

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function DesktopProviderAdmin({
  providers,
  routing,
  regions,
}: {
  providers: ProviderView[];
  routing: Routing;
  regions: { code: string; label: string }[];
}) {
  return (
    <div className="space-y-6">
      <RoutingCard routing={routing} providers={providers} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} regions={regions} />
        ))}
      </div>
    </div>
  );
}

function RoutingCard({
  routing,
  providers,
}: {
  routing: Routing;
  providers: ProviderView[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(routing.enabled);
  const [order, setOrder] = useState<DesktopProviderId[]>(() => {
    const rest = (
      ["nvidia", "openrouter", "groq", "bedrock"] as DesktopProviderId[]
    ).filter(
      (p) => p !== routing.defaultProvider && !routing.fallback.includes(p),
    );
    return [routing.defaultProvider, ...routing.fallback, ...rest];
  });
  const [active, setActive] = useState<Set<DesktopProviderId>>(
    () => new Set([routing.defaultProvider, ...routing.fallback]),
  );
  const ready = (id: DesktopProviderId) => {
    const p = providers.find((x) => x.id === id);
    return Boolean(p?.enabled && p.hasKey);
  };

  const move = (i: number, dir: -1 | 1) =>
    setOrder((o) => {
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const inChain = order.filter((p) => active.has(p));

  const save = () =>
    start(async () => {
      if (inChain.length === 0) {
        toast({ title: "Pick at least one provider", variant: "error" });
        return;
      }
      const res = await saveDesktopRoutingAction({
        enabled,
        defaultProvider: inChain[0],
        fallback: inChain.slice(1),
      });
      toast(
        res.ok
          ? { title: res.message ?? "Saved", variant: "success" }
          : {
              title: "Could not save",
              description: res.error,
              variant: "error",
            },
      );
      if (res.ok) router.refresh();
    });

  return (
    <section
      className="bg-card rounded-lg border p-5"
      aria-labelledby="routing-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="routing-heading" className="font-semibold">
            Routing
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Requests go to the first provider; if it fails before answering they
            move down the list automatically. Screenshots are read by the first
            provider with a vision model and answered by the text models in this
            order.
          </p>
        </div>
        <Switch
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Desktop app enabled"
          description={
            enabled
              ? "Signed-in desktop users can use the Bitecodes model."
              : "Desktop users see “not available”."
          }
        />
      </div>

      <ol className="mt-5 space-y-2">
        {order.map((id, i) => {
          const position = inChain.indexOf(id);
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-md border px-3 py-2"
            >
              <input
                type="checkbox"
                aria-label={`Use ${LABEL[id]}`}
                checked={active.has(id)}
                onChange={(e) =>
                  setActive((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(id);
                    else n.delete(id);
                    return n;
                  })
                }
                className="size-4"
              />
              <span className="text-muted-foreground w-24 text-xs">
                {position === 0
                  ? "Default"
                  : position > 0
                    ? `Fallback ${position}`
                    : "Not used"}
              </span>
              <span className="flex-1 font-medium">{LABEL[id]}</span>
              {active.has(id) && !ready(id) && (
                <Badge variant="muted">needs key / enable</Badge>
              )}
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Move ${LABEL[id]} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Move ${LABEL[id]} down`}
                disabled={i === order.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          Save routing
        </Button>
      </div>
    </section>
  );
}

function ProviderCard({
  provider,
  regions,
}: {
  provider: ProviderView;
  regions: { code: string; label: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(provider.enabled);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [region, setRegion] = useState(provider.region ?? "ap-southeast-2");
  const [model, setModel] = useState(provider.model);
  const [visionModel, setVisionModel] = useState(provider.visionModel);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const isBedrock = provider.id === "bedrock";

  const save = (opts: { clearKey?: boolean } = {}) =>
    start(async () => {
      const res = await saveDesktopProviderAction({
        id: provider.id,
        enabled,
        ...(opts.clearKey
          ? { apiKey: "" }
          : apiKey.trim()
            ? { apiKey: apiKey.trim() }
            : {}),
        baseUrl: isBedrock ? null : baseUrl,
        region: isBedrock ? region : null,
        model,
        visionModel,
      });
      toast(
        res.ok
          ? { title: `${LABEL[provider.id]} saved`, variant: "success" }
          : {
              title: "Could not save",
              description: res.error,
              variant: "error",
            },
      );
      if (res.ok) {
        setApiKey("");
        router.refresh();
      }
    });

  const test = () =>
    start(async () => {
      setTestResult(null);
      const res = await testDesktopProviderAction(provider.id);
      setTestResult(
        res.ok
          ? { ok: true, text: res.message ?? "OK" }
          : { ok: false, text: res.error },
      );
    });

  const id = (f: string) => `${provider.id}-${f}`;

  return (
    <section
      className="bg-card flex flex-col rounded-lg border p-5"
      aria-labelledby={id("heading")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={id("heading")} className="font-semibold">
          {LABEL[provider.id]}
        </h2>
        {provider.hasKey ? (
          <Badge variant="secondary">
            <KeyRound className="mr-1 size-3" aria-hidden="true" />…
            {provider.apiKeyHint}
          </Badge>
        ) : (
          <Badge variant="muted">No key</Badge>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <Switch
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          label="Enabled"
        />

        <div className="space-y-1.5">
          <Label htmlFor={id("key")}>API key</Label>
          <Input
            id={id("key")}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              provider.hasKey ? "Stored — leave blank to keep" : "Paste key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {KEY_HELP[provider.id]}
          </p>
        </div>

        {isBedrock ? (
          <div className="space-y-1.5">
            <Label htmlFor={id("region")}>Region</Label>
            <select
              id={id("region")}
              className={selectClass}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} — {r.code}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={id("base")}>Base URL</Label>
            <Input
              id={id("base")}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={id("model")}>Text model</Label>
          <Input
            id={id("model")}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("vision")}>Vision model (screenshots)</Label>
          <Input
            id={id("vision")}
            value={visionModel}
            placeholder="Leave blank if none"
            onChange={(e) => setVisionModel(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      {testResult && (
        <p
          role="status"
          className={`mt-4 rounded-md p-2 text-xs ${testResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}
        >
          {testResult.text}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button onClick={() => save()} disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}{" "}
          Save
        </Button>
        <Button
          variant="outline"
          onClick={test}
          disabled={pending || !provider.hasKey}
        >
          <PlugZap aria-hidden="true" /> Test
        </Button>
      </div>
      {provider.hasKey && (
        // Kept out of the button row and confirmed: removing the key immediately
        // takes this provider out of the chain for every desktop user.
        <button
          type="button"
          className="text-muted-foreground mt-3 self-start text-xs underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                `Remove the ${LABEL[provider.id]} API key? Desktop requests will stop using this provider.`,
              )
            ) {
              save({ clearKey: true });
            }
          }}
        >
          Remove stored key
        </button>
      )}
    </section>
  );
}
