/**
 * MAP exposure (FDD R-09): what a price below MAP is worth in discounted retail value.
 *
 * Discounted retail value = price gap below MAP x estimated monthly units, per listing.
 * It is an analyst estimate of the discount given at retail. It is never lost revenue, and it
 * is never added to a Buy Box or out-of-stock figure.
 *
 * Units come from one named source: SmartScout's estimated monthly units for the listing on
 * Amazon.com (`smartscout_monthly_units` on `canvas_listing_sales_loss_v2`, by ASIN). Those are
 * Amazon units, so the gap they multiply is the Amazon gap. A listing priced below MAP only at
 * another retailer has no unit estimate for that retailer and is awaiting inputs. A listing with
 * no unit estimate, or with zero estimated units, is awaiting inputs too. It is never $0.
 *
 * Approved exceptions (R-12) are left out by the caller before the rows arrive here.
 * Violation duration is not built: MAP price history is not stored.
 */

import type { PartialFigure } from "./canvas-reads";
import { formatInt, formatUsd } from "./format";
import type { MapSourceRow } from "./map-channels";
import { mapAsinKey } from "./portfolio-retail";
import { RECHECK_DAYS, rowsStale } from "./row-stale";
import { getCanvasSupabase } from "../supabase/canvas-client";

/** The one units source today. A second source gets its own total; totals are never added. */
export const MAP_UNITS_SOURCE = "SmartScout";

export const MAP_EXPOSURE_LABEL = "Discounted retail value";
export const MAP_UNITS_LABEL = "Est. monthly units";
export const ANALYST_ESTIMATE_LABEL = "analyst estimate";
export const AWAITING_INPUTS_LABEL = "Awaiting inputs";

const UNITS_VIEW = "canvas_listing_sales_loss_v2";
const UNITS_COLUMNS = "asin,smartscout_monthly_units,smartscout_snapshot_date";
const ASIN_CHUNK = 150;

export type MapUnitsRow = {
  asin: string;
  smartscout_monthly_units: number | string | null;
  smartscout_snapshot_date: string | null;
};

export type MapUnitsLookup = ReadonlyMap<string, MapUnitsRow>;

export type MapAwaitingReason =
  /** SmartScout has no record of this listing. */
  | "no_units_source"
  /** SmartScout has the listing and gives no unit estimate for it. */
  | "no_units_estimate"
  /** SmartScout estimates zero units for the month. */
  | "no_units_sold"
  /** Below MAP at another retailer only. The unit estimate is for Amazon. */
  | "other_retailer_only";

export const MAP_AWAITING_REASONS: readonly MapAwaitingReason[] = [
  "no_units_source",
  "no_units_estimate",
  "no_units_sold",
  "other_retailer_only",
];

export type MapExposure =
  | {
      status: "estimated";
      /** Dollars below MAP on Amazon, as a positive number. */
      gap: number;
      units: number;
      value: number;
      snapshotDate: string | null;
    }
  | {
      status: "awaiting";
      reason: MapAwaitingReason;
      /** The SmartScout unit estimate when one is stored, so the column can still show it. */
      units: number | null;
      snapshotDate: string | null;
    };

function finite(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Dollars below MAP on Amazon, positive. Stored Amazon leakage wins; otherwise MAP minus the
 * stored Amazon price. Null when Amazon is at or above MAP or has no stored comparison.
 */
export function amazonGapBelowMap(row: MapSourceRow): number | null {
  const stored = finite(row.amz_leakage);
  if (stored != null) return stored < 0 ? roundMoney(-stored) : null;
  const price = finite(row.offer_price);
  const map = finite(row.map_price);
  if (price == null || map == null || price <= 0 || map <= 0) return null;
  return price < map ? roundMoney(map - price) : null;
}

export function mapUnitsLookup(rows: readonly MapUnitsRow[]): MapUnitsLookup {
  const lookup = new Map<string, MapUnitsRow>();
  for (const row of rows) {
    const key = mapAsinKey(row.asin);
    if (key) lookup.set(key, row);
  }
  return lookup;
}

/** One listing's exposure. Never returns a value of zero dollars. */
export function mapExposure(row: MapSourceRow, lookup: MapUnitsLookup): MapExposure {
  const key = mapAsinKey(row.asin);
  const stored = key ? lookup.get(key) : undefined;
  const units = finite(stored?.smartscout_monthly_units);
  const snapshotDate = stored?.smartscout_snapshot_date ?? null;
  const awaiting = (reason: MapAwaitingReason): MapExposure => ({
    status: "awaiting",
    reason,
    units: units != null && units >= 0 ? units : null,
    snapshotDate,
  });
  if (!stored || (units == null && !snapshotDate)) return awaiting("no_units_source");
  if (units == null || units < 0) return awaiting("no_units_estimate");
  if (units === 0) return awaiting("no_units_sold");
  const gap = amazonGapBelowMap(row);
  if (gap == null || gap <= 0) return awaiting("other_retailer_only");
  const value = roundMoney(gap * units);
  if (!(value > 0)) return awaiting("no_units_sold");
  return { status: "estimated", gap, units, value, snapshotDate };
}

const REASON_SENTENCE: Record<MapAwaitingReason, string> = {
  no_units_source: `${MAP_UNITS_SOURCE} has no record of this listing, so there is no unit estimate to multiply.`,
  no_units_estimate: `${MAP_UNITS_SOURCE} gives no monthly unit estimate for this listing.`,
  no_units_sold: `${MAP_UNITS_SOURCE} estimates no units sold on Amazon in the month.`,
  other_retailer_only: `The price below MAP is at another retailer. The ${MAP_UNITS_SOURCE} unit estimate is for Amazon, and no unit estimate is stored for that retailer.`,
};

const REASON_COUNT_PHRASE: Record<MapAwaitingReason, (n: number) => string> = {
  no_units_source: (n) => `${formatInt(n)} with no ${MAP_UNITS_SOURCE} record`,
  no_units_estimate: (n) => `${formatInt(n)} with no ${MAP_UNITS_SOURCE} unit estimate`,
  no_units_sold: (n) => `${formatInt(n)} where ${MAP_UNITS_SOURCE} estimates no units sold in the month`,
  other_retailer_only: (n) =>
    `${formatInt(n)} priced below MAP only at another retailer, where no unit estimate is stored`,
};

export function awaitingReasonSentence(reason: MapAwaitingReason): string {
  return REASON_SENTENCE[reason];
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Nov 9, 2026" for a stored `YYYY-MM-DD` day, or null. */
export function formatSnapshotDay(day: string | null | undefined): string | null {
  if (!day) return null;
  const at = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(at.getTime()) ? dayFormat.format(at) : null;
}

function unitsWord(units: number): string {
  return units === 1 ? "unit" : "units";
}

/** The row tooltip: the inputs and the multiplication, or why there is no figure. */
export function mapExposureTip(exposure: MapExposure): string {
  const read = formatSnapshotDay(exposure.snapshotDate);
  const readSentence = read ? ` ${MAP_UNITS_SOURCE} read ${read}.` : "";
  if (exposure.status === "awaiting") {
    return `${AWAITING_INPUTS_LABEL}. ${REASON_SENTENCE[exposure.reason]}${readSentence}`;
  }
  return (
    `${formatUsd(exposure.gap)} below MAP on Amazon × ${formatInt(exposure.units)} estimated monthly ${unitsWord(exposure.units)} ` +
    `(${MAP_UNITS_SOURCE}) = ${formatUsd(exposure.value)} a month. Analyst estimate of the discount at retail if the gap and the sales rate hold for a month.${readSentence}`
  );
}

export type MapExposureSummary = {
  /** Listings below MAP, after approved exceptions are left out. */
  violations: number;
  estimated: number;
  awaiting: number;
  awaitingByReason: Record<MapAwaitingReason, number>;
  /** Sum over estimated listings. Null when none is estimated: never $0. */
  totalValue: number | null;
  /** Estimated monthly units on the estimated listings. Null when none is estimated. */
  totalUnits: number | null;
  /** Newest SmartScout read among the listings with a unit estimate. */
  latestSnapshot: string | null;
  source: typeof MAP_UNITS_SOURCE;
  /** X-25: estimated listings whose SmartScout snapshot is older than twice its 7-day recheck. Null when current. */
  stale: PartialFigure | null;
};

/** Totals over the listings below MAP. Rows are the counted rows: approved exceptions already out. */
export function mapExposureSummary(
  rows: readonly MapSourceRow[],
  lookup: MapUnitsLookup,
  now: number = Date.now(),
): MapExposureSummary {
  const awaitingByReason: Record<MapAwaitingReason, number> = {
    no_units_source: 0,
    no_units_estimate: 0,
    no_units_sold: 0,
    other_retailer_only: 0,
  };
  let estimated = 0;
  let value = 0;
  let units = 0;
  let latestSnapshot: string | null = null;
  const snapshots: (string | null)[] = [];
  for (const row of rows) {
    const exposure = mapExposure(row, lookup);
    if (exposure.snapshotDate && (!latestSnapshot || exposure.snapshotDate > latestSnapshot)) {
      latestSnapshot = exposure.snapshotDate;
    }
    if (exposure.status === "awaiting") {
      awaitingByReason[exposure.reason] += 1;
      continue;
    }
    estimated += 1;
    snapshots.push(exposure.snapshotDate);
    value += exposure.value;
    units += exposure.units;
  }
  return {
    violations: rows.length,
    estimated,
    awaiting: rows.length - estimated,
    awaitingByReason,
    totalValue: estimated > 0 ? roundMoney(value) : null,
    totalUnits: estimated > 0 ? units : null,
    latestSnapshot,
    source: MAP_UNITS_SOURCE,
    stale: rowsStale(
      snapshots,
      (at) => at,
      {
        intervalDays: RECHECK_DAYS.smartscout,
        check: `${MAP_UNITS_SOURCE} snapshot`,
        source: "canvas_listing_sales_loss_v2",
        figure: "discounted retail value",
      },
      now,
    ),
  };
}

/** The order the table and its CSV show before a column header is clicked. */
export const MAP_EXPOSURE_ORDER = "Discounted retail value, highest first, then listings awaiting inputs by largest price gap";

/**
 * Estimated listings first, largest discounted retail value first. Listings awaiting inputs
 * follow in the order they arrived (the read's own order: largest price gap first).
 */
export function mapExposureOrder<T extends MapSourceRow>(rows: readonly T[], lookup: MapUnitsLookup): T[] {
  const ranked = rows.map((row, index) => {
    const exposure = mapExposure(row, lookup);
    return { row, index, value: exposure.status === "estimated" ? exposure.value : null };
  });
  ranked.sort((a, b) => {
    if (a.value != null && b.value != null && a.value !== b.value) return b.value - a.value;
    if (a.value != null && b.value == null) return -1;
    if (a.value == null && b.value != null) return 1;
    return a.index - b.index;
  });
  return ranked.map((entry) => entry.row);
}

function listingWord(n: number): string {
  return n === 1 ? "listing" : "listings";
}

/** "Covers 17 of 118 listings below MAP." */
export function mapExposureCoverage(summary: MapExposureSummary): string {
  return `Covers ${formatInt(summary.estimated)} of ${formatInt(summary.violations)} ${listingWord(summary.violations)} below MAP.`;
}

/** "101 are awaiting inputs." Null when every listing is estimated. */
export function mapAwaitingCount(summary: MapExposureSummary): string | null {
  if (summary.awaiting <= 0) return null;
  return `${formatInt(summary.awaiting)} ${summary.awaiting === 1 ? "is" : "are"} awaiting inputs.`;
}

/** What "awaiting inputs" means on MAP exposure, in one sentence. */
export const MAP_AWAITING_RULE = `Unit estimates exist only for Amazon, so a listing priced below MAP only at another retailer, or with no ${MAP_UNITS_SOURCE} unit estimate, or with zero estimated units, is awaiting inputs.`;

/** The awaiting-inputs breakdown, as one sentence. Null when nothing is awaiting. */
export function mapAwaitingSentence(summary: MapExposureSummary): string | null {
  if (summary.awaiting <= 0) return null;
  const parts = MAP_AWAITING_REASONS.filter((reason) => summary.awaitingByReason[reason] > 0).map((reason) =>
    REASON_COUNT_PHRASE[reason](summary.awaitingByReason[reason]),
  );
  return `${formatInt(summary.awaiting)} ${summary.awaiting === 1 ? "is" : "are"} awaiting inputs and ${summary.awaiting === 1 ? "is" : "are"} not counted as $0: ${parts.join("; ")}.`;
}

/**
 * The headline tooltip: the formula, the source, the coverage, and what is awaiting inputs.
 * `exceptions` is the approved-exceptions sentence when any were left out.
 */
export function mapExposureSummaryTip(summary: MapExposureSummary, exceptions?: string | null): string {
  const read = formatSnapshotDay(summary.latestSnapshot);
  return [
    `Each listing's price gap below MAP on Amazon times its ${MAP_UNITS_SOURCE} estimated monthly units on Amazon, added across the listings that have both.`,
    mapExposureCoverage(summary),
    MAP_AWAITING_RULE,
    mapAwaitingSentence(summary),
    "It is the discount at retail for one month if today's gaps and sales rates hold. It is an analyst estimate.",
    read ? `${MAP_UNITS_SOURCE} read ${read}.` : null,
    exceptions ?? null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** SmartScout unit estimates for the given listings. Null when the read failed. */
export async function loadMapUnits(asins: readonly string[]): Promise<MapUnitsRow[] | null> {
  const keys = [...new Set(asins.map((asin) => mapAsinKey(asin)).filter((key): key is string => key != null))];
  const rows: MapUnitsRow[] = [];
  try {
    for (let start = 0; start < keys.length; start += ASIN_CHUNK) {
      const { data, error } = await getCanvasSupabase()
        .from(UNITS_VIEW)
        .select(UNITS_COLUMNS)
        .in("asin", keys.slice(start, start + ASIN_CHUNK));
      if (error) return null;
      rows.push(...((data ?? []) as MapUnitsRow[]));
    }
    return rows;
  } catch {
    return null;
  }
}
