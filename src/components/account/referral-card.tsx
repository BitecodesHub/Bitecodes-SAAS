"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon } from "lucide-react";

/**
 * The customer's referral code and progress, for the /app dashboard.
 *
 * The code is created on the server and passed in; generating one in the
 * browser produced a code that was never stored, so every visitor saw a
 * different "their" code and none of them worked.
 */
export function ReferralCard({
  code,
  redemptionCount,
  rewardLabel,
}: {
  code: string;
  redemptionCount: number;
  rewardLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const shareLink = () =>
    `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = shareLink();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="bg-card/50 rounded-lg border p-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-lg font-medium">Your Referral</span>
        <input
          value={code}
          readOnly
          aria-label="Your referral code"
          className="border-border focus-outline flex-1 rounded border px-3 py-2"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="flex items-center gap-1"
          disabled={copied}
        >
          {copied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {redemptionCount > 0
          ? `${redemptionCount} friend${redemptionCount === 1 ? "" : "s"} signed up. `
          : ""}
        You earn {rewardLabel} when someone you invite confirms their email.
      </p>
    </div>
  );
}
