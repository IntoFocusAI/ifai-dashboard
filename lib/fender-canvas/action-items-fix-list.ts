/**
 * Action Items · Urgent Interventions fix list: the five current findings as one ranked table.
 * Rank, what to fix, the finding behind it (share, N of M, status word), and the evidence tab.
 */

import type { BriefingFinding, BriefingFindingId } from "@/lib/fender-canvas/briefing-retail-lead";

export const FIX_LIST_TITLE = "Fixes in priority order";

export const FIX_LIST_PRIORITY_RULE =
  "Critical findings come first, then at risk, then on track, then findings with no stored reading. Within a status, the finding that affects the larger share of its listings or answers comes first. For exact official product pages and unbranded discovery a higher share is better, so the share affected is the rest: listings without an exact page, and answers that do not lead with the brand.";

export const FIX_ESTIMATE_LABEL = "analyst estimate";

/** Findings whose figure counts what is going well; the gap is the rest of the population. */
const HIGHER_IS_BETTER: ReadonlySet<BriefingFindingId> = new Set([
  "exact_official_product",
  "unbranded_discovery",
]);

type Status = "critical" | "at_risk" | "on_track" | "no_reading";

const STATUS: Record<Status, { label: string; tag: string; rank: number }> = {
  critical: { label: "Critical", tag: "tag-danger", rank: 0 },
  at_risk: { label: "At risk", tag: "tag-warning", rank: 1 },
  on_track: { label: "On track", tag: "tag-success", rank: 2 },
  no_reading: { label: "No reading", tag: "tag-neutral", rank: 3 },
};

export type FixListInput = {
  finding: BriefingFinding;
  action: string;
  stored: boolean;
};

export type FixListRow = FixListInput & {
  rank: number;
  status: Status;
  statusLabel: string;
  /** Share of the population the problem touches, 0 to 1. Orders rows; never shown. */
  affectedShare: number | null;
  /** An analyst-estimate dollar the dashboard already computes for this finding, if any. */
  estimate: string | null;
};

function statusOf(input: FixListInput): Status {
  if (!input.stored) return "no_reading";
  if (input.finding.tone === "danger") return "critical";
  if (input.finding.tone === "warning") return "at_risk";
  return "on_track";
}

function affectedShare({ finding, stored }: FixListInput): number | null {
  const { numerator, denominator } = finding;
  if (!stored || numerator == null || denominator == null || denominator <= 0) return null;
  const share = numerator / denominator;
  return HIGHER_IS_BETTER.has(finding.id) ? 1 - share : share;
}

/** Ranks by status, then by the larger share affected. Ties keep the briefing order. */
export function rankFixList(
  inputs: readonly FixListInput[],
  estimates: Partial<Record<BriefingFindingId, string>> = {},
): FixListRow[] {
  return inputs
    .map((input, order) => {
      const status = statusOf(input);
      const row = {
        ...input,
        rank: 0,
        status,
        statusLabel: STATUS[status].label,
        affectedShare: affectedShare(input),
        estimate: estimates[input.finding.id] ?? null,
      };
      return { row, order };
    })
    .sort(
      (a, b) =>
        STATUS[a.row.status].rank - STATUS[b.row.status].rank ||
        (b.row.affectedShare ?? -1) - (a.row.affectedShare ?? -1) ||
        a.order - b.order,
    )
    .map(({ row }, index) => ({ ...row, rank: index + 1 }));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findingCell(row: FixListRow): string {
  const { finding } = row;
  const ratio = finding.ratio
    ? ` <span class="findability-lead-ratio" data-fix-ratio="">${escapeHtml(finding.ratio)}</span>`
    : "";
  const estimate = row.estimate
    ? `<div class="metric-card-sub" data-fix-estimate=""><strong>${escapeHtml(row.estimate)}</strong> ${FIX_ESTIMATE_LABEL}</div>`
    : "";
  return `<div style="font-weight:600; color:var(--text-main);">${escapeHtml(finding.label)}</div>
        <div style="white-space:nowrap;"><strong style="color:${finding.color}; font-size:15px;" data-fix-percent="">${escapeHtml(finding.percent)}</strong>${ratio}</div>
        ${estimate}`;
}

function rowHtml(row: FixListRow): string {
  const { finding } = row;
  const status = STATUS[row.status];
  const open = `data-ifai-open="${escapeHtml(finding.spokeId)}" data-ifai-tab="${escapeHtml(finding.tab)}"`;
  return `
    <tr class="ifai-row-link" data-fix-row="${escapeHtml(finding.id)}" data-fix-status="${row.status}" ${open}>
      <td class="money" data-fix-rank="" style="font-weight:700; color:var(--text-main);">${row.rank}</td>
      <td data-fix-action="" style="color:var(--text-main);">${escapeHtml(row.action)}</td>
      <td data-fix-finding="">${findingCell(row)}</td>
      <td><span class="tag-badge ${status.tag}" data-fix-status-label="">${status.label}</span></td>
      <td class="money"><button type="button" class="ifai-open-hint" style="background:transparent; font-family:inherit;" ${open} data-fix-open="">Open ${escapeHtml(finding.tab)} →</button></td>
    </tr>`;
}

export function fixListHtml(rows: readonly FixListRow[]): string {
  const rule = escapeHtml(FIX_LIST_PRIORITY_RULE);
  return `
<div class="content-box" data-fix-list="">
  <div class="content-box-title"><span class="ifai-term" data-ifai-tooltip-title="${FIX_LIST_TITLE}" data-ifai-tooltip-desc="${rule}" tabindex="0" aria-label="${FIX_LIST_TITLE}: ${rule}">${FIX_LIST_TITLE}</span></div>
  <div class="table-scroll">
    <table class="table-sm" data-fix-table="">
      <thead>
        <tr><th style="width:36px;">#</th><th>What to fix</th><th style="width:24%;">Finding</th><th style="width:96px;">Status</th><th style="width:1%;">Evidence</th></tr>
      </thead>
      <tbody>${rows.map(rowHtml).join("")}
      </tbody>
    </table>
  </div>
</div>`;
}
