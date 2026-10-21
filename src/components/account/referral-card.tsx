"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyIcon, CheckIcon } from "lucide-react";

/**
 * The customer's referral code and progress, for the /app dashboard.
 *
 * Shows the referral code, copy-to-clipboard action, and referral progress.
 * Owned by the lifecycle package.
 */
export function ReferralCard() {
  const pathname = usePathname();
  const code = `BC-${pathname.slice(-6).toUpperCase()}`;
  const [referralCode] = useState(code);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = referralCode;
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
          value={referralCode}
          readOnly
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
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Share your code and earn credits when friends sign up.
      </p>
    </div>
  );
}
