/** Minimal view entries for Catalog Health, in tab order. */

import { commerceInputsFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import { commerceScore } from "@/lib/fender-canvas/consensus-scores";
import { formatInt, formatUsd } from "@/lib/fender-canvas/format";
import {
  bubbleEntry,
  cached,
  counted,
  heroFigure,
  loadingFigure,
  missingFigure,
  retailFigure,
  retailReading,
  scoreFigure,
  type MinimalContext,
  type MinimalEntry,
} from "@/lib/fender-canvas/minimal-metric-kit";
import { RETAIL_OVERVIEW_TAB, STOCK_LOSS_TAB } from "@/lib/fender-canvas/portfolio-retail-display";
import { averageGapTip, buyBoxHero, catalogHero, mapHero, specHero } from "@/lib/fender-canvas/retail-overview-lead";
import {
  lostSalesPopulationPie,
  REVENUE_SOURCE_LABELS,
  sumLostSales,
  type LostSalesSum,
  type RevenueSource,
} from "@/lib/fender-canvas/stock-loss";

const BUY_BOX_READINGS = "current Buy Box readings";

function yearOfLostSales(ctx: MinimalContext): LostSalesSum | null {
  return cached(ctx, "lost-sales-365", () => (ctx.stockLoss.phase === "ready" ? sumLostSales(ctx.stockLoss.rows, 365) : null));
}

/** The Out of Stock hero: one 12-month total per sales source. Sources are never added together. */
function lostSalesEntry(source: RevenueSource): MinimalEntry {
  const name = REVENUE_SOURCE_LABELS[source];
  return {
    id: `stock-loss-12m-${source.replace(/_/g, "-")}`,
    spokeId: "ecommerce",
    tab: STOCK_LOSS_TAB,
    label: `Est. lost sales, 12 months, ${name}`,
    provenance: "estimate",
    offered: (ctx) => ctx.stockLoss.phase !== "ready" || Boolean(yearOfLostSales(ctx)?.bySource.some((entry) => entry.source === source)),
    read: (ctx) => {
      const estimate = `${name} sales and Keepa out-of-stock days`;
      if (ctx.stockLoss.phase === "loading") return { ...loadingFigure("The stock history is still loading."), estimate };
      const year = yearOfLostSales(ctx);
      const total = year?.bySource.find((entry) => entry.source === source)?.total;
      if (!year || total == null) return { ...missingFigure("The stock history could not be loaded."), estimate };
      return {
        value: formatUsd(total),
        tone: "danger",
        ratio: `${formatInt(year.estimatedCount)} of ${formatInt(year.affectedCount)} estimated · ${formatInt(year.awaitingCount)} awaiting inputs`,
        pie: lostSalesPopulationPie(year),
        tip: `${formatInt(year.estimatedCount)} estimated, ${formatInt(year.awaitingCount)} awaiting inputs, of ${formatInt(year.affectedCount)} out-of-stock listings.`,
        missing: null,
        estimate,
      };
    },
  };
}

export const RETAIL_ENTRIES: MinimalEntry[] = [
  bubbleEntry({
    id: "spoke-retail",
    spokeId: "ecommerce",
    label: "Buy Box withheld",
    tab: RETAIL_OVERVIEW_TAB,
    read: (ctx) =>
      retailReading(ctx, (snapshot) => {
        const hero = buyBoxHero(snapshot);
        return counted(hero.ratio, BUY_BOX_READINGS, hero.pie, hero.tip, hero.explainer);
      }),
  }),
  {
    id: "retail-ai-commerce",
    spokeId: "ecommerce",
    tab: RETAIL_OVERVIEW_TAB,
    label: "AI Commerce",
    read: (ctx) =>
      retailFigure(ctx, () => {
        const inputs = commerceInputsFromLive(ctx.retail, ctx.authorizedPartners);
        if (!inputs) return missingFigure("AI Commerce is not available until the retail reading loads.");
        const commerce = commerceScore(inputs, { authorizedPartners: ctx.authorizedPartners });
        return scoreFigure("score-commerce", commerce.name, commerce, "Not enough inputs are stored for this score yet.");
      }),
  },
  {
    id: "suppressed-buy-box-withheld",
    spokeId: "ecommerce",
    tab: "Suppressed Listings",
    label: "Buy Box withheld",
    read: (ctx) => retailFigure(ctx, (snapshot) => heroFigure(buyBoxHero(snapshot), BUY_BOX_READINGS, "Buy Box reading not stored.")),
  },
  bubbleEntry({
    id: "sat-buybox",
    spokeId: "ecommerce",
    label: "Withheld above the outside price",
    tab: "Suppressed Listings",
    read: (ctx) =>
      retailReading(ctx, (snapshot) => {
        const counts = snapshot.suppressedListings.detail?.counts ?? null;
        const ready = counts != null && counts.current > 0;
        return counted(
          ready ? `${formatInt(counts.confirmedHighPrice)} of ${formatInt(counts.current)}` : null,
          BUY_BOX_READINGS,
          null,
          null,
          snapshot.suppressedListings.missingMessage ?? "Buy Box reading not stored.",
        );
      }),
  }),
  bubbleEntry({
    id: "sat-map",
    spokeId: "ecommerce",
    label: "MAP leakage",
    tab: "MAP",
    read: (ctx) =>
      retailReading(ctx, (snapshot) => {
        const hero = mapHero(snapshot);
        return counted(hero.ratio, "listings with a stored MAP price", hero.pie, hero.tip, hero.explainer);
      }),
  }),
  {
    id: "map-average-gap",
    spokeId: "ecommerce",
    tab: "MAP",
    label: "Average price gap below MAP",
    read: (ctx) =>
      retailFigure(ctx, (snapshot) => {
        const reading = snapshot.mapLeakage;
        const detail = reading.detail;
        if (detail?.averageLeakage == null) {
          return missingFigure(reading.missingMessage ?? "No listing in this read is priced below MAP.");
        }
        const mark = (detail.approvedExceptions ?? 0) > 0 ? "*" : "";
        return {
          value: formatUsd(detail.averageLeakage, { signed: true }),
          tone: "danger",
          ratio: `Across ${formatInt(detail.violations)} ${detail.violations === 1 ? "listing" : "listings"} below MAP${mark}`,
          pie: null,
          tip: averageGapTip(snapshot),
          missing: null,
        };
      }),
  },
  bubbleEntry({
    id: "sat-asin",
    spokeId: "ecommerce",
    label: "Unnested bundles",
    tab: "Catalog Governance",
    read: (ctx) =>
      retailReading(ctx, (snapshot) => {
        const hero = catalogHero(snapshot);
        return counted(hero.ratio, "bundles in this retail read", hero.pie, hero.tip, hero.explainer);
      }),
  }),
  {
    id: "catalog-specs-complete",
    spokeId: "ecommerce",
    tab: "Catalog Governance",
    label: "Amazon specs complete",
    read: (ctx) =>
      retailFigure(ctx, (snapshot) => heroFigure(specHero(snapshot), "checked listings", "Amazon spec-field reading not stored.")),
  },
  lostSalesEntry("smartscout"),
  lostSalesEntry("brand_reported"),
];
