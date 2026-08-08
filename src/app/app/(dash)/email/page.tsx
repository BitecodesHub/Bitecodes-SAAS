import type { Metadata } from "next";
import { EmailApiScreen } from "@/components/product/screens";

export const metadata: Metadata = { title: "Email API" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <EmailApiScreen />;
}
