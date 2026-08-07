"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Gift, Loader2 } from "lucide-react";
import {
  createCheckoutAction,
  grantSelfCreditsAction,
} from "@/lib/server/billing/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

/**
 * Buy prepaid credits for a metered product.
 *
 * One component for both products rather than two near-copies: the wallet, the
 * order flow, and the grant action are all already product-generic, so the only
 * thing that actually differs is the noun. Duplicating the panel would mean
 * every future billing change had to be made twice, and the second copy is the
 * one that gets forgotten.
 *
 * When no gateway is configured the action returns payment instructions instead
 * of a redirect. Those are shown verbatim rather than pretending checkout
 * succeeded.
 */

export type CreditProduct = "forms" | "chatbot";

export interface PackCard {
  packId: string;
  label: string;
  credits: number;
  price: string;
  /** Pre-formatted "works out at" figure, already in the product's own unit. */
  perUnit: string;
  blurb: string;
  popular: boolean;
}

const COPY: Record<
  CreditProduct,
  {
    heading: string;
    explainer: string;
    /** Pluralised unit shown on a pack card, e.g. "2,500 submissions". */
    unit: string;
    grantDefault: string;
  }
> = {
  forms: {
    heading: "Submission credits",
    explainer:
      "One credit per accepted submission. Spam caught by the honeypot costs nothing.",
    unit: "submissions",
    grantDefault: "500",
  },
  chatbot: {
    heading: "Chat tokens",
    explainer:
      "Tokens cover both the question and the answer, so a longer reply costs more. A refusal costs a few tokens; nothing is charged when a visitor is turned away.",
    unit: "tokens",
    grantDefault: "250000",
  },
};

export function CreditsPanel({
  product,
  packs,
  balance,
  canGrant,
  gatewayLive,
}: {
  product: CreditProduct;
  packs: PackCard[];
  balance: number;
  canGrant: boolean;
  gatewayLive: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [instructions, setInstructions] = useState<string | null>(null);
  const copy = COPY[product];
  const [grantAmount, setGrantAmount] = useState(copy.grantDefault);

  function buy(packId: string) {
    setInstructions(null);
    start(async () => {
      const result = await createCheckoutAction(packId);
      if (!result.ok) {
        toast({
          title: "Could not start checkout",
          description: result.error,
          variant: "error",
        });
        return;
      }
      if (result.data.kind === "redirect") {
        window.location.href = result.data.url;
        return;
      }
      setInstructions(result.data.instructions);
    });
  }

  function grant() {
    const amount = Number(grantAmount);
    if (!Number.isInteger(amount) || amount < 1) return;
    start(async () => {
      const result = await grantSelfCreditsAction(
        product,
        amount,
        "admin grant",
      );
      if (result.ok) {
        toast({
          title: `${amount.toLocaleString()} added`,
          description: `Balance is now ${result.data.balance.toLocaleString()}.`,
          variant: "success",
        });
        router.refresh();
      } else {
        toast({
          title: "Could not grant",
          description: result.error,
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{copy.heading}</h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
              {copy.explainer}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {balance.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-xs">remaining</p>
          </div>
        </div>

        {!gatewayLive && (
          <p className="border-border bg-muted/40 mt-4 rounded-xl border p-3 text-sm leading-relaxed">
            Card and UPI checkout is not switched on yet. Choosing a pack
            reserves an order and shows you how to pay directly.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {packs.map((pack) => (
            <div
              key={pack.packId}
              className="border-border relative rounded-xl border p-4"
            >
              {pack.popular && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2.5 right-3"
                >
                  Most chosen
                </Badge>
              )}
              <p className="font-semibold">{pack.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {pack.price}
              </p>
              <p className="text-muted-foreground text-xs">
                {pack.credits.toLocaleString()} {copy.unit} · {pack.perUnit}
              </p>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {pack.blurb}
              </p>
              <Button
                onClick={() => buy(pack.packId)}
                disabled={pending}
                variant={pack.popular ? "gradient" : "outline"}
                className="mt-3 w-full"
              >
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CreditCard className="size-4" />
                )}
                Buy
              </Button>
            </div>
          ))}
        </div>

        {instructions && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {instructions}
          </p>
        )}
      </section>

      {canGrant && (
        <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Gift className="text-primary size-4" />
            Add {copy.unit} manually
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            For settling a direct payment, or topping up your own account while
            testing. Every grant is recorded in the audit log.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`grant-${product}`}>Amount</Label>
              <Input
                id={`grant-${product}`}
                type="number"
                min={1}
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                className="w-36"
              />
            </div>
            <Button onClick={grant} disabled={pending} variant="outline">
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Gift className="size-4" />
              )}
              Add to my account
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
