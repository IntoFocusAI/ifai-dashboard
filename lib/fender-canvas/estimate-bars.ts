/**
 * Summary Opportunity and Action Items Revenue Estimates: one bar chart of the two
 * analyst estimates already on the canvas. Bar lengths come from the shown figures
 * on one shared scale; no figure, input, or formula is added.
 */

const ESTIMATE_LABEL = "analyst estimate";

const SCALE_TIP =
  "Both bars share one scale that ends at the high end of the full-enterprise range. The full-enterprise bar spans the low to high end of that range.";

const UNIT: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** Dollar amounts in a shown figure, e.g. "+$38M to $62M est." -> [38e6, 62e6]. */
export function estimateAmounts(figure: string): number[] {
  return [...figure.matchAll(/\$([\d.,]+)\s*([KMB])?/gi)].map(
    ([, digits, unit]) => Number(digits.replace(/,/g, "")) * (unit ? UNIT[unit.toUpperCase()] : 1),
  );
}

export type EstimateBar = {
  id: "phase_one" | "enterprise";
  label: string;
  figure: string;
  /** Percent of the shared scale where the bar starts and how wide it is. */
  start: number;
  width: number;
};

export function estimateBars(phaseOne: string, enterprise: string): EstimateBar[] | null {
  const phase = estimateAmounts(phaseOne);
  const range = estimateAmounts(enterprise);
  if (phase.length !== 1 || range.length < 1 || range.length > 2) return null;
  const low = range[0]!;
  const high = range.at(-1)!;
  const max = Math.max(phase[0]!, high);
  if (!(max > 0) || low > high || phase.some(Number.isNaN) || range.some(Number.isNaN)) return null;
  const pct = (value: number) => (100 * value) / max;
  const rangeStart = range.length === 2 ? pct(low) : 0;
  return [
    { id: "phase_one", label: "Phase 1 quick-win lift", figure: phaseOne, start: 0, width: pct(phase[0]!) },
    {
      id: "enterprise",
      label: "Full enterprise potential",
      figure: enterprise,
      start: rangeStart,
      width: pct(high) - rangeStart,
    },
  ];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function round(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function barHtml(bar: EstimateBar): string {
  return `
    <div data-estimate-bar="${bar.id}" style="margin-top:10px;">
      <div style="display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 10px;">
        <span class="metric-card-label">${escapeHtml(bar.label)}</span>
        <span class="ai-lead-figure" style="color:var(--success-green); font-size:clamp(18px, 1.8vw, 22px);" data-estimate-figure="">${escapeHtml(bar.figure)}</span>
        <span class="metric-card-sub" data-estimate-label="">${ESTIMATE_LABEL}</span>
      </div>
      <div class="estimate-bar-track" style="position:relative; height:14px; margin-top:6px; border-radius:7px; background:var(--border-color); overflow:hidden;" aria-hidden="true">
        <span class="estimate-bar-fill" style="position:absolute; top:0; bottom:0; left:${round(bar.start)}%; width:${round(bar.width)}%; min-width:4px; border-radius:7px; background:var(--success-green);"></span>
      </div>
    </div>`;
}

/** The chart block bound as {estimate_bars}; empty when a shown figure has no dollar amount. */
export function estimateBarsHtml(phaseOne: string, enterprise: string): string {
  const bars = estimateBars(phaseOne, enterprise);
  if (!bars) return "";
  return `
<div class="content-box" data-estimate-bars="">
  <div class="content-box-title"><span class="ifai-term" data-ifai-tooltip-title="Analyst estimates" data-ifai-tooltip-desc="${escapeHtml(SCALE_TIP)}" tabindex="0" aria-label="Analyst estimates: ${escapeHtml(SCALE_TIP)}">Analyst estimates</span></div>
  ${bars.map(barHtml).join("")}
</div>`;
}
