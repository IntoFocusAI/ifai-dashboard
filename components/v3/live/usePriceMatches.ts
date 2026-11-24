"use client";

import { useEffect, useState } from "react";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";
import type { PriceMatchCheckRow, PriceMatchRow } from "@/lib/fender-canvas/price-match";
import type { WithheldOfferSellerRow } from "@/lib/fender-canvas/withheld-offer-seller";

/* R-15: the latest price-match search per listing and its matches, for the brand on screen
   (canvas_price_match_checks and canvas_price_matches in the brand's schema), and the seller(s)
   holding each withheld offer (canvas_withheld_offer_sellers). */

export type PriceMatchRead =
  | "loading"
  | "unavailable"
  | { checks: PriceMatchCheckRow[]; matches: PriceMatchRow[]; sellers: WithheldOfferSellerRow[] };

const CHECK_COLUMNS =
  "asin,check_id,searched_at,last_attempt_at,last_attempt_status,search_benchmark_cents,current_benchmark_cents,benchmark_changed,result_count,exact_count,kept_count,different_count";
const MATCH_COLUMNS =
  "asin,check_id,searched_at,search_benchmark_cents,current_benchmark_cents,benchmark_changed,retailer,retailer_name,domain,url,title,seller,item_cents,shipping_cents,match_kind,verdict,verdict_reason,verdict_by,observed_at";
const SELLER_COLUMNS = "asin,seller_ids,seller_names,landed_cents,checked_at,featured_offer_state";

let shared: Promise<PriceMatchRead> | null = null;

async function loadPriceMatches(): Promise<PriceMatchRead> {
  const supabase = getCanvasSupabase();
  const [checks, matches, sellers] = await Promise.all([
    supabase.from("canvas_price_match_checks").select(CHECK_COLUMNS).limit(2000),
    supabase.from("canvas_price_matches").select(MATCH_COLUMNS).limit(5000),
    supabase.from("canvas_withheld_offer_sellers").select(SELLER_COLUMNS).limit(5000),
  ]);
  if (checks.error || matches.error) return "unavailable";
  return {
    checks: (checks.data ?? []) as PriceMatchCheckRow[],
    matches: (matches.data ?? []) as PriceMatchRow[],
    // Without the seller read the next step falls back to "the authorized seller(s)".
    sellers: sellers.error ? [] : ((sellers.data ?? []) as WithheldOfferSellerRow[]),
  };
}

/** One read per page load. A failed read is retried on the next mount. */
export function usePriceMatches(): PriceMatchRead {
  const [state, setState] = useState<PriceMatchRead>("loading");
  useEffect(() => {
    let cancelled = false;
    if (!shared) {
      shared = loadPriceMatches().catch(() => "unavailable" as const);
      shared.then((read) => {
        if (read === "unavailable") shared = null;
      });
    }
    shared.then((read) => {
      if (!cancelled) setState(read);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
