"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Loader2, Save } from "lucide-react";
import { saveDesktopLimitsAction } from "@/lib/server/desktop/admin-actions";
import type { DesktopLimits, TodayUsage } from "@/lib/server/desktop/quota";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NumericKey = Exclude<keyof DesktopLimits, "access">;

const FIELDS: { key: NumericKey; label: string; help: string }[] = [
  {
    key: "userDailyRequests",
    label: "Requests per user / day",
    help: "Hard cap, enforced atomically.",
  },
  {
    key: "userDailyTokens",
    label: "Tokens per user / day",
    help: "Prompt + answer tokens.",
  },
  {
    key: "globalDailyTokens",
    label: "Tokens across all users / day",
    help: "Overall spend ceiling.",
  },
];

export function DesktopLimitsCard({
  limits,
  today,
}: {
  limits: DesktopLimits;
  today: TodayUsage;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(
        FIELDS.map((f) => [f.key, String(limits[f.key])]),
      ) as Record<NumericKey, string>,
  );
  const [access, setAccess] = useState<DesktopLimits["access"]>(limits.access);

  const pct = limits.globalDailyTokens
    ? Math.min(100, (today.tokens / limits.globalDailyTokens) * 100)
    : null;

  const save = () =>
    start(async () => {
      const parsed = Object.fromEntries(
        FIELDS.map((f) => [
          f.key,
          Number(values[f.key].replace(/[,_\s]/g, "")),
        ]),
      ) as unknown as Omit<DesktopLimits, "access">;
      const res = await saveDesktopLimitsAction({ ...parsed, access });
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
      aria-labelledby="limits-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="limits-heading"
            className="flex items-center gap-2 font-semibold"
          >
            <Gauge className="size-4" aria-hidden="true" /> Daily limits
          </h2>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Caps reset at midnight UTC. Set 0 for unlimited. Users who hit a cap
            are told when it resets; every refusal appears in the prompt log.
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground text-xs">
            Today ({today.day} UTC)
          </div>
          <div className="tabular-nums">
            {today.requests.toLocaleString()} requests ·{" "}
            {today.tokens.toLocaleString()} tokens
          </div>
          {pct != null && (
            <div
              className="bg-muted mt-1 h-1.5 w-48 overflow-hidden rounded-full"
              aria-label={`${Math.round(pct)}% of the daily token ceiling used`}
            >
              <div
                className={`h-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`limit-${f.key}`}>{f.label}</Label>
            <Input
              id={`limit-${f.key}`}
              inputMode="numeric"
              value={values[f.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
            />
            <p className="text-muted-foreground text-xs">{f.help}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 max-w-sm space-y-1.5">
        <Label htmlFor="limit-access">Who can use the Bitecodes model</Label>
        <select
          id="limit-access"
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={access}
          onChange={(e) =>
            setAccess(e.target.value === "staff" ? "staff" : "everyone")
          }
        >
          <option value="everyone">Everyone with a Bitecodes account</option>
          <option value="staff">Staff only (not self-serve customers)</option>
        </select>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          Save limits
        </Button>
      </div>
    </section>
  );
}
