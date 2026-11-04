import { divisionKey, type DivisionCensus } from "./division-census";
import { formatInt, formatPct, formatRatio } from "./format";
import type { CanvasDivisionRow } from "./types";

export const NOT_AVAILABLE = "Not available*";

/** At or above this share of SKUs, nesting bundle listings is the division's next step. */
export const BUNDLE_LED_SHARE = 0.5;

export const DIVISION_NEXT_STEP_RULE = `A division where bundle listings are at least ${Math.round(
  BUNDLE_LED_SHARE * 100,
)}% of its SKUs opens Catalog Governance to nest them under a parent ASIN. Every other division opens Retail Overview to check who holds its Buy Box.`;

export type DivisionCell = {
  /** Main figure, or "Not available*". */
  value: string;
  /** N of M under the figure, saying what was counted. Null when the figure is missing. */
  count: string | null;
  tip: string;
};

export type DivisionNextStep = {
  label: string;
  tab: "Catalog Governance" | "Retail Overview";
};

export type DivisionRowModel = {
  division: string;
  bundles: DivisionCell;
  buyBox: DivisionCell;
  next: DivisionNextStep;
};

function count(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function bundleCell(row: CanvasDivisionRow): DivisionCell {
  const skus = count(row.monitored_skus);
  const bundles = count(row.splinter_bundles);
  if (skus == null || skus === 0 || bundles == null) {
    return {
      value: NOT_AVAILABLE,
      count: null,
      tip: `The bundle count for ${row.division} has not been stored.`,
    };
  }
  return {
    value: formatPct((100 * bundles) / skus),
    count: `${formatRatio(bundles, skus)} ${plural(skus, "SKU", "SKUs")}`,
    tip: `${formatInt(bundles)} of the ${formatInt(skus)} ${row.division} ${plural(skus, "SKU", "SKUs")} in the division read ${plural(bundles, "is a bundle listing", "are bundle listings")}: a product sold with extras under its own ASIN.`,
  };
}

function buyBoxCell(row: CanvasDivisionRow, census: DivisionCensus | null): DivisionCell {
  if (census == null) {
    return {
      value: NOT_AVAILABLE,
      count: null,
      tip: `The Buy Box read did not load, so the listings behind ${row.division}'s Buy Box share cannot be counted.`,
    };
  }
  const key = divisionKey(row.division);
  const entry = key ? census[key] : undefined;
  if (!entry || entry.knownHolder === 0) {
    const listings = entry?.listings ?? 0;
    return {
      value: NOT_AVAILABLE,
      count: null,
      tip:
        listings === 0
          ? `No ${row.division} listing is in the retail read.`
          : `None of the ${formatInt(listings)} ${row.division} ${plural(listings, "listing", "listings")} in the retail read has a known Buy Box holder.`,
    };
  }
  const unknown = entry.listings - entry.knownHolder;
  const rest =
    unknown > 0
      ? ` ${formatInt(unknown)} other ${plural(unknown, "listing has", "listings have")} no known holder.`
      : "";
  return {
    value: formatPct((100 * entry.amazonHolds) / entry.knownHolder),
    count: `${formatRatio(entry.amazonHolds, entry.knownHolder)} ${plural(entry.knownHolder, "listing", "listings")}`,
    tip: `Amazon Retail holds the Buy Box on ${formatInt(entry.amazonHolds)} of the ${formatInt(entry.knownHolder)} ${row.division} ${plural(entry.knownHolder, "listing", "listings")} whose Buy Box holder is known.${rest}`,
  };
}

function nextStep(row: CanvasDivisionRow): DivisionNextStep {
  const skus = count(row.monitored_skus);
  const bundles = count(row.splinter_bundles);
  if (skus && bundles != null && bundles / skus >= BUNDLE_LED_SHARE) {
    return { label: "Nest bundle listings", tab: "Catalog Governance" };
  }
  return { label: "Check Buy Box holders", tab: "Retail Overview" };
}

/** One row per stored division: bundle share, Amazon's Buy Box share, and one next step. */
export function divisionRowModels(
  divisions: CanvasDivisionRow[],
  census: DivisionCensus | null,
): DivisionRowModel[] {
  return divisions.map((row) => ({
    division: row.division,
    bundles: bundleCell(row),
    buyBox: buyBoxCell(row, census),
    next: nextStep(row),
  }));
}
