"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Laptop,
  Loader2,
  MapPin,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  decidePairingAction,
  lookupPairingAction,
  revokeDeviceAction,
} from "@/lib/server/desktop/actions";

interface Props {
  yourLocation: string | null;
  devices: {
    id: string;
    label: string;
    createdAtIso: string;
    lastUsedAtIso: string | null;
  }[];
}

interface Pending {
  label: string;
  userCode: string;
  requestedFrom: string | null;
  createdAtIso: string;
}

type Outcome = { kind: "approved" } | { kind: "denied" } | null;

const fmt = (iso: string) => new Date(iso).toLocaleString();

function ago(iso: string): string {
  const s = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  return `${m} minute${m === 1 ? "" : "s"} ago`;
}

const country = (loc: string | null) => loc?.split(", ").at(-1) ?? null;

export function DesktopPairing({ yourLocation, devices }: Props) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [rows, setRows] = useState(devices);
  const [isPending, startTransition] = useTransition();

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const res = await lookupPairingAction(code);
      if (res.ok) setPending(res.pending);
      else setError(res.error);
    });
  };

  const decide = (approve: boolean) =>
    startTransition(async () => {
      if (!pending) return;
      const res = await decidePairingAction({
        userCode: pending.userCode,
        approve,
      });
      if (res.ok) setOutcome({ kind: res.status });
      else {
        setError(res.error);
        setPending(null);
      }
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const res = await revokeDeviceAction(id);
      if (res.ok) setRows((r) => r.filter((d) => d.id !== id));
    });

  const otherCountry =
    pending?.requestedFrom &&
    yourLocation &&
    country(pending.requestedFrom) !== country(yourLocation);

  return (
    <div className="bg-card w-full max-w-md rounded-xl border p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Laptop className="size-5" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">
          Connect the desktop app
        </h1>
      </div>

      {outcome?.kind === "approved" ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg bg-emerald-500/10 p-4 text-sm">
          <CheckCircle2
            className="mt-0.5 size-5 text-emerald-600"
            aria-hidden="true"
          />
          <p>Connected. You can close this tab and return to the app.</p>
        </div>
      ) : outcome?.kind === "denied" ? (
        <div className="bg-muted mt-6 flex items-start gap-3 rounded-lg p-4 text-sm">
          <XCircle className="mt-0.5 size-5" aria-hidden="true" />
          <p>Request denied. Nothing was connected.</p>
        </div>
      ) : pending ? (
        <>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            <span className="text-foreground font-medium">{pending.label}</span>{" "}
            wants to use your Bitecodes account.
          </p>
          <dl className="bg-muted/40 mt-4 space-y-1.5 rounded-lg border p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Code</dt>
              <dd className="font-mono tracking-widest">{pending.userCode}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Requested</dt>
              <dd>{ago(pending.createdAtIso)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">From</dt>
              <dd className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {pending.requestedFrom ?? "Unknown location"}
              </dd>
            </div>
          </dl>
          {otherCountry && (
            <p
              className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300"
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              This request came from a different country than you are in now. If
              you did not just start sign-in in the app yourself, deny it.
            </p>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Approve only if you started this sign-in in the Notes app on your
            own computer just now. Prompts and answers from the app are stored
            for 180 days (screenshots are not) — see our{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
          <div className="mt-5 flex gap-3">
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={() => decide(true)}
            >
              <ShieldCheck aria-hidden="true" />
              Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={() => decide(false)}
            >
              Deny
            </Button>
          </div>
        </>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={lookup}>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Enter the code shown in the Notes app. Never enter a code someone
            else gave you.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pair-code">Code from the app</Label>
            <Input
              id="pair-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={11}
              autoFocus
              className="text-center font-mono text-lg tracking-[0.25em]"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || code.replace(/[^A-Z0-9]/gi, "").length < 8}
          >
            {isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Continue
          </Button>
        </form>
      )}

      {rows.length > 0 && (
        <div className="mt-8 border-t pt-5">
          <h2 className="text-sm font-medium">Connected devices</h2>
          <ul className="mt-3 space-y-2">
            {rows.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.label}</p>
                  {/* Local-time formatting differs between server and browser;
                      the browser's version wins without a hydration error. */}
                  <p
                    className="text-muted-foreground text-xs"
                    suppressHydrationWarning
                  >
                    Connected {fmt(d.createdAtIso)}
                    {d.lastUsedAtIso
                      ? ` · last used ${fmt(d.lastUsedAtIso)}`
                      : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => revoke(d.id)}
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
