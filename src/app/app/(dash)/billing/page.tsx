import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/server/auth/dal";
import { can } from "@/lib/server/auth/roles";
import { getBalance } from "@/lib/server/wallet/wallet";
import { listOrders, getActiveProvider } from "@/lib/server/billing/orders";
import {
  formatPackPrice,
  packsFor,
  perUnitPrice,
  PACKS_ARE_PLACEHOLDER_PRICING,
} from "@/lib/server/billing/packs";
import { CreditsPanel } from "@/components/admin/credits-panel";
import { Badge } from "@/components/ui/badge";
import type { WalletProduct } from "@/lib/server/db/types";

export const metadata: Metadata = { title: "Credits" };
export const dynamic = "force-dynamic";

/**
 * Every wallet in one place, with the order history beneath.
 *
 * The product pages each carry their own credits panel, which is where somebody
 * tops up in the middle of a task. This page is for the other moment: working
 * out what the account has overall, and checking that a payment landed.
 */
const PRODUCTS: { product: WalletProduct; heading: string }[] = [
  { product: "chatbot", heading: "Chatbot" },
  { product: "forms", heading: "Forms" },
  { product: "bookings", heading: "Bookings" },
  { product: "email", heading: "Email" },
];

function packCards(product: WalletProduct) {
  return packsFor(product).map((pack) => ({
    packId: pack.packId,
    label: pack.label,
    credits: pack.credits,
    price: formatPackPrice(pack),
    perUnit: perUnitPrice(pack),
    blurb: pack.blurb,
    popular: Boolean(pack.popular),
  }));
}

export default async function BillingPage() {
  const session = await requireAdminSession();

  const [balances, orders] = await Promise.all([
    Promise.all(
      PRODUCTS.map(({ product }) => getBalance(session.userId, product)),
    ),
    listOrders(session.userId, 25),
  ]);

  const gatewayLive = getActiveProvider().id !== "manual";
  const canGrant = can(session.role, "manage_settings");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Credits</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Buy in packs, spend one at a time. Nothing renews on its own, there is
          no monthly fee, and credits do not expire while your account is open.
          {PACKS_ARE_PLACEHOLDER_PRICING && (
            <> Prices are a launch offer and may change for new purchases.</>
          )}
        </p>
      </header>

      {PRODUCTS.map(({ product, heading }, index) => (
        <section key={product} className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
          <CreditsPanel
            product={product}
            packs={packCards(product)}
            balance={balances[index] ?? 0}
            canGrant={canGrant}
            gatewayLive={gatewayLive}
          />
        </section>
      ))}

      <section className="border-border bg-card rounded-2xl border p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold">Your orders</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nothing bought yet. Your free credits are not an order, so they do
            not appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {orders.map((order) => (
              <li
                key={order.orderId}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {order.credits.toLocaleString()} {order.product} credits
                    <Badge
                      variant={order.status === "paid" ? "secondary" : "muted"}
                    >
                      {order.status}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {new Date(order.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · {order.gateway}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatAmount(order.amount, order.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Money is stored in minor units to keep it off floating point, so it is divided
 * only here, at the point of display.
 */
function formatAmount(minorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(minorUnits / 100);
  } catch {
    // An unrecognised currency code must not take the whole page down.
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}
