import { activeClient, activeClientSettings, brandName } from "@/lib/client/active-client";

/* Brand words for on-screen copy, from the client settings record. Each reads the active client
   at call time, never at import (PR 216), so a server export reads the request's client. */

export function isFenderClient(): boolean {
  return activeClient().key === "fender";
}

/** The brand the AI lead rates count: "Fender/Squier" for Fender (Squier counts with it), else the brand name. */
export function leadBrand(): string {
  return activeClientSettings().lead_brand_label;
}

/** Same brand in a sentence: "Fender or Squier" for Fender, else the brand name. */
export function leadBrandOr(): string {
  return activeClientSettings().lead_brand_phrase;
}

/** The brand's own website as copy names it: "fender.com", "ledlenserusa.com". */
export function brandSite(): string {
  return activeClientSettings().brand_site_label;
}

/** "Fender-owned", "Ledlenser-owned". */
export function brandOwned(): string {
  return `${brandName()}-owned`;
}

export { brandName };
