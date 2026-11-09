/**
 * Retail Overview heroes: three compact shares (Buy Box, MAP, Catalog Governance).
 * Each pie is N versus the rest of M for that finding's own population.
 * Unchecked / unread listings are never drawn as fine.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import {
  bundlePopulationTip,
  LIVE_OFFER_BUNDLES,
  RETAIL_FINDING_LABELS,
  type PortfolioRetailSnapshot,
  type RetailFindingId,
  type RetailReading,
} from "@/lib/fender-canvas/portfolio-retail";
import { readingLabel } from "@/lib/fender-canvas/portfolio-retail-display";
import { approvedExceptionsSentence } from "@/lib/fender-canvas/map-approved-exceptions";

const TONE_COLOR: Record<Exclude<NodeStatus, "neutral">, string> = {
  danger: "var(--danger-red)",
  warning: "var(--warning-amber)",
  success: "var(--success-green)",
};

export type RetailOverviewHeroId = RetailFindingId | "amazon_spec_gaps";

export type RetailOverviewHeroModel = {
  id: RetailOverviewHeroId;
  /** Tab the click opens (same labels RetailFindingVisual used). */
  tab: string;
  label: string;
  /** Large share figure, or Not available*. */
  percent: string;
  /** Plain N of M when both sides are stored. Null when missing. */
  ratio: string | null;
  color: string;
  tone: Exclude<NodeStatus, "neutral">;
  pie: PieDiscData | null;
  tip: string | null;
  explainer: string;
  numerator: number | null;
  denominator: number | null;
};

/**
 * The figure's status, or null when it reads Not available*. A missing figure carries no
 * status color, mark, or word: status marks data only.
 */
export function heroFigureTone(
  hero: Pick<RetailOverviewHeroModel, "numerator" | "denominator" | "tone">,
): Exclude<NodeStatus, "neutral"> | null {
  return hero.numerator != null && hero.denominator != null ? hero.tone : null;
}

/** The figure's color: its status color, or muted text when there is no figure to grade. */
export function heroFigureColor(
  hero: Pick<RetailOverviewHeroModel, "numerator" | "denominator" | "tone" | "color">,
): string {
  return heroFigureTone(hero) ? hero.color : "var(--text-muted)";
}

function toneForShare(
  numerator: number | null,
  denominator: number | null,
  reading: RetailReading<unknown>,
): Exclude<NodeStatus, "neutral"> {
  if (numerator == null || denominator == null || denominator <= 0) {
    if (reading.status === "unavailable") return "warning";
    return "warning";
  }
  if (numerator === 0) return "success";
  return "danger";
}

/**
 * Specs-complete share bands on the unrounded percentage (complete / checked * 100).
 * Not toneForShare: any missing field would paint red there; Brand Registry lift is the complete share.
 */
function toneForSpecComplete(completePct: number): Exclude<NodeStatus, "neutral"> {
  if (completePct >= 98) return "success";
  if (completePct >= 95) return "warning";
  return "danger";
}

function sharePie(
  id: string,
  title: string,
  issueLabel: string,
  numerator: number,
  denominator: number,
): PieDiscData | null {
  if (denominator <= 0 || numerator < 0 || numerator > denominator) return null;
  const rest = denominator - numerator;
  const slices = [
    { key: "contradicted", label: issueLabel, count: numerator },
    { key: "matched", label: "Rest of this population", count: rest },
  ].filter((slice) => slice.count > 0);
  if (slices.length === 0) return null;
  return {
    id,
    title,
    total: denominator,
    totalLabel: "listings in this population",
    slices,
  };
}

/** Buy Box withheld / current Buy Box readings. Monitored catalog is not the denominator. */
export function buyBoxHero(snapshot: PortfolioRetailSnapshot): RetailOverviewHeroModel {
  const reading = snapshot.suppressedListings;
  const counts = reading.detail?.counts ?? null;
  const label = readingLabel(reading, RETAIL_FINDING_LABELS.suppressed_listings);
  const numerator = counts?.withheld ?? null;
  const denominator = counts != null && counts.current > 0 ? counts.current : null;
  const tone = toneForShare(numerator, denominator, reading);
  const ready = numerator != null && denominator != null;

  return {
    id: "suppressed_listings",
    tab: RETAIL_FINDING_LABELS.suppressed_listings,
    label,
    percent: ready ? formatPct((100 * numerator!) / denominator!) : "Not available*",
    ratio: ready ? formatRatio(numerator, denominator) : null,
    color: TONE_COLOR[tone],
    tone,
    pie: ready ? sharePie("retail-buy-box", label, "Buy Box withheld", numerator!, denominator!) : null,
    tip: ready ? `${formatInt(numerator)} of ${formatInt(denominator)} current Buy Box readings.` : null,
    explainer: ready
      ? "The Buy Box is withheld, so there is no one-click offer."
      : reading.missingMessage?.split(". ")[0] ?? "Buy Box reading not stored.",
    numerator,
    denominator,
  };
}

/**
 * The MAP figure's tooltip: what was counted, what the read could not compare, and how many
 * approved exceptions were left out (R-12). This is the one place the coverage caveat lives.
 */
export function mapLeakageTip(snapshot: PortfolioRetailSnapshot): string | null {
  const reading = snapshot.mapLeakage;
  const detail = reading.detail;
  if (reading.issueCount == null || detail == null || detail.decided <= 0) return null;
  const uncompared = detail.population - detail.decided;
  return [
    `${formatInt(reading.issueCount)} of ${formatInt(detail.decided)} listings with a stored MAP price and at least one stored channel price are priced below MAP.`,
    uncompared > 0
      ? `${formatInt(uncompared)} other ${uncompared === 1 ? "listing" : "listings"} in the retail read ${uncompared === 1 ? "has" : "have"} no stored MAP comparison.`
      : null,
    approvedExceptionsSentence(detail.approvedExceptions ?? 0, snapshot.mapApprovedExceptionsFailed),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Tooltip for the average price gap below MAP: what it averages and the approved exceptions left out. */
export function averageGapTip(snapshot: PortfolioRetailSnapshot): string | null {
  const detail = snapshot.mapLeakage.detail;
  if (detail?.averageLeakage == null) return null;
  return [
    `Average of the largest stored channel gap on each of ${formatInt(detail.violations)} ${detail.violations === 1 ? "listing" : "listings"} priced below MAP.`,
    approvedExceptionsSentence(detail.approvedExceptions ?? 0, snapshot.mapApprovedExceptionsFailed),
  ].join(" ");
}

/**
 * Below-MAP listings / listings with a stored MAP comparison (`decided`).
 * Listings with no MAP price cannot leak MAP and stay out of the pie. Approved exceptions
 * are out of both sides, and the N of M carries an asterisk while any are left out.
 */
export function mapHero(snapshot: PortfolioRetailSnapshot): RetailOverviewHeroModel {
  const reading = snapshot.mapLeakage;
  const detail = reading.detail;
  const label = "MAP leakage";
  const numerator = reading.issueCount;
  const denominator = detail != null && detail.decided > 0 ? detail.decided : null;
  const tone = toneForShare(numerator, denominator, reading);
  const ready = numerator != null && denominator != null;
  const filtered = (detail?.approvedExceptions ?? 0) > 0;

  return {
    id: "map_leakage",
    tab: RETAIL_FINDING_LABELS.map_leakage,
    label,
    percent: ready ? formatPct((100 * numerator!) / denominator!) : "Not available*",
    ratio: ready ? `${formatRatio(numerator, denominator)}${filtered ? "*" : ""}` : null,
    color: TONE_COLOR[tone],
    tone,
    pie: ready ? sharePie("retail-map", label, "Below MAP", numerator!, denominator!) : null,
    tip: ready ? mapLeakageTip(snapshot) : null,
    explainer: ready ? "Priced below MAP." : reading.missingMessage?.split(". ")[0] ?? "MAP reading not stored.",
    numerator,
    denominator,
  };
}

/**
 * Unnested bundles / bundles with a live offer (R-13). The ratio names that population;
 * the tooltip carries the live-offer rule and the wider bundle totals.
 */
export function catalogHero(snapshot: PortfolioRetailSnapshot): RetailOverviewHeroModel {
  const reading = snapshot.unnestedBundles;
  const detail = reading.detail;
  const label = RETAIL_FINDING_LABELS.unnested_bundles;
  const numerator = reading.issueCount;
  const denominator = detail != null && detail.bundlesInRead > 0 ? detail.bundlesInRead : null;
  const tone = toneForShare(numerator, denominator, reading);
  const ready = numerator != null && denominator != null;

  return {
    id: "unnested_bundles",
    tab: label,
    label,
    percent: ready ? formatPct((100 * numerator!) / denominator!) : "Not available*",
    ratio: ready ? `${formatRatio(numerator, denominator)} ${LIVE_OFFER_BUNDLES}` : null,
    color: TONE_COLOR[tone],
    tone,
    pie: ready
      ? sharePie("retail-catalog", label, "Unnested bundle", numerator!, denominator!)
      : null,
    tip: ready ? bundlePopulationTip(reading) : null,
    explainer: ready
      ? "No parent listing, so the reviews stay split."
      : reading.missingMessage?.split(". ")[0] ?? "Catalog reading not stored.",
    numerator,
    denominator,
  };
}

function specCompletePie(complete: number, missing: number, checked: number): PieDiscData | null {
  if (checked <= 0 || complete < 0 || missing < 0 || complete + missing !== checked) return null;
  const slices = [
    { key: "matched", label: "Specs filled", count: complete },
    { key: "contradicted", label: "Missing a field", count: missing },
  ].filter((slice) => slice.count > 0);
  if (slices.length === 0) return null;
  return {
    id: "catalog-spec",
    title: "Specs complete",
    total: checked,
    totalLabel: "checked listings",
    slices,
  };
}

/**
 * Share of checked listings with every Amazon spec field filled (Brand Registry lift).
 * Unchecked listings stay out of the numerator and the denominator.
 */
export function specHero(snapshot: PortfolioRetailSnapshot): RetailOverviewHeroModel {
  const reading = snapshot.amazonSpecGaps;
  const checked = reading.detail != null && reading.detail.checked > 0 ? reading.detail.checked : null;
  const missing = reading.issueCount;
  const ready = checked != null && missing != null && missing >= 0 && missing <= checked;
  const complete = ready ? checked! - missing! : null;
  const completePct = ready ? (100 * complete!) / checked! : null;
  const tone = completePct != null ? toneForSpecComplete(completePct) : "warning";

  return {
    id: "amazon_spec_gaps",
    tab: "Amazon Specs",
    label: "Specs complete",
    percent: ready ? formatPct(completePct) : "Not available*",
    ratio: ready ? formatRatio(complete, checked) : null,
    color: TONE_COLOR[tone],
    tone,
    pie: ready ? specCompletePie(complete!, missing!, checked!) : null,
    tip: ready
      ? [
          `${formatInt(missing)} of ${formatInt(checked)} checked listings are missing an Amazon spec field.`,
          reading.status === "incomplete" ? reading.missingMessage : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null,
    explainer: ready
      ? "Every Amazon spec field is filled."
      : reading.missingMessage?.split(". ")[0] ?? "Amazon spec-field reading not stored.",
    numerator: complete,
    denominator: checked,
  };
}

/** The three Retail Overview heroes, Buy Box then MAP then Catalog Governance. */
export function retailOverviewHeroes(snapshot: PortfolioRetailSnapshot): RetailOverviewHeroModel[] {
  return [buyBoxHero(snapshot), mapHero(snapshot), catalogHero(snapshot)];
}
