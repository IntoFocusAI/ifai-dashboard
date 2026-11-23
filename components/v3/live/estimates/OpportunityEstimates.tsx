"use client";

import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { EstimateTrailTrigger } from "@/components/v3/live/estimates/EstimateTrailTrigger";
import { AI_ESTIMATE_READ_FAILED } from "@/lib/estimates/ai-gap-read";
import type { ClientEstimatesRead } from "@/lib/estimates/live-inputs";
import type { EstimateResult } from "@/lib/estimates/types";
import { figureSplit, NOT_AVAILABLE_LISTINGS_TIP } from "@/components/v3/live/estimates/trail-copy";
import { ESTIMATE_LOADING, NO_ANALYST_ESTIMATE, notPreparedTip } from "@/lib/fender-canvas/analyst-estimates";
import { formatMoneyShort, formatRatio } from "@/lib/fender-canvas/format";

/** Shown when the listing reads behind the estimates failed: left out, never $0. */
export const ESTIMATES_READ_FAILED =
  "The listing reads behind this estimate did not load, so it is left out rather than shown as zero.";

export const MAP_BESIDE_TIP = "Retail value below MAP. Shown beside Phase 1 and never added to it.";

export const MEASURED_SALES_TIP = "The part of the figure from listings with measured sales: SmartScout, or the brand's own sales.";
export const ESTIMATED_SALES_TIP =
  "The part of the figure from listings with estimated sales: Amazon's bought-in-past-month figure read by Keepa, or tracked listings with a similar sales rank.";

/**
 * One estimate figure: the mid with its range and the analyst estimate label, opening its trail.
 * Not prepared reads Not available* with the decision 105 tooltip. A line whose listings have no
 * sales figure at all reads Not available* with the trail's own tooltip for such listings.
 */
export function EstimateFigure({
  read,
  result,
  hero,
}: {
  read: ClientEstimatesRead | undefined;
  result: EstimateResult | null;
  /** A hero card: the mid as the figure, its range on a line below. Table rows keep "mid, range". */
  hero?: boolean;
}) {
  if (!read || read.phase === "loading") return <span data-estimate-loading="">{ESTIMATE_LOADING}</span>;
  if (read.phase === "error") {
    return <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, ESTIMATES_READ_FAILED, "estimate-read-failed")}>{NO_ANALYST_ESTIMATE}</span>;
  }
  if (result && (result.lineId === "ai_unbranded" || result.lineId === "ai_branded") && result.status !== "estimated") {
    return <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, AI_ESTIMATE_READ_FAILED, "estimate-ai-na")}>{NO_ANALYST_ESTIMATE}</span>;
  }
  if (result && result.status !== "estimated" && result.trail.coverage.total > 0) {
    return (
      <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, NOT_AVAILABLE_LISTINGS_TIP, "estimate-no-sales-figure")} data-estimate-no-sales-figure="">
        {NO_ANALYST_ESTIMATE}
      </span>
    );
  }
  if (!result || result.status !== "estimated") {
    return (
      <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, notPreparedTip(), "estimate-not-prepared")} data-estimate-not-prepared="">
        {NO_ANALYST_ESTIMATE}
      </span>
    );
  }
  return <EstimateTrailTrigger result={result} hero={hero} />;
}

function Card({ id, label, tip, read, result }: { id: string; label: string; tip?: string; read: ClientEstimatesRead | undefined; result: EstimateResult | null }) {
  return (
    <div className="metric-card-sm" data-estimate-card={id}>
      <span className="metric-card-label">
        <span {...figureTipAttrs(label, tip)}>{label}</span>
      </span>
      <div className="metric-card-val">
        <EstimateFigure read={read} result={result} hero />
      </div>
    </div>
  );
}

function Row({
  read,
  result,
  title,
  tip,
  total,
  rowId,
}: {
  read: ClientEstimatesRead | undefined;
  result: EstimateResult | null;
  title: string;
  tip?: string;
  total?: boolean;
  /** The row's id while its result is not there yet (the AI rows while the AI read loads). */
  rowId?: string;
}) {
  const ready = read?.phase === "ready" && result ? result : null;
  // N of M also for a line with listings and no sales figure ("0 of 1"); blank for a held line with none.
  const coverage = ready && (ready.status === "estimated" || ready.trail.coverage.total > 0) ? ready.trail.coverage : null;
  const split = ready ? figureSplit(ready) : null;
  return (
    <tr data-estimate-row={result?.lineId ?? rowId ?? title}>
      <td style={total ? { fontWeight: 600, color: "var(--text-main)" } : undefined}>
        <span {...figureTipAttrs(title, tip)}>{title}</span>
      </td>
      <td>
        <EstimateFigure read={read} result={result} />
      </td>
      <td className="table-num" data-estimate-measured="">{split ? formatMoneyShort(split.measured) : ""}</td>
      <td className="table-num" data-estimate-estimated="">{split ? formatMoneyShort(split.estimated) : ""}</td>
      <td className="table-num" data-estimate-listings="">
        {coverage ? <span {...figureTipAttrs("Listings", coverage.sentence)}>{formatRatio(coverage.measured + coverage.estimated, coverage.total)}</span> : ""}
      </td>
    </tr>
  );
}

/** Lines 8 and 9: Not available* with the AI tooltip when the AI read failed, else a row like the others. */
function AiRow({ read, result, title, lineId }: { read: ClientEstimatesRead | undefined; result: EstimateResult | null; title: string; lineId: string }) {
  if (read?.phase === "ready" && !result) {
    return (
      <tr data-estimate-row={lineId}>
        <td>{title}</td>
        <td>
          <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, AI_ESTIMATE_READ_FAILED, "estimate-ai-na")} data-estimate-ai-na="">
            {NO_ANALYST_ESTIMATE}
          </span>
        </td>
        <td />
        <td />
        <td />
      </tr>
    );
  }
  return <Row read={read} result={result} title={title} rowId={lineId} />;
}

/**
 * Opportunity (Summary) and Revenue Estimates (Action Items): the same sections for every client,
 * generated from its own listings and settings (H-09, decision 112). Phase 1 adds lines 1, 2, 4, 5
 * and 7; MAP leakage sits beside it; Enterprise Potential scales Phase 1 to the brand's revenue.
 */
export function OpportunityEstimates({ read }: { read: ClientEstimatesRead | undefined }) {
  const est = read?.phase === "ready" ? read.estimates : null;
  const phaseLines = est?.phase1.parts ?? [];
  // Lines 8 and 9 and Enterprise Potential's AI part wait for the date-pill window's AI read.
  const ai = est?.ai;
  const aiRead: ClientEstimatesRead | undefined = ai?.phase === "loading" ? { phase: "loading" } : read;
  const aiLine = (key: "unbranded" | "branded") => (ai?.phase === "ready" ? ai[key] : null);
  return (
    <>
      <div className="content-box" data-revenue-estimates="" style={{ marginTop: 12 }}>
        <div className="content-box-title">
          <span>Revenue Estimates</span>
        </div>
        <div className="metric-grid-2" style={{ marginTop: 8 }}>
          <Card id="phase_one" label="Phase 1 Quick-Win Lift" read={read} result={est?.phase1 ?? null} />
          <Card id="enterprise" label="Full Enterprise Potential" read={aiRead} result={est?.enterprise ?? null} />
          <Card id="map_leakage" label="MAP Leakage" tip={MAP_BESIDE_TIP} read={read} result={est?.mapLeakage ?? null} />
        </div>
      </div>
      <div className="content-box" data-estimate-method="" style={{ marginTop: 12 }}>
        <div className="content-box-title">How we arrived at these estimates</div>
        <div className="table-scroll">
          <table className="table-sm table-no-row-hover">
            <thead>
              <tr>
                <th>Estimate</th>
                <th>Figure</th>
                <th>
                  <span {...figureTipAttrs("On measured sales", MEASURED_SALES_TIP)}>On measured sales</span>
                </th>
                <th>
                  <span {...figureTipAttrs("On estimated sales", ESTIMATED_SALES_TIP)}>On estimated sales</span>
                </th>
                <th>Listings</th>
              </tr>
            </thead>
            <tbody>
              {phaseLines.map((line) => (
                <Row key={line.lineId} read={read} result={line} title={line.trail.title} />
              ))}
              <Row read={read} result={est?.phase1 ?? null} title="Phase 1 Quick-Win Lift" total />
              <Row read={read} result={est?.mapLeakage ?? null} title="MAP Leakage" tip={MAP_BESIDE_TIP} />
              <Row read={read} result={est?.miscategorized ?? null} title={est?.miscategorized.trail.title ?? "Miscategorized listings"} />
              <AiRow read={aiRead} result={aiLine("unbranded")} lineId="ai_unbranded" title="AI Search: Unbranded Discovery gap" />
              <AiRow read={aiRead} result={aiLine("branded")} lineId="ai_branded" title="AI Search: Branded Consideration" />
              <Row read={aiRead} result={est?.enterprise ?? null} title="Full Enterprise Potential" total />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
