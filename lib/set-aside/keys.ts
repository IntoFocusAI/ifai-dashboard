import { activeClient } from "@/lib/client/active-client";

/** Fender pilot. Each client gets a row in public.set_aside_clients. */
export const FMIC_CLIENT_KEY = "fmic";

/** set_aside_clients key for the brand on screen: "fmic" or "ledlenser". */
export function activeSetAsideClientKey(): string {
  return activeClient().setAsideKey;
}

/** Rows in public.set_aside_checks wired into the dashboard so far. */
export const SET_ASIDE_CHECKS = {
  commandCenterQueue: "command_center_queue",
  amazonSpecs: "amazon_specs",
  brandSiteSpecs: "brand_site_specs",
  listingContent: "listing_content",
  buyboxSuppression: "buybox_suppression",
  mapPricing: "map_pricing",
  outOfStock: "out_of_stock",
} as const;
