/**
 * R-10 step 3 reads: the active client's retailer list and latest retailer checks, plus the few
 * history rows the first-miss rule needs. Pure rules are in retailer-prices.ts.
 */

import { getCanvasSupabase } from "@/lib/supabase/canvas-client";
import {
  firstMissCandidates,
  retailerPriceIndex,
  type RetailerListRow,
  type RetailerPriceIndex,
  type RetailHistoryRow,
  type RetailPriceRow,
} from "@/lib/fender-canvas/retailer-prices";

const PAGE_SIZE = 1000;
const MAX_PAGES = 40;
/** ASINs per `in.(…)` filter, so a request URL stays short. */
const ASIN_CHUNK = 250;
/**
 * How far back the first-miss read looks for the price before a miss. Checkers run every 1 to 3
 * days, so the check before a miss is inside this window; a listing whose previous check is older
 * reads as missing.
 */
export const FIRST_MISS_LOOKBACK_DAYS = 14;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/** The PostgREST calls this file makes, so tests can stand in a fake without the live database. */
export type RetailerPriceClient = {
  from: (view: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

async function allPages<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let n = 0; n < MAX_PAGES; n += 1) {
    const { data, error } = await page(n * PAGE_SIZE, n * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error("The retailer price read stopped before every row was loaded.");
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const HISTORY_COLUMNS = "id,asin,retailer,status,observed_at,price,url";

/**
 * History for the first-miss rule, in two small reads per retailer: the priced checks inside the
 * lookback for listings whose latest check missed, then every miss since the oldest of those.
 * Search results (R-15, source price_search) are not retailer checks and are left out.
 */
async function firstMissHistory(
  client: RetailerPriceClient,
  latest: readonly RetailPriceRow[],
  now: number,
): Promise<RetailHistoryRow[]> {
  const since = new Date(now - FIRST_MISS_LOOKBACK_DAYS * 86_400_000).toISOString();
  const byRetailer = new Map<string, string[]>();
  for (const row of firstMissCandidates(latest)) {
    const list = byRetailer.get(row.retailer) ?? [];
    list.push(row.asin);
    byRetailer.set(row.retailer, list);
  }
  const out: RetailHistoryRow[] = [];
  for (const [retailer, asins] of byRetailer) {
    const priced = (
      await Promise.all(
        chunks(asins, ASIN_CHUNK).map((part) =>
          allPages<RetailHistoryRow>((from, to) =>
            client
              .from("canvas_retail_price_history")
              .select(HISTORY_COLUMNS)
              .eq("retailer", retailer)
              .eq("status", "priced")
              .neq("source", "price_search")
              .gte("observed_at", since)
              .in("asin", part)
              .order("id")
              .range(from, to),
          ),
        ),
      )
    ).flat();
    if (!priced.length) continue;
    out.push(...priced);
    const lost = [...new Set(priced.map((row) => row.asin))];
    const oldest = priced.reduce(
      (min, row) => (row.observed_at && row.observed_at < min ? row.observed_at : min),
      priced[0].observed_at ?? since,
    );
    const misses = (
      await Promise.all(
        chunks(lost, ASIN_CHUNK).map((part) =>
          allPages<RetailHistoryRow>((from, to) =>
            client
              .from("canvas_retail_price_history")
              .select(HISTORY_COLUMNS)
              .eq("retailer", retailer)
              .eq("status", "no_match")
              .neq("source", "price_search")
              .gte("observed_at", oldest)
              .in("asin", part)
              .order("id")
              .range(from, to),
          ),
        ),
      )
    ).flat();
    out.push(...misses);
  }
  return out;
}

/**
 * The active client's retailer list and each listing's effective price per retailer. Throws on a
 * failed read, so a caller shows its figures as unavailable rather than as zero.
 */
export async function loadRetailerPrices(
  client: RetailerPriceClient = getCanvasSupabase() as unknown as RetailerPriceClient,
  now: number = Date.now(),
): Promise<RetailerPriceIndex> {
  const [list, latest] = await Promise.all([
    allPages<RetailerListRow>((from, to) =>
      client.from("canvas_retailers").select("slug,display_name,map_channel,active,sort_order").order("slug").range(from, to),
    ),
    allPages<RetailPriceRow>((from, to) =>
      client
        .from("canvas_retail_prices")
        .select("asin,retailer,status,observed_at,price,url,map_price,leakage")
        .order("asin")
        .order("retailer")
        .range(from, to),
    ),
  ]);
  const history = await firstMissHistory(client, latest, now);
  return retailerPriceIndex(list, latest, history);
}
