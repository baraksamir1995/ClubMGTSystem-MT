/** Service offerings a visitor can request a quote for. */
export const OFFERINGS = {
  clby_marketplace: "CLBY Marketplace App",
  branded_app: "Your Own Branded App",
} as const;

export type Offering = keyof typeof OFFERINGS;

export const QUOTE_EVENT = "clby:quote";

export function isOffering(v: unknown): v is Offering {
  return typeof v === "string" && v in OFFERINGS;
}
