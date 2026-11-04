/**
 * Summary Briefing executive findings: five compact shares in one row.
 * Retail shares reuse Retail Overview populations. Findability and unbranded
 * discovery reuse their home-tab rates. No invented revenue dollars.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import {
  roleRateLead,
  summarizeRun,
  UNBRANDED_RATE_BANDS,
} from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { CANVAS_READS, failedReadTip, READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatRatio } from "@/lib/fender-canvas/format";
import { activeOfferClarity } from "@/lib/fender-canvas/offer-clarity";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import {
  buyBoxHero,
  catalogHero,
  mapHero,
  type RetailOverviewHeroModel,
} from "@/lib/fender-canvas/retail-overview-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { FindabilityRead } from "@/lib/findability/copy";
import {
  exactPageLeadPie,
  exactPageLeadTip,
  exactPageShareColor,
  outcomeRatioFigure,
  outcomeShareFigure,
} from "@/lib/findability/lead";
import { countFindability } from "@/lib/findability/outcomes";
import { leadBrand } from "@/lib/brand-copy";

export const BRIEFING_COUNT_MISSING = "Not available*";

/**
 * Searched PortfolioRetailSnapshot detail/counts and CanvasMetricsRow once.
 * No stored field is clearly monthly potential lost brand revenue.
 */
export const BRIEFING_LOST_REVENUE_LABEL = "Monthly potential lost brand revenue";
export const BRIEFING_LOST_REVENUE_FIGURE = BRIEFING_COUNT_MISSING;

export type BriefingFindingId =
  | "buy_box"
  | "map_leakage"
  | "splintered_bundles"
  | "exact_official_product"
  | "unbranded_discovery";

export type BriefingFinding = {
  id: BriefingFindingId;
  spokeId: "ecommerce" | "specs" | "aeo";
  tab: string;
  label: string;
  percent: string;
  ratio: string | null;
  color: string;
  tone: Exclude<NodeStatus, "neutral">;
  pie: PieDiscData | null;
  tip: string | null;
  explainer: string;
  numerator: number | null;
  denominator: number | null;
};

export type BriefingLostRevenuePlaceholder = {
  label: string;
  figure: string;
  explainer: string;
};

export type BriefingFindingsLead = {
  findings: BriefingFinding[];
  lostRevenue: BriefingLostRevenuePlaceholder;
};

const TONE_COLOR: Record<Exclude<NodeStatus, "neutral">, string> = {
  danger: "var(--danger-red)",
  warning: "var(--warning-amber)",
  success: "var(--success-green)",
};

function fromRetailHero(
  id: BriefingFindingId,
  hero: RetailOverviewHeroModel,
  label: string,
  explainer: string,
): BriefingFinding {
  return {
    id,
    spokeId: "ecommerce",
    tab: hero.tab,
    label,
    percent: hero.percent,
    ratio: hero.ratio,
    color: hero.color,
    tone: hero.tone,
    pie: hero.pie,
    tip: hero.tip,
    explainer,
    numerator: hero.numerator,
    denominator: hero.denominator,
  };
}

function missingFinding(
  id: BriefingFindingId,
  spokeId: BriefingFinding["spokeId"],
  tab: string,
  label: string,
  explainer: string,
): BriefingFinding {
  return {
    id,
    spokeId,
    tab,
    label,
    percent: BRIEFING_COUNT_MISSING,
    ratio: null,
    color: TONE_COLOR.warning,
    tone: "warning",
    pie: null,
    tip: null,
    explainer,
    numerator: null,
    denominator: null,
  };
}

function retailFindings(read: RetailCanvasRead): BriefingFinding[] {
  if (read.phase !== "ready") {
    return [
      missingFinding(
        "buy_box",
        "ecommerce",
        "Suppressed Listings",
        "Buy Box withheld",
        "Buy Box reading not stored.",
      ),
      missingFinding("map_leakage", "ecommerce", "MAP", "MAP leakage", "MAP reading not stored."),
      missingFinding(
        "splintered_bundles",
        "ecommerce",
        "Catalog Governance",
        "Splintered bundles",
        "Catalog reading not stored.",
      ),
    ];
  }

  const snapshot = read.snapshot;
  const buyBox = buyBoxHero(snapshot);
  const map = mapHero(snapshot);
  const catalog = catalogHero(snapshot);

  return [
    fromRetailHero(
      "buy_box",
      buyBox,
      "Buy Box withheld",
      buyBox.numerator != null && buyBox.denominator != null
        ? "The Buy Box is withheld, so there is no one-click offer."
        : buyBox.explainer,
    ),
    fromRetailHero(
      "map_leakage",
      map,
      "MAP leakage",
      map.numerator != null && map.denominator != null ? "Priced below MAP." : map.explainer,
    ),
    fromRetailHero(
      "splintered_bundles",
      { ...catalog, label: "Splintered bundles" },
      "Splintered bundles",
      catalog.numerator != null && catalog.denominator != null
        ? "No usable parent ASIN, so reviews stay split."
        : catalog.explainer,
    ),
  ];
}

function findabilityFinding(read: FindabilityRead): BriefingFinding {
  if (read.phase !== "ready") {
    return missingFinding(
      "exact_official_product",
      "specs",
      "Findability",
      "Exact official product pages",
      "Official-page reading not stored.",
    );
  }

  const counts = countFindability(read.rows);
  const percent = outcomeShareFigure(counts, "exact_official_product");
  const ratio = outcomeRatioFigure(counts, "exact_official_product");
  const color = exactPageShareColor(counts);
  const ready = percent != null && ratio != null && counts.total > 0;
  const tone: Exclude<NodeStatus, "neutral"> = !ready
    ? "warning"
    : (100 * counts.exact_official_product) / counts.total < 25
      ? "danger"
      : (100 * counts.exact_official_product) / counts.total > 60
        ? "success"
        : "warning";

  return {
    id: "exact_official_product",
    spokeId: "specs",
    tab: "Findability",
    label: "Exact official product pages",
    percent: ready ? percent! : BRIEFING_COUNT_MISSING,
    ratio: ready ? ratio : null,
    color: color ?? TONE_COLOR.warning,
    tone,
    pie: ready ? exactPageLeadPie(counts) : null,
    tip: ready ? exactPageLeadTip(counts) : null,
    explainer: ready
      ? "One official product page for this variant. A family page is not an exact page."
      : "Official-page reading not stored.",
    numerator: ready ? counts.exact_official_product : null,
    denominator: ready ? counts.total : null,
  };
}

function unbrandedPie(fenderWins: number, resolved: number): PieDiscData | null {
  if (resolved <= 0 || fenderWins < 0 || fenderWins > resolved) return null;
  const rest = resolved - fenderWins;
  return {
    id: "briefing-unbranded",
    title: "Unbranded discovery",
    total: resolved,
    totalLabel: "resolved unbranded discovery answers",
    slices: [
      { key: "fender", label: `${leadBrand()} leads`, count: fenderWins },
      { key: "rest", label: "Rest of resolved answers", count: rest },
    ].filter((slice) => slice.count > 0),
  };
}

function unbrandedFinding(read: AiSearchRead): BriefingFinding {
  if (read.phase !== "ready") {
    return missingFinding(
      "unbranded_discovery",
      "aeo",
      "Run Details",
      "Unbranded discovery",
      "AI Search reading not stored.",
    );
  }

  const tally = summarizeRun(read.snapshot).roles.unbranded;
  const lead = roleRateLead(tally, UNBRANDED_RATE_BANDS);
  const ready = lead.rate != null && tally.resolved > 0;
  const tone: Exclude<NodeStatus, "neutral"> = !ready
    ? "warning"
    : (100 * tally.fenderWins) / tally.resolved < UNBRANDED_RATE_BANDS.redBelow
      ? "danger"
      : (100 * tally.fenderWins) / tally.resolved > UNBRANDED_RATE_BANDS.greenAbove
        ? "success"
        : "warning";

  return {
    id: "unbranded_discovery",
    spokeId: "aeo",
    tab: "Run Details",
    label: "Unbranded discovery",
    percent: ready ? lead.rate! : BRIEFING_COUNT_MISSING,
    ratio: ready ? formatRatio(tally.fenderWins, tally.resolved) : null,
    color: lead.color ?? TONE_COLOR.warning,
    tone,
    pie: ready ? unbrandedPie(tally.fenderWins, tally.resolved) : null,
    tip: ready
      ? `${formatInt(tally.fenderWins)} of ${formatInt(tally.resolved)} resolved unbranded discovery answers.`
      : null,
    explainer: ready
      ? `${leadBrand()} named most on unbranded shopping questions.`
      : "No resolved unbranded discovery answers in this window.",
    numerator: ready ? tally.fenderWins : null,
    denominator: ready ? tally.resolved : null,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The Briefing "Active offers" line. The offer split comes from canvas_metrics, so a failed
 * read is Not available* with the read named in the shared custom tooltip (HTML, for the
 * Briefing template), never a zero or "not stored".
 */
export function activeOffersLine(bundle: CanvasBundle): string {
  const tip = failedReadTip(bundle, "m");
  if (!tip) return activeOfferClarity(bundle.m);
  const desc = escapeHtml(tip);
  return `<span class="ifai-term" data-ifai-tooltip-title="${READ_NOT_AVAILABLE}" data-ifai-tooltip-desc="${desc}" data-read-unavailable="${CANVAS_READS.m.source}" tabindex="0" aria-label="${READ_NOT_AVAILABLE}: ${desc}">${READ_NOT_AVAILABLE}</span>`;
}

export function briefingLostRevenuePlaceholder(): BriefingLostRevenuePlaceholder {
  return {
    label: BRIEFING_LOST_REVENUE_LABEL,
    figure: BRIEFING_LOST_REVENUE_FIGURE,
    explainer: "Not stored in this reading yet.",
  };
}

/**
 * Five executive findings for Summary Briefing, plus the lost-revenue placeholder
 * that sits beside Buy Box (not a sixth finding).
 */
export function briefingFindingsLead(
  retail: RetailCanvasRead,
  findability: FindabilityRead,
  ai: AiSearchRead,
): BriefingFindingsLead {
  const [buyBox, map, bundles] = retailFindings(retail);
  return {
    findings: [buyBox, map, bundles, findabilityFinding(findability), unbrandedFinding(ai)],
    lostRevenue: briefingLostRevenuePlaceholder(),
  };
}
