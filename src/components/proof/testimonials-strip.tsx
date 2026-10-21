"use client";

import { useEffect, useState } from "react";
import type { PublicTestimonial } from "@/components/proof/types";

function isPublicTestimonial(value: unknown): value is PublicTestimonial {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.quote === "string" &&
    typeof item.name === "string" &&
    typeof item.approvedAt === "string" &&
    (item.role === null || typeof item.role === "string") &&
    (item.company === null || typeof item.company === "string")
  );
}

/**
 * Approved, consented testimonials.
 *
 * A client island because the marketing page stays static: the page renders
 * without a database read, and the strip fetches when it reaches the browser.
 * It renders nothing until real, approved testimonials exist, and nothing at all
 * if the request fails. Proof is never invented.
 */
export function TestimonialsStrip() {
  const [items, setItems] = useState<PublicTestimonial[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/testimonials", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null) return;
        const list = (payload as { testimonials?: unknown }).testimonials;
        if (!Array.isArray(list)) return;
        setItems(list.filter(isPublicTestimonial));
      } catch {
        if (!controller.signal.aborted) setItems([]);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="border-border bg-surface-2 border-y"
    >
      <div className="container-page py-16 sm:py-20">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">
          Testimonials
        </p>
        <h2
          id="testimonials-heading"
          className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          What clients say
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <figure
              key={`${item.name}-${item.approvedAt}-${index}`}
              className="border-border bg-card flex h-full flex-col rounded-2xl border p-6 shadow-[var(--shadow-soft)]"
            >
              <blockquote className="text-foreground flex-1 text-base leading-relaxed text-pretty">
                “{item.quote}”
              </blockquote>
              <figcaption className="text-muted-foreground mt-5 text-sm">
                <span className="text-foreground font-medium">{item.name}</span>
                {(item.role || item.company) && (
                  <span>
                    {" "}
                    — {[item.role, item.company].filter(Boolean).join(", ")}
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
