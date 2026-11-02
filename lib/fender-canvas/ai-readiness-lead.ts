/**
 * AI Readiness tab heroes: share figures already on the old Metric/Result summary.
 * SKUs checked is the shared denominator, not its own pie.
 * Amazon completeness keeps the existing 85 / 92 tone bands from metrics-from-live.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { formatInt, formatPct, formatRatio, pendingLabel } from "@/lib/fender-canvas/format";
import type { CanvasMetricsRow } from "@/lib/fender-canvas/types";

/** Same bands as metrics-from-live toneFromPct(spec_avg_amazon_pct, 85, 92). */
export const AMAZON_COMPLETENESS_BANDS = { dangerBelow: 85, warnBelow: 92 } as const;

/**
 * fender.com page found share. Under 85 red; 85 through 95 yellow; above 95 green.
 * The named bounds 85 and 95 are yellow.
 */
export const PAGE_FOUND_BANDS = { redBelow: 85, greenAbove: 95 } as const;

/**
 * fender.com completeness when a page is found. Under 95 red; 95 through 98 yellow;
 * above 98 green. The named bounds 95 and 98 are yellow.
 */
export const FENDER_COMPLETENESS_BANDS = { redBelow: 95, greenAbove: 98 } as const;

const TONE_COLOR: Record<Exclude<NodeStatus, "neutral">, string> = {
  danger: "var(--danger-red)",
  warning: "var(--warning-amber)",
  success: "var(--success-green)",
};

export type AiReadinessHeroId =
  | "page_found"
  | "amazon_completeness"
  | "fender_completeness"
  | "missing_additional_property";

export type AiReadinessHeroModel = {
  id: AiReadinessHeroId;
  label: string;
  /** Definition for dotted-underline jargon, when present. */
  definition: string | null;
  percent: string;
  /** N of M, or a count phrase that cannot be read as a second percentage. */
  ratio: string | null;
  color: string | null;
  pie: PieDiscData | null;
  tip: string | null;
};

function amazonCompletenessTone(pct: number | null): Exclude<NodeStatus, "neutral"> | null {
  if (pct == null || Number.isNaN(pct)) return null;
  if (pct < AMAZON_COMPLETENESS_BANDS.dangerBelow) return "danger";
  if (pct < AMAZON_COMPLETENESS_BANDS.warnBelow) return "warning";
  return "success";
}

/** Inclusive yellow band between redBelow and greenAbove. */
function shareTone(
  pct: number | null,
  bands: { redBelow: number; greenAbove: number },
): Exclude<NodeStatus, "neutral"> | null {
  if (pct == null || Number.isNaN(pct)) return null;
  if (pct < bands.redBelow) return "danger";
  if (pct <= bands.greenAbove) return "warning";
  return "success";
}

export function pageFoundTone(pct: number | null): Exclude<NodeStatus, "neutral"> | null {
  return shareTone(pct, PAGE_FOUND_BANDS);
}

export function fenderCompletenessTone(pct: number | null): Exclude<NodeStatus, "neutral"> | null {
  return shareTone(pct, FENDER_COMPLETENESS_BANDS);
}

export function toneColor(tone: Exclude<NodeStatus, "neutral"> | null): string | null {
  return tone ? TONE_COLOR[tone] : null;
}

/** Disc of a 0-100 average percent (filled versus remainder to full). */
export function averagePercentPie(
  id: string,
  title: string,
  pct: number | null,
): PieDiscData | null {
  if (pct == null || Number.isNaN(pct) || pct < 0 || pct > 100) return null;
  const filled = pct;
  const rest = 100 - pct;
  const slices = [
    { key: "matched", label: "Average completeness", count: filled },
    { key: "none", label: "Remainder to full", count: rest },
  ].filter((slice) => slice.count > 0);
  if (slices.length === 0) return null;
  return {
    id,
    title,
    total: 100,
    totalLabel: "parts of average completeness",
    slices,
  };
}

/** Disc of a count versus the rest of a population. */
export function shareCountPie(
  id: string,
  title: string,
  shareLabel: string,
  numerator: number,
  denominator: number,
): PieDiscData | null {
  if (denominator <= 0 || numerator < 0 || numerator > denominator) return null;
  const rest = denominator - numerator;
  const slices = [
    { key: "matched", label: shareLabel, count: numerator },
    { key: "none", label: "Rest of this population", count: rest },
  ].filter((slice) => slice.count > 0);
  if (slices.length === 0) return null;
  return {
    id,
    title,
    total: denominator,
    totalLabel: "in this population",
    slices,
  };
}

/** Ratio text for an average: names the population so it is not a second percentage. */
export function averageAcrossRatio(count: number | null, unit: string): string | null {
  if (count == null || count < 0) return null;
  return `Across ${formatInt(count)} ${unit}`;
}

export function pageFoundHero(m: CanvasMetricsRow): AiReadinessHeroModel {
  const checked = m.spec_checked;
  const found = m.spec_fender_found;
  const pct = m.spec_fender_found_pct;
  const ready = checked != null && checked > 0 && found != null && pct != null;
  return {
    id: "page_found",
    label: "fender.com page found",
    definition:
      "Share of checked SKUs in this older spec read where site search stored a fender.com page. Official-page outcomes are on the Findability tab.",
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: ready ? formatRatio(found, checked) : null,
    color: toneColor(pageFoundTone(pct)),
    pie: ready ? shareCountPie("ai-readiness-page-found", "fender.com page found", "Page found", found!, checked!) : null,
    tip: ready ? `${formatInt(found)} of ${formatInt(checked)} checked SKUs` : null,
  };
}

export function amazonCompletenessHero(m: CanvasMetricsRow): AiReadinessHeroModel {
  const checked = m.spec_checked;
  const pct = m.spec_avg_amazon_pct;
  const tone = amazonCompletenessTone(pct);
  const ready = pct != null && !Number.isNaN(pct);
  return {
    id: "amazon_completeness",
    label: "Amazon attribute completeness",
    definition:
      "Average Amazon attribute completeness across the checked SKUs in this catalog spec read. This is an average, not a count of listings at 100%.",
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: averageAcrossRatio(checked != null && checked > 0 ? checked : null, "checked SKUs"),
    color: tone ? TONE_COLOR[tone] : null,
    pie: averagePercentPie("ai-readiness-amazon-completeness", "Amazon attribute completeness", pct),
    tip: ready ? formatPct(pct) : null,
  };
}

export function fenderCompletenessHero(m: CanvasMetricsRow): AiReadinessHeroModel {
  const found = m.spec_fender_found;
  const pct = m.spec_avg_fender_pct;
  const ready = pct != null && !Number.isNaN(pct);
  return {
    id: "fender_completeness",
    label: "fender.com completeness when a page is found",
    definition:
      "Average fender.com completeness on the checked SKUs where a page was found in this older spec read.",
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: averageAcrossRatio(found != null && found > 0 ? found : null, "found pages"),
    color: toneColor(fenderCompletenessTone(pct)),
    pie: averagePercentPie("ai-readiness-fender-completeness", "fender.com completeness", pct),
    tip: ready ? formatPct(pct) : null,
  };
}

export function missingAdditionalPropertyHero(m: CanvasMetricsRow): AiReadinessHeroModel {
  const found = m.spec_fender_found;
  const missing = m.spec_missing_additional_property;
  const ready = found != null && found > 0 && missing != null && missing >= 0 && missing <= found;
  const pct = ready ? (100 * missing!) / found! : null;
  return {
    id: "missing_additional_property",
    label: "Found pages missing additionalProperty",
    definition:
      "Share of found fender.com pages in this older spec read whose stored missing fields include additionalProperty.",
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: ready ? formatRatio(missing, found) : null,
    color: null,
    pie: ready
      ? shareCountPie(
          "ai-readiness-missing-additional-property",
          "Found pages missing additionalProperty",
          "Missing additionalProperty",
          missing!,
          found!,
        )
      : null,
    tip: ready ? `${formatInt(missing)} of ${formatInt(found)} found pages` : null,
  };
}

/**
 * Amazon Specs tab heroes. Amazon attribute completeness only.
 * Page-found stays on the AI Readiness bubble and Findability.
 * Brand-site completeness and missing-spec counts live on Brand-Site Specs.
 */
export function amazonSpecsHeroes(m: CanvasMetricsRow): AiReadinessHeroModel[] {
  return [amazonCompletenessHero(m)];
}

/** @deprecated Prefer amazonSpecsHeroes for the Amazon Specs tab. */
export function aiReadinessHeroes(m: CanvasMetricsRow): AiReadinessHeroModel[] {
  return amazonSpecsHeroes(m);
}
