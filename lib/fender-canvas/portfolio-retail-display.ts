/**
 * Bubble and panel copy for Catalog Health (file: portfolio-retail-display).
 * Counts come from the reading model. This file does not count rows.
 */

import type { NodeStatus } from "../canvas-sdk/types";
import { CONFIRMED_HIGH_PRICE_LABEL, WITHHELD_LABEL } from "./featured-offer-copy";
import { formatInt, formatPct, formatUsd } from "./format";
import {
  bundlePopulationTip,
  LIVE_OFFER_BUNDLES,
  RETAIL_FINDING_LABELS,
  type SuppressionDetail,
  selectRetailHeadline,
  type MapLeakageDetail,
  type PortfolioRetailFindings,
  type PortfolioRetailSnapshot,
  type RetailHeadline,
  type RetailReading,
  type UnnestedBundleDetail,
} from "./portfolio-retail";
import { approvedExceptionsSentence } from "./map-approved-exceptions";
import { buyBoxHero } from "./retail-overview-lead";

export const RETAIL_OVERVIEW_TAB = "Retail Overview";

/** Keepa stock history and SmartScout sales. Not a ranked retail finding. */
export const STOCK_LOSS_TAB = "Out of Stock";

export const RETAIL_PANEL_TABS = [
  RETAIL_OVERVIEW_TAB,
  RETAIL_FINDING_LABELS.suppressed_listings,
  RETAIL_FINDING_LABELS.map_leakage,
  RETAIL_FINDING_LABELS.unnested_bundles,
  STOCK_LOSS_TAB,
] as const;

export type RetailCanvasRead =
  | { phase: "loading" }
  | { phase: "ready"; snapshot: PortfolioRetailSnapshot }
  | { phase: "error" };

export type RetailBubbleFace = {
  title: string;
  stats: string[];
  meta?: string;
  status: NodeStatus;
  subTab?: string;
  tooltip: { title: string; desc: string };
  /** Main Catalog Health spoke and satellites: one big value plus a short label. */
  heroValue?: { value: string; label: string };
};

const EMPTY_TOOLTIP = { title: "", desc: "" } as const;

export function shortCoverageLine(message: string | null): string | null {
  if (!message) return null;
  const match = message.match(/\d[\d,]*\s+of\s+\d[\d,]*/);
  if (match) return match[0];
  const sentence = message.split(". ")[0]?.trim() || message.trim();
  if (!sentence) return null;
  return sentence.length > 72 ? `${sentence.slice(0, 69).trim()}…` : sentence;
}

export function countPhrase(
  reading: RetailReading<unknown>,
  singular: string,
  plural = `${singular}s`,
): string | null {
  if (reading.issueCount == null) return null;
  const noun = reading.issueCount === 1 ? singular : plural;
  return `${formatInt(reading.issueCount)} ${noun}`;
}

/**
 * The name every copied surface uses for this finding. A reading that confirmed a
 * specific result names it; otherwise the tab label stands in. Keeps the briefing,
 * bubble, satellite, command center, roadmap, and tour on one meaning.
 */
export function readingLabel(reading: RetailReading<unknown>, fallback: string): string {
  return reading.headlineLabel ?? fallback;
}

function tone(reading: RetailReading<unknown>): NodeStatus {
  if (reading.status === "available_with_zero") return "success";
  if (reading.status === "unavailable") return "warning";
  if ((reading.issueCount ?? 0) > 0) return "danger";
  return "warning";
}

function coveragePill(reading: RetailReading<unknown>): string | null {
  if (reading.status !== "incomplete" && reading.status !== "unavailable") return null;
  return shortCoverageLine(reading.missingMessage);
}

/**
 * Satellite share figure: issue count over that finding's own population.
 * Missing denominator stays worded — never a fake 0%.
 */
function shareHeroValue(
  reading: RetailReading<unknown>,
  numerator: number | null,
  denominator: number | null,
): string {
  if (numerator != null && denominator != null && denominator > 0) {
    return formatPct((100 * numerator) / denominator);
  }
  if (reading.status === "available_with_zero" && numerator === 0) {
    return formatPct(0);
  }
  return shortCoverageLine(reading.missingMessage) ?? "Not available";
}

function satelliteFace(
  title: string,
  reading: RetailReading<unknown>,
  heroValue: { value: string; label: string },
  stats: string[],
  subTab: string,
): RetailBubbleFace {
  const pills = stats.filter((entry) => entry.trim().length > 0);
  return {
    title,
    stats: pills.length ? pills : [heroValue.value],
    status: tone(reading),
    subTab,
    heroValue,
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

export type HeadlineSurface = {
  label: string;
  /** Formatted issue count, such as "45 listings". Null when this reading was never stored. */
  countLabel: string | null;
  /** Set for an incomplete or unavailable reading. Null when the reading is complete. */
  missingMessage: string | null;
  /** The finding's own tab. */
  tab: string;
  /** Retail Overview while the headline is Suppressed Listings. Otherwise the finding's tab. */
  commandTab: string;
};

export function headlineSurface(read: RetailCanvasRead): HeadlineSurface {
  if (read.phase !== "ready") {
    return {
      label: "Retail reading",
      countLabel: null,
      missingMessage:
        read.phase === "loading"
          ? "The retail headline is still loading from the stored catalog and offer read."
          : "The retail read could not be loaded from the stored catalog.",
      tab: RETAIL_OVERVIEW_TAB,
      commandTab: RETAIL_OVERVIEW_TAB,
    };
  }

  const headline = selectRetailHeadline(read.snapshot);
  if (!headline) {
    return {
      label: "Catalog Health",
      countLabel: "0 listings",
      missingMessage: null,
      tab: RETAIL_OVERVIEW_TAB,
      commandTab: RETAIL_OVERVIEW_TAB,
    };
  }

  const noun =
    headline.reading.headlineNoun ??
    (headline.findingId === "unnested_bundles" ? "bundle" : "listing");
  const unfinished =
    headline.reading.status === "incomplete" || headline.reading.status === "unavailable";
  return {
    label: readingLabel(headline.reading, headline.label),
    countLabel: countPhrase(headline.reading, noun),
    missingMessage: unfinished ? headline.reading.missingMessage : null,
    tab: headline.label,
    commandTab:
      headline.findingId === "suppressed_listings" ? RETAIL_OVERVIEW_TAB : headline.label,
  };
}

export function headlineSentence(surface: HeadlineSurface): string {
  const lead = surface.countLabel ? `${surface.label}: ${surface.countLabel}` : surface.label;
  return surface.missingMessage ? `${lead}. ${surface.missingMessage}` : `${lead}.`;
}

function countNoun(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatInt(count)} ${count === 1 ? singular : plural}`;
}

/**
 * One pill for the main Catalog Health bubble. The count comes from the reading.
 * An unfinished read keeps its coverage in the tooltip, not in a second pill.
 */
function combinedHeadlineStat(headline: RetailHeadline): string {
  const count = headline.reading.issueCount;
  const label = readingLabel(headline.reading, headline.label);
  if (count == null) return label;

  if (headline.findingId === "suppressed_listings") {
    if (headline.reading.headlineLabel === CONFIRMED_HIGH_PRICE_LABEL) {
      return `${countNoun(count, "listing")} withheld above outside price`;
    }
    if (headline.reading.headlineLabel === WITHHELD_LABEL) {
      return `${countNoun(count, "Buy Box", "Buy Boxes")} withheld`;
    }
  }

  if (headline.findingId === "map_leakage") {
    return `${countNoun(count, "listing")} below MAP`;
  }

  if (headline.findingId === "unnested_bundles") {
    return countNoun(count, "unnested bundle");
  }

  const noun = headline.reading.headlineNoun ?? "listing";
  const counted = countPhrase(headline.reading, noun);
  return counted ? `${label}: ${counted}` : label;
}

export function headlineBubble(findings: PortfolioRetailFindings): RetailBubbleFace {
  const headline = selectRetailHeadline(findings);
  if (!headline) {
    return {
      title: "Catalog Health",
      stats: ["0 listings"],
      meta: "Stored zeros",
      status: "success",
      subTab: RETAIL_OVERVIEW_TAB,
      // "Stored zeros" meta is the whole explanation; no hover needed.
      tooltip: { title: "", desc: "" },
    };
  }

  // An unfinished reading with no usable count keeps its coverage visible as a second
  // stat, not hidden in a hover. A reading that already has a count needs no second line.
  const headlineStat = combinedHeadlineStat(headline);
  const coverage = headline.reading.issueCount == null ? coveragePill(headline.reading) : null;

  return {
    title: "Catalog Health",
    stats: coverage ? [headlineStat, coverage] : [headlineStat],
    status: tone(headline.reading),
    subTab: RETAIL_OVERVIEW_TAB,
    tooltip: { title: "", desc: "" },
  };
}

/**
 * Suppressed Listings satellite. Catalog Health already leads with Buy Box withheld
 * (withheld / current), so this face uses the next-best tab figure: confirmed
 * high-price share of current readings. Missing data stays worded — never a fake 0%.
 */
export function suppressedBubble(
  reading: RetailReading<SuppressionDetail | null>,
): RetailBubbleFace {
  const counts = reading.detail?.counts ?? null;
  const numerator = counts?.confirmedHighPrice ?? null;
  const denominator = counts != null && counts.current > 0 ? counts.current : null;
  const count = countPhrase(reading, reading.headlineNoun ?? "listing");
  const coverage = coveragePill(reading);
  return satelliteFace(
    "Suppressed Listings",
    reading,
    {
      value: shareHeroValue(reading, numerator, denominator),
      label: "confirmed high-price",
    },
    [...(count ? [count] : []), ...(coverage ? [coverage] : [])],
    "Suppressed Listings",
  );
}

/**
 * Below-MAP listings / listings with a stored MAP comparison (`decided`).
 * Approved exceptions are already out of the reading; while any are, the figure carries an
 * asterisk and the satellite tooltip says how many.
 */
export function mapBubble(reading: RetailReading<MapLeakageDetail | null>): RetailBubbleFace {
  const detail = reading.detail;
  const numerator = reading.issueCount;
  const denominator = detail != null && detail.decided > 0 ? detail.decided : null;
  const exceptions = detail?.approvedExceptions ?? 0;
  const mark = exceptions > 0 ? "*" : "";
  const count = countPhrase(reading, "below MAP", "below MAP");
  const gap =
    detail?.averageLeakage != null
      ? `${formatUsd(detail.averageLeakage, { signed: true })} gap`
      : null;
  const coverage = coveragePill(reading);
  const share = shareHeroValue(reading, numerator, denominator);
  const face = satelliteFace(
    "MAP Leakage",
    reading,
    { value: numerator != null && denominator != null ? `${share}${mark}` : share, label: "MAP leakage" },
    [...(count ? [`${count}${mark}`] : []), ...(gap ? [gap] : []), ...(coverage ? [coverage] : [])],
    "MAP",
  );
  if (exceptions > 0) face.tooltip = { title: "MAP leakage", desc: approvedExceptionsSentence(exceptions) };
  return face;
}

/** Unnested bundles / bundles with a live offer (R-13). */
export function catalogBubble(
  reading: RetailReading<UnnestedBundleDetail | null>,
): RetailBubbleFace {
  const detail = reading.detail;
  const numerator = reading.issueCount;
  const denominator = detail != null && detail.bundlesInRead > 0 ? detail.bundlesInRead : null;
  const count =
    numerator != null && denominator != null
      ? `${formatInt(numerator)} of ${formatInt(denominator)} ${LIVE_OFFER_BUNDLES}`
      : countPhrase(reading, "bundle");
  const coverage = coveragePill(reading);
  const face = satelliteFace(
    "Catalog Governance",
    reading,
    {
      value: shareHeroValue(reading, numerator, denominator),
      label: "Splintered listings",
    },
    [...(count ? [count] : []), ...(coverage ? [coverage] : [])],
    "Catalog Governance",
  );
  const tip = bundlePopulationTip(reading);
  if (tip) face.tooltip = { title: "Splintered listings", desc: tip };
  return face;
}

function waitingFace(
  title: string,
  subTab: string | undefined,
  stats: string[],
  desc: string,
  heroLabel?: string,
): RetailBubbleFace {
  return {
    title,
    stats,
    status: "warning",
    subTab,
    // Satellite waiting faces carry a worded hero; main Catalog Health leaves hero unset.
    ...(heroLabel ? { heroValue: { value: stats[0] ?? "Loading", label: heroLabel }, tooltip: { ...EMPTY_TOOLTIP } } : { tooltip: { title, desc } }),
  };
}

/**
 * Catalog Health main spoke: Buy Box withheld share of current readings (same figure as the
 * Retail Overview lead pie). Status follows that share's tone bands. Never invents a 0%.
 */
export function catalogHealthMainFace(read: RetailCanvasRead): RetailBubbleFace {
  if (read.phase === "loading") {
    return {
      title: "Catalog Health",
      stats: [],
      heroValue: { value: "Loading", label: "Buy Box withheld" },
      status: "neutral",
      subTab: RETAIL_OVERVIEW_TAB,
      tooltip: { title: "", desc: "" },
    };
  }
  if (read.phase === "error") {
    return {
      title: "Catalog Health",
      stats: [],
      heroValue: { value: "Read failed", label: "Buy Box withheld" },
      status: "danger",
      subTab: RETAIL_OVERVIEW_TAB,
      tooltip: { title: "", desc: "" },
    };
  }

  const hero = buyBoxHero(read.snapshot);
  const ready = hero.numerator != null && hero.denominator != null;
  return {
    title: "Catalog Health",
    stats: [],
    heroValue: {
      value: ready ? hero.percent : "Not available",
      label: "Buy Box withheld",
    },
    status: hero.tone,
    subTab: RETAIL_OVERVIEW_TAB,
    tooltip: { title: "", desc: "" },
  };
}

export function retailBubbleFaces(read: RetailCanvasRead): {
  main: RetailBubbleFace;
  suppressed: RetailBubbleFace;
  map: RetailBubbleFace;
  catalog: RetailBubbleFace;
} {
  if (read.phase === "loading") {
    const desc = "The retail reading is still loading.";
    return {
      main: catalogHealthMainFace(read),
      suppressed: waitingFace("Suppressed Listings", "Suppressed Listings", ["Loading"], desc, "confirmed high-price"),
      map: waitingFace("MAP Leakage", "MAP", ["Loading"], desc, "MAP leakage"),
      catalog: waitingFace("Catalog Governance", "Catalog Governance", ["Loading"], desc, "Splintered listings"),
    };
  }

  if (read.phase === "error") {
    const desc = "The retail read could not be loaded.";
    return {
      main: catalogHealthMainFace(read),
      suppressed: waitingFace("Suppressed Listings", "Suppressed Listings", ["Read failed"], desc, "confirmed high-price"),
      map: waitingFace("MAP Leakage", "MAP", ["Read failed"], desc, "MAP leakage"),
      catalog: waitingFace("Catalog Governance", "Catalog Governance", ["Read failed"], desc, "Splintered listings"),
    };
  }

  const snapshot = read.snapshot;
  return {
    main: catalogHealthMainFace(read),
    suppressed: suppressedBubble(snapshot.suppressedListings),
    map: mapBubble(snapshot.mapLeakage),
    catalog: catalogBubble(snapshot.unnestedBundles),
  };
}
