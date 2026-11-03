"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { formatInt, formatUsd } from "@/lib/fender-canvas/format";
import {
  lostSalesPopulationPie,
  REVENUE_SOURCE_LABELS,
  sumLostSales,
  type LostSalesSum,
  type RevenueSource,
  type StockLossRow,
} from "@/lib/fender-canvas/stock-loss";

const RETAIL_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

function estimateTooltipDesc(sum: LostSalesSum, populationCount: number | null): string {
  const population =
    populationCount != null
      ? `${formatInt(sum.affectedCount)} of ${formatInt(populationCount)} listings were out of stock at least one day in the last 12 months, including listings with no active offer.`
      : `${formatInt(sum.affectedCount)} listings were out of stock at least one day in the last 12 months, including listings with no active offer.`;
  return (
    `${population} ${formatInt(sum.estimatedCount)} have a sales source and are in the totals. ` +
    `${formatInt(sum.awaitingCount)} are awaiting inputs and are not counted as $0. ` +
    `Each listing's sales per in-stock day is its source's revenue divided by Keepa in-stock days, ` +
    `times its out-of-stock days in each window. ` +
    `The rate uses 12-month revenue when at least 30 of those days were in stock, ` +
    `otherwise revenue from the last 30 days when at least 7 of those days were in stock. ` +
    `Each window is also what the next period of the same length would miss if the sales rate and the out-of-stock pattern hold. ` +
    `Totals from different sales sources are never added together.`
  );
}

function sourceTotal(sum: LostSalesSum, source: RevenueSource): number | null {
  return sum.bySource.find((entry) => entry.source === source)?.total ?? null;
}

/**
 * Out of Stock hero: 12-month missed sales per sales source, the 90- and 30-day figures beneath,
 * and the estimated vs awaiting-inputs disc. The rule lives on the Estimate pill tooltip.
 */
export function StockLossHero({
  rows,
  populationCount,
}: {
  rows: readonly StockLossRow[];
  populationCount: number | null;
}) {
  const year = sumLostSales(rows, 365);
  const quarter = sumLostSales(rows, 90);
  const month = sumLostSales(rows, 30);
  const pie = lostSalesPopulationPie(year);
  const tip =
    year.affectedCount > 0
      ? `${formatInt(year.estimatedCount)} estimated, ${formatInt(year.awaitingCount)} awaiting inputs, of ${formatInt(year.affectedCount)} out-of-stock listings.`
      : undefined;
  const estimateDesc = estimateTooltipDesc(year, populationCount);
  const sources = year.bySource.map((entry) => entry.source);

  return (
    <div
      className="content-box findability-lead-card stock-loss-hero"
      data-stock-loss-hero=""
      style={{ flex: "0 0 auto", width: "fit-content", maxWidth: "100%" }}
    >
      <div className="findability-lead-row" data-stock-loss-hero-row="">
        <div className="findability-lead-figures">
          {sources.length === 0 ? (
            <span
              className="ai-lead-figure"
              style={{ color: "var(--warning-amber)" }}
              data-stock-loss-hero-figure=""
            >
              Awaiting inputs
            </span>
          ) : (
            sources.map((source) => (
              <span key={source} className="stock-loss-hero-source" data-stock-loss-hero-source={source}>
                <span
                  className="ai-lead-figure"
                  style={{ color: "var(--danger-red)" }}
                  data-stock-loss-hero-figure=""
                >
                  {formatUsd(sourceTotal(year, source))}
                </span>
                <span className="findability-lead-ratio">
                  {REVENUE_SOURCE_LABELS[source]} · 90 days {formatUsd(sourceTotal(quarter, source))} · 30 days{" "}
                  {formatUsd(sourceTotal(month, source))}
                </span>
              </span>
            ))
          )}
          <span className="findability-lead-ratio" data-stock-loss-hero-label="">
            Est. lost sales, 12 months{" "}
            <span
              className="source-tag source-tag-estimate ifai-term"
              data-source="Estimate"
              data-stock-loss-estimate-tip=""
              data-ifai-tooltip-title="Estimate"
              data-ifai-tooltip-desc={estimateDesc}
              tabIndex={0}
              aria-label={`Estimate: ${estimateDesc}`}
            >
              Estimate
            </span>
          </span>
          {year.affectedCount > 0 ? (
            <span className="findability-lead-ratio" data-stock-loss-hero-ratio="">
              {formatInt(year.estimatedCount)} of {formatInt(year.affectedCount)} estimated ·{" "}
              {formatInt(year.awaitingCount)} awaiting inputs
            </span>
          ) : null}
        </div>
        {pie ? <CitationPieDisc pie={pie} sizeClass={RETAIL_PIE_SIZE} tip={tip} /> : null}
      </div>
    </div>
  );
}
