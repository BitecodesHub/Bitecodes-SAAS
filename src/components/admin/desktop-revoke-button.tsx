"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unplug } from "lucide-react";
import { adminRevokeDeviceAction } from "@/lib/server/desktop/admin-actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export function DesktopRevokeButton({
  id,
  label,
  user,
}: {
  id: string;
  label: string;
  user: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Disconnect ${label} for ${user}`}
      onClick={() => {
        if (
          !window.confirm(
            `Disconnect “${label}” for ${user}? The app will ask them to sign in again.`,
          )
        )
          return;
        start(async () => {
          const res = await adminRevokeDeviceAction(id);
          toast(
            res.ok
              ? { title: res.message ?? "Disconnected", variant: "success" }
              : {
                  title: "Could not disconnect",
                  description: res.error,
                  variant: "error",
                },
          );
          if (res.ok) router.refresh();
        });
      }}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Unplug aria-hidden="true" />
      )}
      Disconnect
    </Button>
  );
}
