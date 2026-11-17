/* Brand words for AI Search, built from the active client's settings record (X-35, decision 105,
   parity chunk C2). Nothing here names a client: the words come from brand_name_terms,
   lead_brand_label, portfolio_brands and product_line_terms in data/clients/<key>.json. Each
   reads the active client per call, never at import. */

import { activeClientSettings, brandName } from "@/lib/client/active-client";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A whole-word, case-blind pattern for a list of brand terms. A space in a term matches any run of
 * spaces or hyphens, or none, so "led lenser" matches "LED Lenser", "Led-Lenser" and "LEDLENSER".
 * Null for an empty list.
 */
export function brandTermPattern(terms: readonly string[]): RegExp | null {
  const parts = terms
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .map((term) => term.split(/[\s-]+/).map(escapeRegExp).join("[\\s-]*"));
  if (parts.length === 0) return null;
  return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
}

/** The names that count as the client brand in an answer (brand_name_terms, else the brand name). */
export function brandMention(): RegExp {
  const terms = activeClientSettings().brand_name_terms;
  return brandTermPattern(terms.length > 0 ? terms : [brandName()])!;
}

/** True when a brand name reads as the client's own brand: "Squier" for Fender, "LED Lenser" for Ledlenser. */
export function isOwnBrandName(name: string): boolean {
  return brandMention().test(name);
}

/** The brands the lead rates count together, from lead_brand_label: ["Fender", "Squier"], ["Ledlenser"]. */
export function leadBrandNames(): string[] {
  const names = activeClientSettings()
    .lead_brand_label.split("/")
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 ? names : [brandName()];
}

function listPhrase(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** "Squier counts with Fender." when the lead rates count more than one brand, else null. */
export function countsWithLeadSentence(): string | null {
  const [first, ...rest] = leadBrandNames();
  if (!first || rest.length === 0) return null;
  return `${listPhrase(rest)} ${rest.length === 1 ? "counts" : "count"} with ${first}.`;
}

/** The brands a shopping question can name for the client: "Fender, Squier," or "Ledlenser". */
export function namedBrandsPhrase(): string {
  const names = leadBrandNames();
  return names.length > 1 ? `${names.join(", ")},` : names[0]!;
}

/** Who controls the brand-owned sites: "Fender or a brand it owns (Squier, Jackson, EVH, Gretsch)", else the brand name. */
export function ownedSitesOwner(): string {
  const brand = brandName();
  const others = activeClientSettings().portfolio_brands.filter((name) => name.toLowerCase() !== brand.toLowerCase());
  return others.length > 0 ? `${brand} or a brand it owns (${others.join(", ")})` : brand;
}

/** ", such as Stratocaster," from the first product line term, or "" when the client lists none. */
export function productLineExample(): string {
  const term = activeClientSettings().product_line_terms[0]?.trim();
  if (!term) return "";
  const title = term.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return `, such as ${title},`;
}
