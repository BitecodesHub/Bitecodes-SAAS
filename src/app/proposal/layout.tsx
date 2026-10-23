import Link from "next/link";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/site";

/**
 * Minimal chrome for a private proposal.
 *
 * Deliberately not the marketing shell: no navigation, no assistant, no
 * WhatsApp button, and no call to action competing with the decision. Just the
 * brand, the document, and a quiet footer.
 */
export default function ProposalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-2 flex min-h-screen flex-col print:bg-transparent print:p-0">
      <header className="print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-5 sm:px-6">
          <Logo />
          <span className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
            Private proposal
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-muted-foreground print:hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-12 text-[13px] leading-[1.6] sm:px-6">
          <p>
            {siteConfig.name} · {siteConfig.contact.email}
          </p>
          <p>
            This link is private to the named client. See{" "}
            <Link
              href="/terms"
              className="hover:text-foreground underline underline-offset-4 transition-colors"
            >
              terms
            </Link>{" "}
            for how we work.
          </p>
        </div>
      </footer>
    </div>
  );
}
