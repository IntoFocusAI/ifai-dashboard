"use client";

import "@/components/v3/live/estimates/estimate-trail.css";
import { useMemo } from "react";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import type { RetailColumn } from "@/components/v3/live/ResizableTable";
import { MidButton, Placeholder } from "@/components/v3/live/estimates/EstimateLineFigure";
import { resultHeroText } from "@/components/v3/live/estimates/trail-copy";
import { useClientEstimates, type ClientEstimatesRead } from "@/components/v3/live/estimates/useClientEstimates";
import { useEstimatePeriodDays } from "@/components/v3/live/estimates/useEstimatePeriod";
import { BUY_BOX_LOST_SHARE } from "@/lib/estimates/benchmarks";
import { buyBoxForPeriod } from "@/lib/estimates/buy-box";
import type { EstimateListingRow, EstimateResult } from "@/lib/estimates/types";
import { buyBoxRowEstimate } from "@/lib/fender-canvas/action-items-buybox-rows";
import { FIX_ESTIMATE_LABEL } from "@/lib/fender-canvas/action-items-fix-list";
import { BRIEFING_LOADING } from "@/lib/fender-canvas/briefing-retail-lead";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatMoneyShort, formatMoneySpan, formatUsd } from "@/lib/fender-canvas/format";

/** The one Buy Box dollar (R-06), named without a period: the shared date pill names the period (R-07). */
export const BUY_BOX_ESTIMATE_LABEL = "Sales to win back with the Buy Box";

/** The table column, kept narrow so the Suppressed Listings table still fits at 1280 wide. */
export const BUY_BOX_ESTIMATE_COLUMN: RetailColumn = {
  id: "estimate",
  name: "Estimate",
  label: "Estimate",
  width: 88,
  minWidth: 76,
  className: "money",
  sort: "number",
  headerTooltip: {
    title: BUY_BOX_ESTIMATE_LABEL,
    description: "Each listing's sales to win back once the Buy Box returns, over the period in the date pill. Analyst estimate.",
  },
};

const share = BUY_BOX_LOST_SHARE;
const pct = (x: number) => `${Math.round(x * 100)}%`;

const NOT_IN_READ = "This listing is not in the sales read yet, so it has no sales rate. It is left out of the figure, not counted as $0.";

export type BuyBoxPeriodRead = { read: ClientEstimatesRead; line: EstimateResult | null; byAsin: Map<string, EstimateListingRow> };

/** The Buy Box figure over the date pill's days, with each withheld listing's part. */
export function useBuyBoxPeriodLine(): BuyBoxPeriodRead {
  const read = useClientEstimates();
  const periodDays = useEstimatePeriodDays();
  return useMemo(() => {
    const line = read.phase === "ready" ? buyBoxForPeriod(read.estimates, periodDays) : null;
    return { read, line, byAsin: new Map((line?.trail.listings ?? []).map((row) => [row.asin, row])) };
  }, [periodDays, read]);
}

/** The listing's mid, for sorting. null when it has none. */
export function buyBoxListingMid(period: BuyBoxPeriodRead, asin: string): number | null {
  return period.byAsin.get(asin)?.range?.mid ?? null;
}

/** The listing's own math in plain words: rate x days x share, with the range. */
function listingMath(row: EstimateListingRow): string {
  const d = row.detail;
  const sales = typeof d.salesLast30 === "number" ? d.salesLast30 : 0;
  const days = typeof d.buyBoxDays30 === "number" ? d.buyBoxDays30 : 0;
  const rate = typeof d.salesPerBuyBoxDay === "number" ? d.salesPerBuyBoxDay : 0;
  const period = typeof d.periodDays === "number" ? d.periodDays : 0;
  if (sales === 0) return `SmartScout reports no sales for this listing in the last 30 days, so it adds $0. It held the Buy Box on ${days} of those days.`;
  const r = row.range!;
  return (
    `${formatUsd(sales)} in the last 30 days over ${days} days with the Buy Box is ${formatUsd(rate)} a day. ` +
    `Times ${formatInt(period)} days times ${pct(share.mid)} is ${formatMoneyShort(r.mid)}; with ${pct(share.low)} to ${pct(share.high)}, ${formatMoneySpan(r.low, r.high)}.`
  );
}

/** One withheld listing's figure in the Suppressed Listings table, or Not available* with its reason. */
export function BuyBoxListingCell({ period, asin }: { period: BuyBoxPeriodRead; asin: string }) {
  if (period.read.phase === "loading") return <td className="money" data-buy-box-listing="loading">{BRIEFING_LOADING}</td>;
  const row = period.byAsin.get(asin) ?? null;
  if (!row || !row.range) {
    const reason = period.read.phase === "error" ? period.read.message : typeof row?.detail.notAvailable === "string" ? row.detail.notAvailable : NOT_IN_READ;
    return (
      <td className="money" data-buy-box-listing="not_available">
        <span {...figureTipAttrs(READ_NOT_AVAILABLE, reason, "buy-box-listing-na")}>{READ_NOT_AVAILABLE}</span>
      </td>
    );
  }
  return (
    <td className="money" data-buy-box-listing="estimated" data-buy-box-listing-mid={Math.round(row.range.mid)}>
      <span {...figureTipAttrs(FIX_ESTIMATE_LABEL, listingMath(row), "buy-box-listing-math")}>{formatMoneyShort(row.range.mid)}</span>
      <div className="estimate-trail-trigger-label">{FIX_ESTIMATE_LABEL}</div>
    </td>
  );
}

/**
 * Suppressed Listings: the one Buy Box dollar for every listing withheld today, over the date pill's
 * days. The mid opens the trail (inputs, sources, formula); the range sits under it; N of M counts
 * the withheld listings with a sales rate.
 */
export function BuyBoxEstimateCard({ period }: { period: BuyBoxPeriodRead }) {
  const { read, line } = period;
  const figure = line ? buyBoxRowEstimate(line) : null;
  const range = figure?.status === "estimated" ? figure.range : null;
  const rangeText = range ? resultHeroText({ status: "estimated", range }).range : null;
  if (read.phase === "ready" && figure?.status === "none") return null;
  const means = line?.trail.means ?? "Sales the brand can win back by getting the Buy Box back on every listing Amazon withholds it from today.";
  return (
    <div
      className="content-box findability-lead-card estimate-line-card"
      data-buy-box-estimate-card=""
      data-estimate-line-status={figure?.status ?? read.phase}
      data-buy-box-period-days={line?.trail.inputs.find((i) => i.key === "period_days")?.value ?? ""}
      style={{ flex: "0 0 auto", width: "fit-content", maxWidth: "100%", alignSelf: "flex-start", marginTop: 0 }}
    >
      <div>
        <span {...figureTipAttrs(BUY_BOX_ESTIMATE_LABEL, means, "buy-box-estimate-label")}>{BUY_BOX_ESTIMATE_LABEL}</span>
      </div>
      <div className="findability-lead-figures">
        <span className="ai-lead-figure" data-buy-box-estimate-figure="">
          {line && range ? <MidButton line={line} range={range} /> : <Placeholder read={read} figure={figure} />}
        </span>
        {rangeText ? (
          <span className="findability-lead-ratio" data-buy-box-estimate-range="">
            {rangeText}
          </span>
        ) : null}
        {figure && figure.listings > 0 ? (
          <span className="findability-lead-ratio" data-buy-box-estimate-ratio="">
            {`${formatInt(figure.priced)} of ${formatInt(figure.listings)} withheld listings`}
          </span>
        ) : null}
        <span className="findability-lead-ratio">
          <span className="source-tag source-tag-estimate" data-source="Estimate">
            {FIX_ESTIMATE_LABEL}
          </span>
        </span>
      </div>
    </div>
  );
}
