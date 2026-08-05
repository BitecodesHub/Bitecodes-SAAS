import { MessageCircle } from "lucide-react";
import { siteConfig } from "@/lib/site";

/**
 * Floating WhatsApp contact button, pinned bottom-left so it never collides
 * with the back-to-top control at bottom-right.
 *
 * A plain link rather than a chat widget: it opens the visitor's own WhatsApp
 * with our number, which works on every device and loads no third-party code.
 */
export function WhatsAppButton() {
  return (
    <a
      href={siteConfig.contact.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${siteConfig.name} on WhatsApp`}
      className="focus-visible:ring-ring fixed bottom-6 left-6 z-40 flex size-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-soft)] transition-transform duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:outline-none"
    >
      <MessageCircle className="size-5" />
    </a>
  );
}
