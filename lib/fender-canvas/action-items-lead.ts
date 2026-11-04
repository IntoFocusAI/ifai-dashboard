/**
 * Action Items lead: how many of the five current findings sit in the red band
 * on their home screens. Counts only the tones briefingFindingsLead already sets.
 * No dollars and no new measurement.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import {
  BRIEFING_COUNT_MISSING,
  type BriefingFinding,
} from "@/lib/fender-canvas/briefing-retail-lead";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";

export const ACTION_ITEMS_LEAD_LABEL = "Critical findings";

const LEAD_DEFINITION =
  "A current finding is critical when its share is in the red band on its home screen. The five are Buy Box withheld, MAP leakage, splintered bundles, exact official product pages, and unbranded discovery.";

/** Same shape ShareHeroCard draws, so both Action Items tabs share one lead. */
export type ActionItemsLeadModel = {
  id: "critical_findings";
  label: string;
  definition: string;
  percent: string;
  ratio: string | null;
  color: string;
  pie: PieDiscData | null;
  tip: string | null;
  explainer: string;
  numerator: number | null;
  denominator: number | null;
  figureTip: string | null;
  critical: number;
  atRisk: number;
  onTrack: number;
  missing: number;
};

export function hasStoredReading(finding: BriefingFinding): boolean {
  return (
    finding.ratio != null &&
    finding.numerator != null &&
    finding.denominator != null &&
    finding.percent !== BRIEFING_COUNT_MISSING
  );
}

function labelList(findings: BriefingFinding[]): string {
  const labels = findings.map((finding) => finding.label);
  if (labels.length <= 2) return labels.join(" and ");
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function statusPie(critical: number, atRisk: number, onTrack: number, stored: number): PieDiscData | null {
  if (stored <= 0) return null;
  return {
    id: "action-items-critical",
    title: ACTION_ITEMS_LEAD_LABEL,
    total: stored,
    totalLabel: "current findings with a stored reading",
    slices: [
      { key: "contradicted", label: "Critical", count: critical },
      { key: "community", label: "At risk", count: atRisk },
      { key: "matched", label: "On track", count: onTrack },
    ].filter((slice) => slice.count > 0),
  };
}

function statusTip(groups: Array<[string, BriefingFinding[]]>): string {
  return groups
    .filter(([, rows]) => rows.length > 0)
    .map(([name, rows]) => `${formatInt(rows.length)} ${name}: ${labelList(rows)}.`)
    .join(" ");
}

export function actionItemsLead(findings: BriefingFinding[]): ActionItemsLeadModel {
  const stored = findings.filter(hasStoredReading);
  const critical = stored.filter((f) => f.tone === "danger");
  const atRisk = stored.filter((f) => f.tone === "warning");
  const onTrack = stored.filter((f) => f.tone === "success");
  const missing = findings.length - stored.length;
  const base = {
    id: "critical_findings" as const,
    label: ACTION_ITEMS_LEAD_LABEL,
    definition: LEAD_DEFINITION,
    critical: critical.length,
    atRisk: atRisk.length,
    onTrack: onTrack.length,
    missing,
  };

  if (stored.length === 0) {
    return {
      ...base,
      percent: BRIEFING_COUNT_MISSING,
      ratio: null,
      color: "var(--text-muted)",
      pie: null,
      tip: null,
      explainer: "No current finding has a stored reading.",
      numerator: null,
      denominator: null,
      figureTip: "None of the five current findings has a stored reading yet.",
    };
  }

  const color =
    critical.length > 0
      ? "var(--danger-red)"
      : atRisk.length > 0
        ? "var(--warning-amber)"
        : "var(--success-green)";
  const partial = missing > 0;

  return {
    ...base,
    percent: formatPct((100 * critical.length) / stored.length),
    ratio: `${formatRatio(critical.length, stored.length)}${partial ? "*" : ""}`,
    color,
    pie: statusPie(critical.length, atRisk.length, onTrack.length, stored.length),
    tip: statusTip([
      ["critical", critical],
      ["at risk", atRisk],
      ["on track", onTrack],
    ]),
    explainer: "In the red band on their home screens.",
    numerator: critical.length,
    denominator: stored.length,
    figureTip: partial
      ? `${formatInt(missing)} of ${formatInt(findings.length)} current findings have no stored reading, so this count leaves them out.`
      : null,
  };
}

/** Hex values match sliceColor in CitationPieDisc so both tabs draw the same disc. */
const SLICE_HEX: Record<string, string> = {
  contradicted: "#ef4444",
  community: "#fbbf24",
  matched: "#10b981",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tooltipAttrs(title: string, desc: string, ariaLabel: string): string {
  return `data-ifai-tooltip-title="${escapeHtml(title)}" data-ifai-tooltip-desc="${escapeHtml(desc)}" tabindex="0" aria-label="${escapeHtml(ariaLabel)}"`;
}

function pieHtml(pie: PieDiscData, tip: string): string {
  let angle = 0;
  const stops = pie.slices
    .map((slice) => {
      const start = angle;
      angle += (slice.count / pie.total) * 360;
      return `${SLICE_HEX[slice.key] ?? "#94a3b8"} ${start}deg ${angle}deg`;
    })
    .join(", ");
  return `<div class="citation-pie-disc citation-pie-disc-retail citation-chart-tip ifai-term" style="background: conic-gradient(${stops});" role="img" data-citation-pie-disc="${escapeHtml(pie.id)}" ${tooltipAttrs(pie.title, tip, `${pie.title}. ${tip}`)}></div>`;
}

/** ShareHeroCard markup for the HTML-authored Urgent Interventions tab. */
export function actionItemsLeadHtml(lead: ActionItemsLeadModel): string {
  const figureClass = lead.figureTip ? "ai-lead-figure ifai-term" : "ai-lead-figure";
  const figureTip = lead.figureTip
    ? ` ${tooltipAttrs(lead.label, lead.figureTip, `${lead.label}: ${lead.percent}. ${lead.figureTip}`)}`
    : "";
  const ratio = lead.ratio
    ? `<span class="findability-lead-ratio" data-hero-ratio="">${escapeHtml(lead.ratio)}</span>`
    : "";
  const pie = lead.pie && lead.tip ? pieHtml(lead.pie, lead.tip) : "";
  return `
  <div class="content-box findability-lead-card" data-action-items-lead="${lead.id}" style="flex:0 0 auto; width:fit-content; max-width:100%; margin-bottom:10px;">
    <div><span class="ifai-term" ${tooltipAttrs(lead.label, lead.definition, `${lead.label}: ${lead.definition}`)}>${escapeHtml(lead.label)}</span></div>
    <div class="findability-lead-row">
      <div class="findability-lead-figures">
        <span class="${figureClass}" style="color:${lead.color};" data-hero-percent="" data-hero-numerator="${lead.numerator ?? ""}" data-hero-denominator="${lead.denominator ?? ""}"${figureTip}>${escapeHtml(lead.percent)}</span>
        ${ratio}
      </div>
      ${pie}
    </div>
    <span class="metric-card-sub">${escapeHtml(lead.explainer)}</span>
  </div>`;
}
