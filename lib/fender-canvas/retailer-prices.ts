/**
 * R-10 step 3: retailer prices as rows. The client's retailer list (`canvas_retailers`) and the
 * latest check per listing and retailer (`canvas_retail_prices`) replace the hard-coded wmt_* /
 * mf_* columns. Pure functions only; the reads live in retailer-prices-read.ts.
 *
 * First-miss rule (Watson, 23 Nov 2026): the checkers keep a price on screen until a second
 * straight miss. So when the newest usable check is `no_match` and the one before it was `priced`,
 * the listing is still priced at that earlier price, checked at the miss. From the second straight
 * miss it is missing. A listing is never both priced and missing. `check_failed` rows say nothing
 * about the price and are skipped, as canvas_retail_prices skips them.
 */

/** One row of `canvas_retailers`. */
export type RetailerListRow = {
  slug: string;
  display_name: string | null;
  map_channel: boolean | null;
  active: boolean | null;
  sort_order: number | null;
};

/** One row of `canvas_retail_prices`: the newest priced or no_match check per listing and retailer. */
export type RetailPriceRow = {
  asin: string;
  retailer: string;
  status: string;
  observed_at: string | null;
  price: number | string | null;
  url: string | null;
  map_price?: number | string | null;
  /** price − MAP on a MAP channel; null elsewhere. */
  leakage?: number | string | null;
};

/** One row of `canvas_retail_price_history`, the fields the first-miss rule reads. */
export type RetailHistoryRow = {
  id?: number | string | null;
  asin: string;
  retailer: string | null;
  status: string;
  observed_at: string | null;
  price?: number | string | null;
  url?: string | null;
};

/** A retailer on the client's list, in screen order. */
export type Retailer = {
  key: string;
  name: string;
  mapChannel: boolean;
};

/** One listing's effective price at one retailer. */
export type RetailerCell = {
  key: string;
  name: string;
  mapChannel: boolean;
  /** Shelf price, or null when the latest effective check matched nothing. */
  price: number | null;
  /** price − MAP on a MAP channel. Null off MAP channels, without a price, or without a MAP. */
  gap: number | null;
  /** The checked page, when one is stored. A page with no price still marks the listing as carried. */
  url: string | null;
  /** When the retailer was last checked for this listing (the miss, under the first-miss rule). */
  checkedAt: string | null;
  /** True when the price is carried over a single miss. */
  firstMiss: boolean;
};

export type RetailerPriceIndex = {
  /** Active retailers, in screen order. Inactive ones are left out of every figure. */
  retailers: Retailer[];
  /** Effective cells per ASIN, in retailer order. Only checked retailers have a cell. */
  byAsin: Map<string, RetailerCell[]>;
};

export const EMPTY_RETAILER_INDEX: RetailerPriceIndex = { retailers: [], byAsin: new Map() };

function finite(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Stored shelf price. Zero and negative values are not a price. */
function positive(value: unknown): number | null {
  const n = finite(value);
  return n == null || n <= 0 ? null : n;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function httpUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function timeMs(value: string | null | undefined): number {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

/** The client's settings key for a retailer slug: `musicians-friend` → `musiciansfriend`. */
export function retailerSettingKey(slug: string): string {
  return slug.replace(/-/g, "");
}

/** Active retailers in sort order (then slug). */
export function activeRetailers(rows: readonly RetailerListRow[]): Retailer[] {
  return rows
    .filter((row) => row.active !== false && typeof row.slug === "string" && row.slug.trim())
    .slice()
    .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.slug.localeCompare(b.slug))
    .map((row) => ({
      key: row.slug.trim(),
      name: row.display_name?.trim() || row.slug.trim(),
      mapChannel: row.map_channel === true,
    }));
}

const key = (asin: string, retailer: string) => `${asin.trim()}\u0000${retailer}`;

/**
 * Applies the first-miss rule. `history` must hold, for every latest `no_match` row that could be
 * a first miss, the newest `priced` row before it and every `no_match` row after that one. Rows of
 * other listings, and older rows, are ignored. Returns the latest rows with each first miss
 * replaced by the earlier price (status `priced`, observed_at still the miss).
 */
export function applyFirstMissRule(
  latest: readonly RetailPriceRow[],
  history: readonly RetailHistoryRow[],
): Array<RetailPriceRow & { firstMiss: boolean }> {
  const priced = new Map<string, RetailHistoryRow>();
  for (const row of history) {
    if (row.status !== "priced" || !row.retailer || positive(row.price) == null) continue;
    const k = key(row.asin, row.retailer);
    const seen = priced.get(k);
    if (!seen || timeMs(row.observed_at) > timeMs(seen.observed_at)) priced.set(k, row);
  }
  const misses = new Map<string, number>();
  for (const row of history) {
    if (row.status !== "no_match" || !row.retailer) continue;
    const k = key(row.asin, row.retailer);
    const last = priced.get(k);
    if (!last || timeMs(row.observed_at) <= timeMs(last.observed_at)) continue;
    misses.set(k, (misses.get(k) ?? 0) + 1);
  }
  return latest.map((row) => {
    if (row.status !== "no_match") return { ...row, firstMiss: false };
    const k = key(row.asin, row.retailer);
    const last = priced.get(k);
    if (!last || misses.get(k) !== 1 || timeMs(last.observed_at) >= timeMs(row.observed_at)) {
      return { ...row, firstMiss: false };
    }
    const price = positive(last.price);
    const map = positive(row.map_price);
    return {
      ...row,
      status: "priced",
      price,
      url: last.url ?? null,
      leakage: price != null && map != null ? roundMoney(price - map) : null,
      firstMiss: true,
    };
  });
}

/** Latest no_match rows that could be a first miss: the ones the history read must cover. */
export function firstMissCandidates(latest: readonly RetailPriceRow[]): RetailPriceRow[] {
  return latest.filter((row) => row.status === "no_match");
}

/** Builds the per-listing cells. Rows for retailers not on the active list are left out. */
export function retailerPriceIndex(
  retailers: readonly RetailerListRow[],
  latest: readonly RetailPriceRow[],
  history: readonly RetailHistoryRow[] = [],
): RetailerPriceIndex {
  const active = activeRetailers(retailers);
  const order = new Map(active.map((retailer, index) => [retailer.key, index]));
  const byAsin = new Map<string, RetailerCell[]>();
  for (const row of applyFirstMissRule(latest, history)) {
    const asin = row.asin?.trim();
    const index = order.get(row.retailer);
    if (!asin || index == null) continue;
    const retailer = active[index];
    const price = row.status === "priced" ? positive(row.price) : null;
    const leakage = finite(row.leakage);
    const map = positive(row.map_price);
    const gap = !retailer.mapChannel || price == null
      ? null
      : leakage != null
        ? roundMoney(leakage)
        : map != null
          ? roundMoney(price - map)
          : null;
    const cells = byAsin.get(asin) ?? [];
    cells.push({
      key: retailer.key,
      name: retailer.name,
      mapChannel: retailer.mapChannel,
      price,
      gap,
      url: httpUrl(row.url),
      checkedAt: row.observed_at ?? null,
      firstMiss: row.firstMiss,
    });
    byAsin.set(asin, cells);
  }
  for (const cells of byAsin.values()) {
    cells.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  }
  return { retailers: active, byAsin };
}

/** The fields the MAP math adds to a listing row. */
export type WithRetailerPrices = {
  retailers: RetailerCell[];
  /** Lowest of the Amazon leakage and every MAP-channel gap. Null when none is stored. */
  worst_leakage: number | null;
  /** True when any of them is below zero. */
  is_map_violation: boolean;
};

/** Amazon's stored leakage plus each MAP channel's gap: the numbers the violation math reads. */
export function mapLeakages(amazonLeakage: unknown, cells: readonly RetailerCell[] | undefined): number[] {
  const values = [finite(amazonLeakage)];
  for (const cell of cells ?? []) if (cell.mapChannel) values.push(cell.gap);
  return values.filter((value): value is number => value != null);
}

/** Attaches each listing's cells, worst leakage and violation flag. */
export function withRetailerPrices<T extends { asin: string; amz_leakage?: number | string | null }>(
  rows: readonly T[],
  index: RetailerPriceIndex,
): Array<T & WithRetailerPrices> {
  return rows.map((row) => {
    const cells = index.byAsin.get(row.asin?.trim()) ?? [];
    const leakages = mapLeakages(row.amz_leakage, cells);
    return {
      ...row,
      retailers: cells,
      worst_leakage: leakages.length ? Math.min(...leakages) : null,
      is_map_violation: leakages.some((value) => value < 0),
    };
  });
}

/** Worst leakage first, missing last; ASIN breaks ties. The order the old view read gave. */
export function byWorstLeakage<T extends { asin: string; worst_leakage: number | null }>(a: T, b: T): number {
  const av = a.worst_leakage;
  const bv = b.worst_leakage;
  if (av == null && bv != null) return 1;
  if (bv == null && av != null) return -1;
  if (av != null && bv != null && av !== bv) return av - bv;
  return a.asin.localeCompare(b.asin);
}
