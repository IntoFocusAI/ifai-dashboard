import { activeClient } from "@/lib/client/active-client";

/** set_aside_clients key for the brand on screen: "fmic" or "ledlenser". Each client has a row in public.set_aside_clients. */
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
