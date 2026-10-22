/**
 * The only fields the public testimonials endpoint exposes.
 *
 * Everything else on a testimonial document stays private: consent wording,
 * moderation state, reviewer identity, and database identifiers.
 */
export interface PublicTestimonial {
  quote: string;
  name: string;
  role: string | null;
  company: string | null;
  /** ISO timestamp of the approval that made the testimonial publishable. */
  approvedAt: string;
}
