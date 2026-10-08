"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Laptop, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  decidePairingAction,
  revokeDeviceAction,
} from "@/lib/server/desktop/actions";

interface Props {
  requestedCode: string | null;
  pending: { label: string; userCode: string } | null;
  devices: {
    id: string;
    label: string;
    createdAtIso: string;
    lastUsedAtIso: string | null;
  }[];
}

type Outcome =
  | { kind: "approved" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | null;

const fmt = (iso: string) => new Date(iso).toLocaleString();

export function DesktopPairing({ requestedCode, pending, devices }: Props) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [rows, setRows] = useState(devices);
  const [isPending, startTransition] = useTransition();

  const decide = (approve: boolean) =>
    startTransition(async () => {
      if (!pending) return;
      const res = await decidePairingAction({
        userCode: pending.userCode,
        approve,
      });
      setOutcome(
        res.ok ? { kind: res.status } : { kind: "error", message: res.error },
      );
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const res = await revokeDeviceAction(id);
      if (res.ok) setRows((r) => r.filter((d) => d.id !== id));
    });

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
            is asking to use your Bitecodes account. Approve only if this code
            matches the one shown in the app.
          </p>
          <p
            className="bg-muted/40 mt-5 rounded-lg border py-4 text-center font-mono text-3xl tracking-[0.3em]"
            aria-label="Confirmation code"
          >
            {pending.userCode}
          </p>
          {outcome?.kind === "error" && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {outcome.message}
            </p>
          )}
          <div className="mt-6 flex gap-3">
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
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          {requestedCode
            ? "This sign-in request has expired or was already used. Start sign-in again from the app."
            : "To connect, choose “Sign in with Bitecodes” in the desktop app."}
        </p>
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
                  <p className="text-muted-foreground text-xs">
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
