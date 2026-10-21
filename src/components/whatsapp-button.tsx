import { MessageCircle } from "lucide-react";
import { siteConfig } from "@/lib/site";

/**
 * Floating WhatsApp contact button, pinned bottom-right.
 *
 * On mobile the sticky CTA bar sits at the bottom of the screen. This button
 * reads --sticky-cta-height (written by StickyCTABar) and adds it to its own
 * bottom offset so it is never obscured.
 */
export function WhatsAppButton() {
  return (
    <a
      href={siteConfig.contact.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${siteConfig.name} on WhatsApp`}
      className="focus-visible:ring-ring fixed right-6 z-40 flex size-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[var(--shadow-soft)] transition-[bottom,transform] duration-300 hover:scale-105 focus-visible:ring-2 focus-visible:outline-none"
      style={{ bottom: "calc(1.5rem + var(--sticky-cta-height, 0px))" }}
    >
      <MessageCircle className="size-5" />
    </a>
  );
}
