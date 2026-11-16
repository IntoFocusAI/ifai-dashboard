/**
 * C-01 deck, listing slides. Each figure comes from the hero function its Catalog Health or
 * AI Readiness tab renders, on the same retail, findability, spec-page, and out-of-stock reads.
 */

import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import { formatInt, formatRatio, formatUsd } from "@/lib/fender-canvas/format";
import { machineReadabilityHeroes, specPageCounts } from "@/lib/fender-canvas/machine-readability";
import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";
import {
  buyBoxHero,
  catalogHero,
  heroFigureTone,
  mapHero,
  specHero,
  type RetailOverviewHeroModel,
} from "@/lib/fender-canvas/retail-overview-lead";
import { lostSales, lostSalesPartial, REVENUE_SOURCE_LABELS, sumLostSales } from "@/lib/fender-canvas/stock-loss";
import { SPLINTERED_LISTINGS_LABEL } from "@/lib/fender-canvas/briefing-retail-lead";
import { outcomeRatioFigure, outcomeShareFigure } from "@/lib/findability/lead";
import { countFindability } from "@/lib/findability/outcomes";
import { ANALYST_ESTIMATE, SOURCES, type DeckFigure, type DeckInput, type DeckSlide } from "@/lib/deck/deck-types";

const ACT_TWO = "Why the listings decide it";

const TONE_STATUS = { danger: "bad", warning: "okay", success: "good" } as const;

/** The tab's status for a hero, or null when the hero has no figure to grade. */
export function heroStatus(hero: Pick<RetailOverviewHeroModel, "numerator" | "denominator" | "tone">): DataStatus | null {
  const tone = heroFigureTone(hero);
  return tone ? TONE_STATUS[tone] : null;
}

function ready(hero: RetailOverviewHeroModel): boolean {
  return hero.numerator != null && hero.denominator != null;
}

/** A hero as one deck figure: the tab's share (asterisk when partial), N of M, and status. */
export function heroFigure(id: string, label: string, hero: RetailOverviewHeroModel, source: string): DeckFigure {
  return {
    id,
    label,
    value: `${hero.percent}${hero.partial ? "*" : ""}`,
    ratio: hero.ratio,
    status: heroStatus(hero),
    source,
    tip: hero.partial ? [hero.tip, hero.partial.missing].filter(Boolean).join(" ") : hero.tip,
  };
}

/** The Out of Stock hero's 12-month figure for the first sales source, as that tab shows it. */
export function stockLossFigure(input: DeckInput): { figure: DeckFigure; affected: number } | null {
  if (!input.stockLoss) return null;
  const year = sumLostSales(input.stockLoss.rows, 365);
  const first = year.bySource[0];
  if (!first || year.affectedCount === 0) return null;
  const partial = lostSalesPartial(input.stockLoss.rows, year);
  return {
    affected: year.affectedCount,
    figure: {
      id: "stock-loss",
      label: `Est. lost sales from out of stock, 12 months (${REVENUE_SOURCE_LABELS[first.source]})`,
      value: `${formatUsd(first.total)}${partial ? "*" : ""}`,
      ratio: `Covers ${formatRatio(year.estimatedCount, year.affectedCount)} out-of-stock listings`,
      status: null,
      source: SOURCES.outOfStock,
      tip: `${formatInt(year.estimatedCount)} of ${formatInt(year.affectedCount)} out-of-stock listings have a sales estimate.`,
      estimate: true,
    },
  };
}

function buyBoxSlide(input: DeckInput, snapshot: PortfolioRetailSnapshot): DeckSlide | null {
  const hero = buyBoxHero(snapshot);
  if (!ready(hero)) return null;
  const counts = snapshot.suppressedListings.detail?.counts ?? null;
  const stock = stockLossFigure(input);
  const figures: DeckFigure[] = [{ ...heroFigure("buy-box", "Buy Box withheld", hero, SOURCES.suppressed), accent: true }];
  if (counts && counts.withheld > 0) {
    figures.push({
      id: "above-outside",
      label: "Priced above Amazon's outside price",
      value: formatInt(counts.confirmedHighPrice),
      ratio: `${formatRatio(counts.confirmedHighPrice, counts.withheld)} withheld listings`,
      status: null,
      source: SOURCES.suppressed,
      tip: "Withheld listings priced above the lowest outside price Amazon found in the same check.",
    });
  }
  if (stock) figures.push(stock.figure);
  const withheld = formatInt(hero.numerator);
  return {
    id: "s5",
    kind: "stats",
    backstage: false,
    act: ACT_TWO,
    headline: `${withheld} ${input.brand} ${hero.numerator === 1 ? "listing has" : "listings have"} no buy button on Amazon${stock ? `, and ${formatInt(stock.affected)} went out of stock in the last 12 months` : ""}.`,
    why: `When an assistant names one of these products, the shopper lands on a page with no one-click offer or nothing to buy. The recommendation turns into a lost sale.`,
    figures,
    sources: [...new Set(figures.map((figure) => figure.source))],
    note: `Amazon withholds the Buy Box when the offer is above the lowest price it found outside Amazon. Amazon does not name that retailer.`,
  };
}

function mapSlide(input: DeckInput, snapshot: PortfolioRetailSnapshot): DeckSlide | null {
  const hero = mapHero(snapshot);
  if (!ready(hero)) return null;
  const detail = snapshot.mapLeakage.detail;
  const gap = detail?.averageLeakage ?? null;
  const gapMark = (detail?.approvedExceptions ?? 0) > 0 ? "*" : "";
  const figures: DeckFigure[] = [{ ...heroFigure("map", "MAP leakage", hero, SOURCES.map), accent: true }];
  if (gap != null) {
    figures.push({
      id: "map-gap",
      label: "Average price gap",
      value: `${formatUsd(gap, { signed: true })}${gapMark}`,
      ratio: `Average across ${formatInt(detail?.violations)} listings below MAP`,
      status: null,
      source: SOURCES.map,
      tip: "Average of the largest stored channel gap on each listing priced below MAP.",
    });
  }
  const offers = formatInt(hero.numerator);
  return {
    id: "s6",
    kind: "stats",
    backstage: false,
    act: ACT_TWO,
    headline: `${offers} ${input.brand} ${hero.numerator === 1 ? "offer is" : "offers are"} advertised below MAP${gap != null ? `, by ${formatUsd(Math.abs(gap))} on average` : ""}.`,
    why: `A price below MAP puts a lower number on the public record than ${input.brand} agreed to advertise. That is the number shoppers and assistants see.`,
    figures,
    sources: [SOURCES.map],
    note: `A lower outside price is what Amazon compares against when it withholds a Buy Box. Amazon does not name the outside retailer, so no listing here is tied to one.`,
  };
}

function bundleSlide(input: DeckInput, snapshot: PortfolioRetailSnapshot): DeckSlide | null {
  const hero = catalogHero(snapshot);
  if (!ready(hero)) return null;
  const spec = specHero(snapshot);
  const figures: DeckFigure[] = [{ ...heroFigure("splintered", SPLINTERED_LISTINGS_LABEL, hero, SOURCES.governance), accent: true }];
  if (ready(spec)) figures.push(heroFigure("specs-complete", "Amazon specs complete", spec, SOURCES.governance));
  return {
    id: "s7",
    kind: "stats",
    backstage: false,
    act: ACT_TWO,
    headline: `${formatInt(hero.numerator)} ${input.brand} ${hero.numerator === 1 ? "bundle sits on its own listing, so its reviews are" : "bundles sit on their own listings, so their reviews are"} split from the main product.`,
    why: `Assistants and Amazon judge a product by its review record. Split reviews make a strong ${input.brand} product look weaker next to a rival with one consolidated page.`,
    figures,
    sources: [SOURCES.governance],
    note: `Nesting each bundle under the official parent listing pools the reviews on one page.`,
  };
}

function exactPageStatus(exact: number, total: number): DataStatus {
  const share = (100 * exact) / total;
  return share < 25 ? "bad" : share > 60 ? "good" : "okay";
}

/** s8: exact official pages (Findability) and machine-readable specs (Brand-Site Specs). */
export function brandSiteSlide(input: DeckInput): DeckSlide | null {
  if (input.findability.phase !== "ready") return null;
  const counts = countFindability(input.findability.rows);
  const share = outcomeShareFigure(counts, "exact_official_product");
  const ratio = outcomeRatioFigure(counts, "exact_official_product");
  if (!share || !ratio || counts.total <= 0) return null;
  const site = input.brandSite;
  const figures: DeckFigure[] = [
    {
      id: "exact-page",
      label: "Exact official product page",
      value: share,
      ratio,
      status: exactPageStatus(counts.exact_official_product, counts.total),
      source: SOURCES.findability,
      tip: `${formatInt(counts.official_family_page)} of ${formatInt(counts.total)} listings match only a family page.`,
      accent: true,
    },
  ];
  const pages = specPageCounts(input.specPages);
  const missing = input.specPages ? machineReadabilityHeroes(input.specPages)[0] : null;
  if (pages && missing?.ratio) {
    const pctMissing = (100 * pages.missingSpecBlock) / pages.pages;
    figures.push({
      id: "missing-specs",
      label: "Pages missing machine-readable specs",
      value: `${missing.percent}${missing.partial ? "*" : ""}`,
      ratio: missing.ratio,
      status: pctMissing <= 2 ? "good" : pctMissing <= 5 ? "okay" : "bad",
      source: SOURCES.brandSiteSpecs,
      tip: missing.tip,
    });
  }
  const specClause = pages
    ? pages.withSpecBlock === 0
      ? `, and no ${site} page publishes its specs in a form AI reads`
      : `, and ${formatRatio(pages.missingSpecBlock, pages.pages)} checked ${site} pages do not publish specs in a form AI reads`
    : "";
  return {
    id: "s8",
    kind: "stats",
    backstage: false,
    act: ACT_TWO,
    headline: `Only ${ratio} ${input.brand} Amazon listings have an exact ${site} page${specClause}.`,
    why: `AI engines take a brand's own product data as fact. Where that page is missing, or covers a whole family, the assistant has to guess the specs or borrow them from a reseller.`,
    figures,
    sources: [...new Set(figures.map((figure) => figure.source))],
    note: `${formatInt(counts.official_family_page)} of ${formatInt(counts.total)} listings match only a family page.`,
  };
}

/** s5 to s7, in the outline's order. Each is left out when its tab has no stored N of M. */
export function listingSlides(input: DeckInput): DeckSlide[] {
  if (input.retail.phase !== "ready") return [];
  const snapshot = input.retail.snapshot;
  return [buyBoxSlide(input, snapshot), mapSlide(input, snapshot), bundleSlide(input, snapshot)].filter(
    (slide): slide is DeckSlide => slide != null,
  );
}

/** b2: the Buy Box readings behind slide 5. */
export function buyBoxDetailSlide(input: DeckInput): DeckSlide | null {
  if (input.retail.phase !== "ready") return null;
  const counts = input.retail.snapshot.suppressedListings.detail?.counts ?? null;
  if (!counts || counts.current <= 0) return null;
  const row = (label: string, n: number, of: number) => [label, formatRatio(n, of)];
  return {
    id: "b2",
    kind: "table",
    backstage: true,
    act: "Backstage",
    headline: "Buy Box readings in detail.",
    why: "The current readings behind slide 5.",
    figures: [],
    table: {
      columns: ["Reading", "Listings"],
      rows: [
        row("Current readings of monitored listings", counts.current, counts.population),
        row("Buy Box present", counts.present, counts.current),
        row("Buy Box withheld", counts.withheld, counts.current),
        row("Withheld and priced above the outside price", counts.confirmedHighPrice, counts.withheld),
        row("Withheld with no outside price to compare", counts.withheldWithoutBenchmark, counts.withheld),
        row("No active offer", counts.noActiveOffer, counts.current),
      ],
      caption: "Each row is N of M as Suppressed Listings counts it.",
    },
    sources: [SOURCES.suppressed],
    note: "A withheld listing with no outside price has no confirmed cause.",
  };
}

/** b3: the out-of-stock listings with the largest analyst estimate. */
export function stockDetailSlide(input: DeckInput): DeckSlide | null {
  if (!input.stockLoss) return null;
  const ranked = input.stockLoss.rows
    .map((row) => ({ row, lost: lostSales(row, 365) }))
    .filter((entry): entry is { row: (typeof entry)["row"]; lost: number } => entry.lost != null && entry.lost > 0)
    .sort((a, b) => b.lost - a.lost);
  if (ranked.length === 0) return null;
  const shown = ranked.slice(0, 6);
  return {
    id: "b3",
    kind: "table",
    backstage: true,
    act: "Backstage",
    headline: "Out-of-stock listings with the largest estimated lost sales.",
    why: "The top of the Out of Stock table behind slide 5.",
    figures: [],
    table: {
      columns: ["Listing", "Days out of stock, 12 months", `Est. lost sales, ${ANALYST_ESTIMATE}`],
      rows: shown.map(({ row, lost }) => [
        (row.title ?? row.asin).slice(0, 90),
        formatInt(row.oos_days_365),
        formatUsd(lost),
      ]),
      caption: `${formatInt(shown.length)} of ${formatInt(input.stockLoss.rows.length)} out-of-stock listings, largest estimate first.`,
    },
    sources: [SOURCES.outOfStock],
    note: "Each estimate is that listing's sales per in-stock day times its out-of-stock days.",
  };
}
