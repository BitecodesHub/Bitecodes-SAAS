"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Monitor, Save } from "lucide-react";
import {
  changeOwnPasswordAction,
  revokeOwnSessionAction,
  updateOwnProfileAction,
} from "@/lib/server/auth/account-actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface SessionRow {
  id: string;
  userAgent: string | null;
  createdAtIso: string;
  lastSeenAtIso: string;
  current: boolean;
}

/**
 * The account holder's own settings: name, password, and signed-in devices.
 *
 * Every action here targets the caller and takes no user id, so there is nothing
 * to tamper with — see `account-actions.ts`.
 */
export function AccountSettings({
  name: initialName,
  company: initialCompany,
  email,
  sessions,
}: {
  name: string;
  company: string;
  email: string;
  sessions: SessionRow[];
}) {
  return (
    <div className="space-y-6">
      <ProfileCard
        initialName={initialName}
        initialCompany={initialCompany}
        email={email}
      />
      <PasswordCard />
      <SessionsCard sessions={sessions} />
    </div>
  );
}

function ProfileCard({
  initialName,
  initialCompany,
  email,
}: {
  initialName: string;
  initialCompany: string;
  email: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany);

  function save() {
    start(async () => {
      const result = await updateOwnProfileAction({ name, company });
      if (result.ok) {
        toast({ title: result.message ?? "Saved.", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not save",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold">Your details</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-company">Company</Label>
          <Input
            id="account-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={120}
          />
        </div>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        Signed in as{" "}
        <span className="text-foreground font-medium">{email}</span>. To change
        the address on the account, write to us — a new one has to be proven
        before the old one stops working.
      </p>
      <Button
        onClick={save}
        disabled={pending || name.trim().length < 2}
        variant="outline"
        className="mt-4"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Save aria-hidden="true" className="size-4" />
        )}
        Save
      </Button>
    </section>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  function change() {
    start(async () => {
      const result = await changeOwnPasswordAction({ current, next, confirm });
      if (result.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
        toast({
          title: "Password changed",
          description: result.message,
          variant: "success",
        });
        // Every session was revoked, this one included, so the next request
        // will land on the sign-in page. Sending them there directly is kinder
        // than letting them click something and be bounced.
        window.location.href = "/login?reset=done";
      } else {
        toast({
          title: "Could not change it",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <KeyRound aria-hidden="true" className="text-primary size-4" />
        Change your password
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        At least 12 characters with an uppercase letter, a lowercase letter, a
        number, and a symbol. Changing it signs out every device, including this
        one.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-next">New password</Label>
          <Input
            id="pw-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Repeat new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <Button
        onClick={change}
        disabled={pending || !current || !next || !confirm}
        variant="outline"
        className="mt-4"
      >
        {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
        Change password
      </Button>
    </section>
  );
}

function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();

  function revoke(id: string) {
    start(async () => {
      const result = await revokeOwnSessionAction(id);
      if (result.ok) {
        toast({ title: result.message ?? "Signed out.", variant: "success" });
        router.refresh();
      } else {
        toast({
          title: "Could not sign that device out",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Monitor aria-hidden="true" className="text-primary size-4" />
        Where you are signed in
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        If you do not recognise one of these, sign it out and change your
        password.
      </p>
      <ul className="mt-4 space-y-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">
                  {describeAgent(session.userAgent)}
                </span>
                {session.current && <Badge variant="secondary">this one</Badge>}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Last used {formatWhen(session.lastSeenAtIso)} · started{" "}
                {formatWhen(session.createdAtIso)}
              </p>
            </div>
            {!session.current && (
              <Button
                onClick={() => revoke(session.id)}
                disabled={pending}
                variant="outline"
                size="sm"
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A readable label from a User-Agent string.
 *
 * Not a parser — a User-Agent is attacker-controlled and lies by design. This
 * only looks for a few well-known substrings so the row says something more
 * useful than a 300-character blob, and falls back rather than guessing.
 */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  const platform = /iPhone|iPad/.test(agent)
    ? "iOS"
    : /Android/.test(agent)
      ? "Android"
      : /Macintosh/.test(agent)
        ? "Mac"
        : /Windows/.test(agent)
          ? "Windows"
          : /Linux/.test(agent)
            ? "Linux"
            : null;
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\//.test(agent)
      ? "Opera"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Firefox\//.test(agent)
          ? "Firefox"
          : /Safari\//.test(agent)
            ? "Safari"
            : null;

  if (platform && browser) return `${browser} on ${platform}`;
  return platform ?? browser ?? "Unknown device";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
