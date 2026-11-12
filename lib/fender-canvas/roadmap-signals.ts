/**
 * Roadmap and Action Items: other signals as actions (decision 21 d), where the client has the
 * figure. Each one is the figure its home tab leads with, read from the same rows:
 * out-of-stock listings (Out of Stock), missing Amazon spec fields (Amazon Specs), fact-check
 * contradictions (Product Fact Checks), and rival-led categories (Category Battlecards).
 * Products with no official page are the Exact official product pages finding already.
 * An action shows only when its figure has something to fix.
 */

import { categoryLeads } from "@/lib/ai-search/category-on-track";
import { driftRead } from "@/lib/ai-search/drift";
import { categoryRoleTallies } from "@/lib/ai-search/question-role";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { brandName, brandSite, leadBrand } from "@/lib/brand-copy";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import type { StockLossRead } from "@/lib/fender-canvas/minimal-metric-kit";
import { STOCK_LOSS_TAB, type RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { specHero } from "@/lib/fender-canvas/retail-overview-lead";

export type SignalGroup = "ecommerce" | "answers";

export type SignalAction = {
  id: string;
  group: SignalGroup;
  label: string;
  /** Share of the population affected, 0 to 1. */
  share: number;
  numerator: number;
  denominator: number | null;
  fact: string;
  action: string;
  open: { spokeId: string; tab: string };
  partial: PartialFigure | null;
  /** Stored category keys the signal belongs to; absent when it is brand-wide (client focus). */
  categories?: string[];
  /** The rival a rival-led category signal names. */
  rival?: string;
};

function outOfStock(stock: StockLossRead): SignalAction | null {
  if (stock.phase !== "ready") return null;
  const affected = stock.rows.length;
  const population = stock.populationCount;
  if (affected <= 0) return null;
  const counted = population != null && population > 0 ? `${formatRatio(affected, population)} listings were` : `${formatInt(affected)} listings were`;
  return {
    id: "signal:out_of_stock",
    group: "ecommerce",
    label: "Out-of-stock listings",
    share: population ? affected / population : 1,
    numerator: affected,
    denominator: population && population > 0 ? population : null,
    fact: `${counted} out of stock at least one day in the last 12 months.`,
    action: "Restock these listings, or correct their offers, so each one can be bought.",
    open: { spokeId: "ecommerce", tab: STOCK_LOSS_TAB },
    partial: null,
  };
}

function missingSpecs(retail: RetailCanvasRead): SignalAction | null {
  if (retail.phase !== "ready") return null;
  const hero = specHero(retail.snapshot);
  if (hero.numerator == null || hero.denominator == null || hero.denominator <= 0) return null;
  const missing = hero.denominator - hero.numerator;
  if (missing <= 0) return null;
  const reading = retail.snapshot.amazonSpecGaps;
  return {
    id: "signal:missing_specs",
    group: "ecommerce",
    label: "Missing Amazon spec fields",
    share: missing / hero.denominator,
    numerator: missing,
    denominator: hero.denominator,
    fact: `${formatRatio(missing, hero.denominator)} checked listings are missing an Amazon spec field.`,
    action: "Fill the missing Amazon spec fields on these listings.",
    open: { spokeId: "specs", tab: "Amazon Specs" },
    partial:
      reading.status === "incomplete" && reading.missingMessage
        ? { reason: "coverage", missing: reading.missingMessage, source: "canvas_spec_readiness" }
        : null,
  };
}

function contradictions(ai: AiSearchRead): SignalAction | null {
  if (ai.phase !== "ready") return null;
  const { coverage } = driftRead(ai.snapshot.calls, ai.snapshot.probes);
  if (coverage.answersChecked <= 0 || coverage.contradictions <= 0) return null;
  return {
    id: "signal:fact_contradictions",
    group: "answers",
    label: "Fact-check contradictions",
    share: coverage.contradictions / coverage.answersChecked,
    numerator: coverage.contradictions,
    denominator: coverage.answersChecked,
    fact: `${formatRatio(coverage.contradictions, coverage.answersChecked)} checked answers contradicted a verified ${brandName()} product fact.`,
    action: `Correct each contradicted fact where ${brandName()} publishes it, starting with ${brandSite()}.`,
    open: { spokeId: "aeo", tab: "Product Fact Checks" },
    partial: null,
  };
}

function rivalLedCategories(ai: AiSearchRead): SignalAction[] {
  if (ai.phase !== "ready") return [];
  const calls = ai.snapshot.calls;
  const leads = categoryLeads(categoryRoleTallies(calls), calls);
  const resolved = leads.reduce((sum, lead) => sum + lead.resolved, 0);
  if (resolved <= 0) return [];
  return leads.flatMap((lead) => {
    if (lead.status !== "behind" || !lead.topRival) return [];
    const rival = lead.topRival;
    return [
      {
        id: `signal:rival:${lead.key}`,
        group: "answers" as const,
        label: `${rival.brand} leads ${lead.label}`,
        // The figure is the share of all resolved unbranded discovery answers the rival leads
        // here, the same share that ranks it (21f); the fact gives the category's own count.
        share: rival.wins / resolved,
        numerator: rival.wins,
        denominator: resolved,
        fact: `${rival.brand} is named most in ${formatRatio(rival.wins, lead.resolved)} resolved unbranded discovery answers in ${lead.label} (${formatPct((100 * rival.wins) / lead.resolved)}). ${leadBrand()} is named most in ${formatInt(lead.fenderLeads)}.`,
        action: `Publish comparison content on ${brandSite()} for ${lead.label} against ${rival.brand}.`,
        open: { spokeId: "competitors", tab: "Category Battlecards" },
        partial: null,
        categories: [lead.key],
        rival: rival.brand,
      },
    ];
  });
}

/** Every 21d action the reads support, ecommerce first in 21d's order, then answer-based ones. */
export function signalActions(input: {
  retail: RetailCanvasRead;
  ai: AiSearchRead;
  stock: StockLossRead;
}): SignalAction[] {
  return [
    outOfStock(input.stock),
    missingSpecs(input.retail),
    ...rivalLedCategories(input.ai),
    contradictions(input.ai),
  ].filter((signal): signal is SignalAction => signal != null);
}
