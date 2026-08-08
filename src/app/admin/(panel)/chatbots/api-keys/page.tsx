import type { Metadata } from "next";
import { EmailApiScreen } from "@/components/product/screens";

/**
 * API keys and email credits for staff.
 *
 * At the path the REST routes and `createApiKeyAction` have always pointed at.
 * Until now nothing was here, so the documented way to obtain a key led to a
 * 404 and every Bearer-authenticated endpoint was unreachable.
 */
export const metadata: Metadata = { title: "API keys" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <EmailApiScreen />;
}
