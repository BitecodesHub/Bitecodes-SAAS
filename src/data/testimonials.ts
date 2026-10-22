import type { Testimonial } from "@/types/content";

/*
 * Static testimonials are intentionally empty.
 *
 * Approved, consented testimonials are stored in the database and served by
 * GET /api/testimonials, then rendered by <TestimonialsStrip />. Never add a
 * placeholder quote here: proof is collected with consent or not shown at all.
 */
export const testimonials: Testimonial[] = [];
