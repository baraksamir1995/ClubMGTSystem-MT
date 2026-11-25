/**
 * Social proof for the "Built for the way gyms actually operate" section.
 *
 * VERIFIED DATA ONLY. Every entry must be real and traceable: a metric
 * needs a source (e.g. "prod DB, 2026-11-25") and a testimonial needs the
 * person's written permission. Empty arrays render nothing: the section
 * then shows only the client logos (managed in super-admin), or hides
 * entirely if there are none.
 */

export type ProofMetric = {
  value: string; // e.g. "40+"
  label: string; // e.g. "gyms on CLBY"
  source: string; // internal note, not rendered
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string; // e.g. "Owner"
  gym: string;
  permission: string; // internal note: who approved and when, not rendered
};

export const PROOF_METRICS: ProofMetric[] = [];

export const TESTIMONIALS: Testimonial[] = [];
