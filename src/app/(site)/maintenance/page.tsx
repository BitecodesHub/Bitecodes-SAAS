import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Mail, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  ...createMetadata({
    title: "Maintenance",
    description: "Bitecodes is completing scheduled maintenance.",
    path: "/maintenance",
  }),
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden">
      <div className="container-page">
        <div className="bg-surface-2 mx-auto max-w-2xl rounded-[32px] p-8 text-center sm:p-12">
          <span className="bg-background text-primary mx-auto flex size-16 items-center justify-center rounded-[20px]">
            <Wrench className="size-7" />
          </span>
          <p className="text-muted-foreground mt-6 text-[11px] font-semibold tracking-[0.14em] uppercase">
            Scheduled maintenance
          </p>
          <h1 className="mt-2 text-[36px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[44px]">
            We are making Bitecodes better
          </h1>
          <p className="text-muted-foreground mt-4 text-[17px] leading-[1.6]">
            This page is available for planned maintenance windows. For an
            active project or urgent enquiry, contact the team directly.
          </p>
          <div className="text-muted-foreground mt-6 flex flex-wrap justify-center gap-5 text-[14px]">
            <span className="flex items-center gap-2">
              <Clock3 className="size-4" />
              Check back shortly
            </span>
            <span className="flex items-center gap-2">
              <Mail className="size-4" />
              {siteConfig.contact.email}
            </span>
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/contact">Contact Bitecodes</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="bg-background"
            >
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
