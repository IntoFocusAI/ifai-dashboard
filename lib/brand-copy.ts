import { activeClient, brandName } from "@/lib/client/active-client";

/* Brand words for on-screen copy. Each reads the active client at call time. */

export function isFenderClient(): boolean {
  return activeClient().key === "fender";
}

/** The brand the AI lead rates count: "Fender/Squier" for Fender (Squier counts with it), else the brand name. */
export function leadBrand(): string {
  return isFenderClient() ? "Fender/Squier" : brandName();
}

/** Same brand in a sentence: "Fender or Squier" for Fender, else the brand name. */
export function leadBrandOr(): string {
  return isFenderClient() ? "Fender or Squier" : brandName();
}

/** The brand's own website as copy names it: "fender.com", "ledlenser.com". */
export function brandSite(): string {
  return activeClient().brandSiteLabel;
}

/** "Fender-owned", "Ledlenser-owned". */
export function brandOwned(): string {
  return `${brandName()}-owned`;
}

export { brandName };
