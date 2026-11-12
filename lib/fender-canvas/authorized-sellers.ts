/**
 * Partner-led authorized sellers chosen from the Buy Box read.
 * Persistence is this browser's local store. There is no shared list to read.
 */

import { CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP } from "@/lib/fender-canvas/consensus-scores";

/** The control is offered only when the screen's seller type is Partner-led. */
export function authorizedSellerControlOffered(sellerType: string): boolean {
  return sellerType === "Partner-led";
}

/**
 * What each seller type means and who counts as a controlled Buy Box under it (R-02, SC-02).
 * The wording follows docs/client-seller-models.md. It describes how the brand sells; it does
 * not rank one seller type above another.
 */
const SELLER_TYPE_DEFINITIONS: Record<string, string> = {
  "Partner-led":
    "The brand does not sell directly on Amazon. Amazon Retail and authorized partners sell its products. A Buy Box counts as controlled when Amazon Retail or an authorized partner holds it.",
  "Brand-led":
    "The brand sells through its own Amazon seller account, possibly alongside other sellers. A Buy Box counts as controlled when the brand's own seller account holds it.",
};

export function sellerTypeDefinition(sellerType: string): string | null {
  return SELLER_TYPE_DEFINITIONS[sellerType] ?? null;
}

export const AMAZON_RETAIL_ALWAYS_INCLUDED = "Amazon Retail is always included.";

export const AUTHORIZED_SELLERS_MARK_LINE = "Mark the sellers in this Buy Box read.";

export const AUTHORIZED_SELLERS_BROWSER_LINE = "This list is kept in this browser.";

export const AUTHORIZED_SELLERS_LOADING = "Seller names appear when the Buy Box read loads.";

export const AUTHORIZED_SELLERS_UNAVAILABLE = "This Buy Box read did not include seller names.";

export const AUTHORIZED_SELLERS_NONE_IN_READ = "This Buy Box read has no other seller names.";

export const AUTHORIZED_SELLERS_SAVE_LABEL = "Save for this browser";

/** Saved shape in local storage. An empty sellers array is a real save. */
export type AuthorizedSellerSave = {
  sellers: string[];
};

/** Null means this browser has not saved. An object, including sellers: [], is a save. */
export function reviveAuthorizedSellers(raw: unknown): AuthorizedSellerSave | null {
  if (!raw || typeof raw !== "object") return null;
  const sellers = (raw as { sellers?: unknown }).sellers;
  if (!Array.isArray(sellers)) return null;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const entry of sellers) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return { sellers: names };
}

/** Null keeps the placeholder set. A save, including an empty list, replaces it. */
export function authorizedPartnersFromSave(
  saved: AuthorizedSellerSave | null,
): readonly string[] | null {
  return saved ? saved.sellers : null;
}

export function sellerChecked(selected: readonly string[], name: string): boolean {
  const key = name.trim().toLowerCase();
  return selected.some((entry) => entry.trim().toLowerCase() === key);
}

export function toggleSeller(selected: readonly string[], name: string): string[] {
  const key = name.trim().toLowerCase();
  if (sellerChecked(selected, name)) {
    return selected.filter((entry) => entry.trim().toLowerCase() !== key);
  }
  return [...selected, name];
}

export function formatSellerList(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Visible line after a save. Names the saved sellers and says the list is for this browser. */
export function authorizedSellersSavedLine(sellers: readonly string[]): string {
  if (sellers.length === 0) {
    return "Saved for this browser. Controlled Buy Box counts Amazon Retail only.";
  }
  const names = formatSellerList(sellers);
  return `Saved for this browser: ${names}. Controlled Buy Box counts Amazon Retail and ${names}.`;
}

export { CONTROLLED_BUY_BOX_PLACEHOLDER_TOOLTIP };
