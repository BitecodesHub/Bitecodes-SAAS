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
        <div className="border-border bg-card mx-auto max-w-2xl rounded-3xl border p-8 text-center shadow-[var(--shadow-lift)] sm:p-12">
          <span className="bg-primary/10 text-primary mx-auto flex size-16 items-center justify-center rounded-2xl">
            <Wrench className="size-7" />
          </span>
          <p className="text-primary mt-6 text-xs font-semibold tracking-[0.16em] uppercase">
            Scheduled maintenance
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            We are making Bitecodes better
          </h1>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            This page is available for planned maintenance windows. For an
            active project or urgent enquiry, contact the team directly.
          </p>
          <div className="text-muted-foreground mt-6 flex flex-wrap justify-center gap-5 text-sm">
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
            <Button asChild variant="outline" size="lg">
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
