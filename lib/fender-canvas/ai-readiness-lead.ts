/**
 * AI Readiness tab heroes: share figures already on the old Metric/Result summary.
 * SKUs checked is the shared denominator, not its own pie.
 * Amazon completeness keeps the existing 85 / 92 tone bands from metrics-from-live.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { brandSite } from "@/lib/brand-copy";
import type { NodeStatus } from "@/lib/canvas-sdk/types";
import { metricsRowFailure, READ_NOT_AVAILABLE, readFailureTip } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatPct, formatRatio, pendingLabel } from "@/lib/fender-canvas/format";
import { MISSING_FIELD_SHARE_UNAVAILABLE } from "@/lib/fender-canvas/spec-missing-fields";
import type { CanvasMetricsRow, CanvasSpecReadinessRow } from "@/lib/fender-canvas/types";
import { lastCheckedSentence } from "@/lib/findability/last-checked";

export type AmazonFieldTotals = { found: number; expected: number };

/**
 * Sum filled and expected Amazon attribute fields on Amazon-checked listings.
 * Skips unchecked rows and rows without a positive expected count.
 * Never invents totals from the average percent times listing count.
 */
export function sumAmazonFieldTotals(
  rows: ReadonlyArray<
    Pick<CanvasSpecReadinessRow, "amazon_checked" | "amazon_fields_found" | "amazon_fields_expected">
  >,
): AmazonFieldTotals | null {
  let found = 0;
  let expected = 0;
  let any = false;
  for (const row of rows) {
    if (row.amazon_checked !== true) continue;
    const f = row.amazon_fields_found;
    const e = row.amazon_fields_expected;
    if (typeof e !== "number" || !Number.isFinite(e) || e <= 0) continue;
    if (typeof f !== "number" || !Number.isFinite(f) || f < 0) continue;
    found += f;
    expected += e;
    any = true;
  }
  return any ? { found, expected } : null;
}

/** Prefer metrics-row field totals when both are stored and the count fits. */
export function resolveAmazonFieldTotals(
  m: CanvasMetricsRow,
  fromRows: AmazonFieldTotals | null = null,
): AmazonFieldTotals | null {
  const found = m.spec_amazon_fields_found;
  const expected = m.spec_amazon_fields_expected;
  if (
    typeof found === "number" &&
    Number.isFinite(found) &&
    found >= 0 &&
    typeof expected === "number" &&
    Number.isFinite(expected) &&
    expected > 0 &&
    found <= expected
  ) {
    return { found, expected };
  }
  return fromRows;
}

/**
 * Field-total share for the Amazon completeness hero: "N of M (P%)".
 * P% is the stored average when present; otherwise the share of the field totals.
 * Missing or mismatched totals stay Not available* (never invent from avg × listings).
 */
export function presentAmazonCompletenessFieldShare(
  found: number | null | undefined,
  expected: number | null | undefined,
  avgPct: number | null | undefined,
):
  | { kind: "share"; label: string; ratio: string; percent: string }
  | { kind: "unavailable"; label: typeof MISSING_FIELD_SHARE_UNAVAILABLE } {
  const n =
    typeof found === "number" && Number.isFinite(found) && found >= 0 ? found : null;
  const d =
    typeof expected === "number" && Number.isFinite(expected) && expected > 0 ? expected : null;
  if (n == null || d == null || n > d) {
    return { kind: "unavailable", label: MISSING_FIELD_SHARE_UNAVAILABLE };
  }
  const ratio = formatRatio(n, d);
  const percent =
    typeof avgPct === "number" && Number.isFinite(avgPct)
      ? formatPct(avgPct)
      : formatPct((100 * n) / d);
  return { kind: "share", label: `${ratio} (${percent})`, ratio, percent };
}

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
  /** Status (X-34) behind `color`, for the mark and word beside the figure. */
  tone: Exclude<NodeStatus, "neutral"> | null;
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

/**
 * The status behind a graded share's color (X-34), so the figure carries its mark and word.
 * A figure without a population is not graded: it has no status and shows in muted text.
 */
export function shareFigureTone(
  color: string | null,
  numerator: number | null,
  denominator: number | null,
): Exclude<NodeStatus, "neutral"> | null {
  if (numerator == null || denominator == null || !color) return null;
  const match = (Object.keys(TONE_COLOR) as Array<Exclude<NodeStatus, "neutral">>).find(
    (tone) => TONE_COLOR[tone] === color,
  );
  return match ?? null;
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

/**
 * A hero from a failed metrics read: Not available*, no N of M or disc, and the failed
 * read named first in the label's definition tooltip.
 */
function failedReadHero(hero: AiReadinessHeroModel, m: CanvasMetricsRow): AiReadinessHeroModel {
  const failure = metricsRowFailure(m);
  if (!failure) return hero;
  const tip = readFailureTip(failure);
  return {
    ...hero,
    definition: hero.definition ? `${tip} ${hero.definition}` : tip,
    percent: READ_NOT_AVAILABLE,
    ratio: null,
    color: null,
    tone: null,
    pie: null,
    tip: null,
  };
}

export const PAGE_FOUND_LABEL = `${brandSite()} page found`;

/** Said once wherever the fender.com product check and Findability can disagree. */
export const FENDER_CHECK_DIFFERS =
  `This is the ${brandSite()} product check; the Findability tab runs its own official-page check, so the two can differ.`;

/** The definition with "Last checked …" after it, when the check time is known. */
function checkedDefinition(what: string, checkedAt: string | null | undefined, after?: string): string {
  return [what, lastCheckedSentence(checkedAt ?? null), after].filter(Boolean).join(" ");
}

const PAGE_FOUND_WHAT =
  `Checked SKUs with a matching ${brandSite()} product page, out of every SKU the ${brandSite()} product check covered.`;

export function pageFoundDefinition(checkedAt?: string | null): string {
  return checkedDefinition(PAGE_FOUND_WHAT, checkedAt, FENDER_CHECK_DIFFERS);
}

export const PAGE_FOUND_DEFINITION = pageFoundDefinition(null);

export function pageFoundHero(m: CanvasMetricsRow, checkedAt: string | null = null): AiReadinessHeroModel {
  const checked = m.spec_checked;
  const found = m.spec_fender_found;
  const pct = m.spec_fender_found_pct;
  const ready = checked != null && checked > 0 && found != null && pct != null;
  return failedReadHero({
    id: "page_found",
    label: PAGE_FOUND_LABEL,
    definition: pageFoundDefinition(checkedAt),
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: ready ? formatRatio(found, checked) : null,
    color: toneColor(pageFoundTone(pct)),
    tone: pageFoundTone(pct),
    pie: ready ? shareCountPie("ai-readiness-page-found", `${brandSite()} page found`, "Page found", found!, checked!) : null,
    tip: ready ? `${formatInt(found)} of ${formatInt(checked)} checked SKUs` : null,
  }, m);
}

export function amazonCompletenessHero(
  m: CanvasMetricsRow,
  fieldTotals: AmazonFieldTotals | null = null,
  checkedAt: string | null = null,
): AiReadinessHeroModel {
  const checked = m.spec_checked;
  const pct = m.spec_avg_amazon_pct;
  const tone = amazonCompletenessTone(pct);
  const ready = pct != null && !Number.isNaN(pct);
  const totals = resolveAmazonFieldTotals(m, fieldTotals);
  const share = presentAmazonCompletenessFieldShare(
    totals?.found,
    totals?.expected,
    ready ? pct : null,
  );
  const across =
    typeof checked === "number" && Number.isFinite(checked) && checked > 0
      ? `the Amazon listings of the ${formatInt(checked)} checked SKUs`
      : "the Amazon listings of the checked SKUs";
  return failedReadHero({
    id: "amazon_completeness",
    label: "Amazon attribute completeness",
    definition: checkedDefinition(
      `Filled Amazon attribute fields out of the fields each listing should have, averaged across ${across}. It is an average per listing, not the share of listings with every field filled.`,
      checkedAt,
    ),
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: share.label,
    color: tone ? TONE_COLOR[tone] : null,
    tone,
    pie: averagePercentPie("ai-readiness-amazon-completeness", "Amazon attribute completeness", pct),
    tip: ready ? formatPct(pct) : null,
  }, m);
}

export function fenderCompletenessHero(m: CanvasMetricsRow, checkedAt: string | null = null): AiReadinessHeroModel {
  const found = m.spec_fender_found;
  const pct = m.spec_avg_fender_pct;
  const ready = pct != null && !Number.isNaN(pct);
  return failedReadHero({
    id: "fender_completeness",
    label: `${brandSite()} completeness when a page is found`,
    definition: checkedDefinition(
      `Filled spec fields out of the fields each ${brandSite()} product page should have, averaged across the checked SKUs with a matching ${brandSite()} product page.`,
      checkedAt,
    ),
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: averageAcrossRatio(found != null && found > 0 ? found : null, "found pages"),
    color: toneColor(fenderCompletenessTone(pct)),
    tone: fenderCompletenessTone(pct),
    pie: averagePercentPie("ai-readiness-fender-completeness", `${brandSite()} completeness`, pct),
    tip: ready ? formatPct(pct) : null,
  }, m);
}

export function missingAdditionalPropertyHero(m: CanvasMetricsRow, checkedAt: string | null = null): AiReadinessHeroModel {
  const found = m.spec_fender_found;
  const missing = m.spec_missing_additional_property;
  const ready = found != null && found > 0 && missing != null && missing >= 0 && missing <= found;
  const pct = ready ? (100 * missing!) / found! : null;
  return failedReadHero({
    id: "missing_additional_property",
    label: "Found pages missing additionalProperty",
    definition: checkedDefinition(
      `Checked SKUs whose matching ${brandSite()} product page has no machine-readable spec list (additionalProperty), out of every checked SKU with a matching page.`,
      checkedAt,
    ),
    percent: ready ? formatPct(pct) : pendingLabel(),
    ratio: ready ? formatRatio(missing, found) : null,
    color: null,
    tone: null,
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
  }, m);
}

/**
 * Amazon Specs tab heroes. Amazon attribute completeness only.
 * Page-found stays on the AI Readiness bubble and Findability.
 * Brand-site completeness and missing-spec counts live on Brand-Site Specs.
 */
export function amazonSpecsHeroes(
  m: CanvasMetricsRow,
  fieldTotals: AmazonFieldTotals | null = null,
  checkedAt: string | null = null,
): AiReadinessHeroModel[] {
  return [amazonCompletenessHero(m, fieldTotals, checkedAt)];
}

/** @deprecated Prefer amazonSpecsHeroes for the Amazon Specs tab. */
export function aiReadinessHeroes(m: CanvasMetricsRow): AiReadinessHeroModel[] {
  return amazonSpecsHeroes(m);
}
