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
    <div className="flex min-h-full flex-col">
      <header className="border-border border-b print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-6">
          <Logo />
          <span className="text-muted-foreground text-xs">
            Private proposal
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-border text-muted-foreground border-t print:hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs">
          <p>
            {siteConfig.name} · {siteConfig.contact.email}
          </p>
          <p>
            This link is private to the named client. See{" "}
            <Link href="/terms" className="underline underline-offset-2">
              terms
            </Link>{" "}
            for how we work.
          </p>
        </div>
      </footer>
    </div>
  );
}
