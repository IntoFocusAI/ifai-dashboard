import { ENTERPRISE_POTENTIAL_ESTIMATE, PHASE_ONE_LIFT_ESTIMATE } from "@/lib/fender-canvas/analyst-estimates";
import type { CanvasAiCategoryRow, CanvasBundle, CanvasMetricsRow } from "@/lib/fender-canvas/types";
import {
  formatEstimate,
  formatInt,
  formatPct,
  formatRatio,
  formatUsd,
  pendingLabel,
  sanitizeUiText,
  titleCaseCategory,
} from "@/lib/fender-canvas/format";

function catRow(cats: CanvasAiCategoryRow[], slug: string) {
  return cats.find((c) => c.category === slug);
}

function kpiString(m: CanvasMetricsRow, key: string, fallback: string): string {
  const raw = m.kpi?.[key];
  if (raw == null) return fallback;
  return sanitizeUiText(String(raw));
}

export function buildTemplateVars(bundle: CanvasBundle): Record<string, string> {
  const { m, cats } = bundle;
  const beginner = catRow(cats, "beginner");
  const weakestLabel = m.weakest_category ? titleCaseCategory(m.weakest_category) : pendingLabel();

  const noOfferPct =
    m.catalog_skus != null && m.bb_no_offer != null && Number(m.catalog_skus) > 0
      ? (Number(m.bb_no_offer) / Number(m.catalog_skus)) * 100
      : null;

  const vars: Record<string, string> = {
    catalog_skus: formatInt(m.catalog_skus),
    catalog_bundles: formatInt(m.catalog_bundles),
    division_count: formatInt(bundle.divisions.length > 0 ? bundle.divisions.length : m.division_count),
    bb_total: formatInt(m.bb_total),
    bb_1p: formatInt(m.bb_1p),
    bb_3p: formatInt(m.bb_3p),
    bb_unharvested: formatInt(m.bb_unharvested),
    bb_no_offer: formatInt(m.bb_no_offer),
    bb_no_offer_pct: formatPct(noOfferPct),
    bb_1p_pct: formatPct(m.bb_1p_pct),
    bb_3p_pct: formatPct(m.bb_3p_pct),
    bb_unharvested_pct: formatPct(m.bb_unharvested_pct),
    active_offer_coverage_pct: formatPct(m.active_offer_coverage_pct),
    seller_harvested: formatInt(m.seller_harvested),
    seller_harvested_pct: formatPct(m.seller_harvested_pct),
    amz_below_map: formatInt(m.amz_below_map),
    amz_avg_drift: formatUsd(m.amz_avg_drift, { signed: true }),
    wmt_leaks: formatInt(m.wmt_leaks),
    wmt_checked: formatInt(m.wmt_checked),
    mf_leaks: formatInt(m.mf_leaks),
    mf_checked: formatInt(m.mf_checked),
    offamz_avg_leak: formatUsd(m.offamz_avg_leak, { signed: true }),
    map_violation_skus: formatInt(m.map_violation_skus),
    spec_checked: formatInt(m.spec_checked),
    spec_avg_amazon_pct: formatPct(m.spec_avg_amazon_pct),
    spec_fender_found: formatInt(m.spec_fender_found),
    spec_fender_found_pct: formatPct(m.spec_fender_found_pct),
    spec_avg_fender_pct: formatPct(m.spec_avg_fender_pct),
    spec_missing_additional_property: formatInt(m.spec_missing_additional_property),
    spec_missing_field_types: formatInt(m.spec_missing_field_types),
    sim_total: formatInt(m.sim_total),
    sim_runs: formatInt(m.sim_runs),
    sim_resolved: formatInt(m.sim_resolved),
    sim_wins: formatInt(m.sim_wins),
    sim_win_pct: formatPct(m.sim_win_pct),
    sim_unclear: formatInt(m.sim_unclear),
    sim_errors: formatInt(m.sim_errors),
    sim_hallucinations: formatInt(m.sim_hallucinations),
    sim_hallucination_risk: formatInt(m.sim_hallucination_risk),
    beginner_win_pct: formatPct(beginner?.fender_win_pct ?? null),
    beginner_top_competitor: beginner?.top_competitor ?? pendingLabel(),
    beginner_top_competitor_pct: formatPct(beginner?.top_competitor_pct ?? null),
    weakest_category: weakestLabel,
    weakest_win_pct: formatPct(m.weakest_win_pct),
    weakest_top_competitor: m.weakest_top_competitor ?? pendingLabel(),
    weakest_sov_gap_pts: formatInt(m.weakest_sov_gap_pts),
    strongest_category: m.strongest_category
      ? titleCaseCategory(m.strongest_category)
      : pendingLabel(),
    strongest_win_pct: formatPct(m.strongest_win_pct),
    strongest_wins_resolved: formatRatio(m.strongest_wins, m.strongest_resolved),
    active_offer_ratio: formatRatio(m.bb_total, m.catalog_skus),
    bb_1p_detail: `${formatInt(m.bb_1p)} 1P vs ${formatInt(m.bb_3p)} 3P`,
    sim_resolved_detail: `${formatInt(m.sim_resolved)} resolved (${formatInt(m.sim_unclear)} unclear, ${formatInt(m.sim_errors)} errors)`,
    fender_found_ratio: formatRatio(m.spec_fender_found, m.spec_checked),
    phase_one_lift: formatEstimate(kpiString(m, "phase1_lift", PHASE_ONE_LIFT_ESTIMATE)),
    enterprise_potential: formatEstimate(kpiString(m, "enterprise_potential", ENTERPRISE_POTENTIAL_ESTIMATE)),
  };

  for (const row of cats) {
    const key = row.category.replace(/[^a-z0-9_]/gi, "_");
    vars[`cat_${key}_win_pct`] = formatPct(row.fender_win_pct);
    vars[`cat_${key}_top_competitor`] = row.top_competitor ?? pendingLabel();
    vars[`cat_${key}_top_competitor_pct`] = formatPct(row.top_competitor_pct);
    vars[`cat_${key}_resolved`] = formatInt(row.resolved ?? null);
  }

  return vars;
}

export function bindCopy(template: string, vars: Record<string, string>): string {
  return sanitizeUiText(
    template.replace(/\{([a-z0-9_]+)\}/gi, (_, key: string) => vars[key] ?? pendingLabel()),
  );
}
