import type { Metadata } from "next";
import { FormsScreen } from "@/components/product/screens";

/**
 * The customer's own forms. Renders the same screen as `/admin/forms` — see
 * `components/product/screens.tsx` for why there is only one of them.
 */
export const metadata: Metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <FormsScreen basePath="/app" />;
}
