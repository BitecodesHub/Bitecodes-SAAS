import type { Metadata } from "next";
import { FormsScreen } from "@/components/product/screens";

/**
 * The staff view of a product the business runs for itself.
 *
 * The page is a wrapper because the screen is shared with `/app`, the
 * self-serve customer area. Both render the same component so a fix to one is a
 * fix to both — see `components/product/screens.tsx`.
 */
export const metadata: Metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <FormsScreen basePath="/admin" />;
}
