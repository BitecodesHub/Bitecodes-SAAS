"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
} from "@/lib/server/auth/roles";
import {
  createTeamMemberAction,
  resetTeamPasswordAction,
  setTeamRoleAction,
  setTeamStatusAction,
  unlockTeamMemberAction,
} from "@/lib/server/auth/users-actions";
import type { AdminUserSummary } from "@/lib/server/auth/users";
import type { AdminRole } from "@/lib/server/db/types";

/**
 * The team page.
 *
 * The one-time password is the delicate part: it is shown once, in a panel that
 * stays until dismissed, with a copy button, and it is never sent anywhere. The
 * new hire changes it on first sign-in. This mirrors the CLI, which also prints
 * the password once and never stores a recoverable form.
 */

interface TeamManagerProps {
  members: AdminUserSummary[];
  currentUserId: string;
}

interface Credential {
  email: string;
  password: string;
}

export function TeamManager({ members, currentUserId }: TeamManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("editor");
  const [credential, setCredential] = useState<Credential | null>(null);

  function invite() {
    startTransition(async () => {
      const result = await createTeamMemberAction({ email, name, role });
      if (!result.ok) {
        toast({
          title: "Could not add",
          description: result.error,
          variant: "error",
        });
        return;
      }
      setCredential({
        email: result.data.email,
        password: result.data.password,
      });
      setEmail("");
      setName("");
      setRole("editor");
      toast({ title: `${result.data.email} added`, variant: "success" });
      router.refresh();
    });
  }

  function run(
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    successTitle: string,
  ) {
    setBusyId(id);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (!result.ok) {
        toast({
          title: "Could not update",
          description: result.error,
          variant: "error",
        });
        return;
      }
      toast({ title: successTitle, variant: "success" });
      router.refresh();
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied", variant: "success" });
    } catch {
      toast({ title: "Copy failed — select it by hand", variant: "warning" });
    }
  }

  return (
    <div className="space-y-8">
      {credential ? (
        <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-emerald-600" />
            One-time password for {credential.email}
          </div>
          <p className="text-muted-foreground text-sm">
            Copy this now and send it to them over a channel they already trust.
            It is shown once and cannot be retrieved later — they change it on
            first sign-in.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-background flex-1 overflow-x-auto rounded-md border px-3 py-2 font-mono text-sm">
              {credential.password}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(credential.password)}
            >
              <Copy className="size-4" /> Copy
            </Button>
            <Button size="sm" onClick={() => setCredential(null)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4" />
          <h2 className="text-lg font-semibold">Add a team member</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Priya Shah"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-email">Email</Label>
            <Input
              id="team-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="priya@bitecodes.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-role">Role</Label>
            <Select
              id="team-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {ROLE_DESCRIPTIONS[role]}
        </p>
        <Button onClick={invite} disabled={pending || !email || !name}>
          {pending && !busyId ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          Create account
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Team</h2>
        <div className="divide-y rounded-lg border">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            const busy = busyId === member.id;
            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{member.name}</span>
                    {isSelf ? <Badge variant="outline">You</Badge> : null}
                    {member.status === "disabled" ? (
                      <Badge variant="secondary">Disabled</Badge>
                    ) : null}
                    {member.lockedUntil ? (
                      <Badge variant="secondary">
                        <Lock className="size-3" /> Locked
                      </Badge>
                    ) : null}
                    {member.twoFactorEnabled ? (
                      <Badge variant="outline">2FA</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {member.email}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {member.lastLoginAt
                      ? `Last signed in ${new Date(member.lastLoginAt).toLocaleDateString()}`
                      : "Never signed in"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label={`Role for ${member.name}`}
                    className="h-9 w-32"
                    value={member.role}
                    disabled={isSelf || busy}
                    onChange={(event) =>
                      run(
                        member.id,
                        () => setTeamRoleAction(member.id, event.target.value),
                        "Role updated",
                      )
                    }
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>

                  {member.lockedUntil ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          member.id,
                          () => unlockTeamMemberAction(member.id),
                          "Unlocked",
                        )
                      }
                    >
                      Unlock
                    </Button>
                  ) : null}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSelf || busy}
                    onClick={() =>
                      run(
                        member.id,
                        async () => {
                          const result = await resetTeamPasswordAction(
                            member.id,
                          );
                          if (result.ok) {
                            setCredential({
                              email: member.email,
                              password: result.data.password,
                            });
                          }
                          return result;
                        },
                        "New password issued",
                      )
                    }
                  >
                    <KeyRound className="size-4" /> Reset password
                  </Button>

                  {member.status === "disabled" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run(
                          member.id,
                          () => setTeamStatusAction(member.id, "active"),
                          "Account enabled",
                        )
                      }
                    >
                      Enable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSelf || busy}
                      onClick={() =>
                        run(
                          member.id,
                          () => setTeamStatusAction(member.id, "disabled"),
                          "Account disabled",
                        )
                      }
                    >
                      Disable
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
