"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  setDefaultModelAction,
  setModelEnabledAction,
} from "@/lib/server/chatbot/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export interface ModelRow {
  key: string;
  label: string;
  provider: string;
  inCostPerMTok: number;
  outCostPerMTok: number;
  maxContext: number;
  enabled: boolean;
  isDefault: boolean;
}

/**
 * Admin control over which AI models customers may pick, their per-token
 * costs, and which is the platform default. Enable/disable and default are the
 * everyday controls; costs feed the token ledger's pricing.
 */
export function ModelCatalog({ models }: { models: ModelRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function toggle(key: string, enabled: boolean) {
    start(async () => {
      const result = await setModelEnabledAction(key, enabled);
      if (result.ok) router.refresh();
      else
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
    });
  }

  function makeDefault(key: string) {
    start(async () => {
      const result = await setDefaultModelAction(key);
      if (result.ok) {
        toast({ title: "Default model set", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not set default",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="border-border bg-card overflow-x-auto rounded-2xl border shadow-[var(--shadow-soft)]">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-border border-b text-left text-xs">
          <tr>
            <th className="p-3 font-medium">Model</th>
            <th className="p-3 font-medium">Cost /1M (in / out)</th>
            <th className="p-3 font-medium">Context</th>
            <th className="p-3 font-medium">Default</th>
            <th className="p-3 text-right font-medium">Enabled</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {models.map((m) => (
            <tr key={m.key}>
              <td className="p-3">
                <p className="font-medium">{m.label}</p>
                <p className="text-muted-foreground text-xs">
                  {m.provider} · {m.key}
                </p>
              </td>
              <td className="p-3 tabular-nums">
                {m.inCostPerMTok} / {m.outCostPerMTok}
              </td>
              <td className="p-3 tabular-nums">
                {m.maxContext.toLocaleString()}
              </td>
              <td className="p-3">
                {m.isDefault ? (
                  <Badge variant="secondary">
                    <CheckCircle2 className="mr-1 size-3.5" /> Default
                  </Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => makeDefault(m.key)}
                    disabled={pending || !m.enabled}
                  >
                    {pending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Circle className="size-3.5" />
                    )}
                    Make default
                  </Button>
                )}
              </td>
              <td className="p-3">
                <div className="flex justify-end">
                  <Switch
                    checked={m.enabled}
                    onChange={(e) => toggle(m.key, e.target.checked)}
                    aria-label={`Enable ${m.label}`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
