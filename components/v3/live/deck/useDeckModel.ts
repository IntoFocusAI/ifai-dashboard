"use client";

import { useMemo } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useEngineGroupRead } from "@/components/v3/live/ai-search/EngineGroupScope";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useStockLossRead } from "@/components/v3/live/useMinimalMetricReads";
import { useRoadmapPlan } from "@/components/v3/live/RoadmapPlanData";
import { useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import { brandName, brandSite, leadBrand } from "@/lib/brand-copy";
import { buildDeck } from "@/lib/deck/deck-model";
import type { DeckInput, DeckModel } from "@/lib/deck/deck-types";
import {
  enterprisePotentialEstimate,
  ESTIMATE_LOADING,
  NO_ANALYST_ESTIMATE,
  phaseOneLiftEstimate,
} from "@/lib/fender-canvas/analyst-estimates";
import { lineFromListings } from "@/lib/fender-canvas/action-items-fix-list";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { STOCK_LOSS_ESTIMATE_LINE } from "@/lib/fender-canvas/stock-loss";
import type { CanvasBundle, CanvasFreshnessRow } from "@/lib/fender-canvas/types";

/** The latest job run, as the header's "Data as of" reads it. */
function asOfLabel(rows: readonly CanvasFreshnessRow[]): string | null {
  let max: number | null = null;
  for (const row of rows) {
    if (!row.last_run_at) continue;
    const time = new Date(row.last_run_at).getTime();
    if (max == null || time > max) max = time;
  }
  return max == null ? null : new Date(max).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Line 1 as the Out of Stock tab's estimate card adds it up, or null until it has a range. */
function outOfStockLine(bundle: CanvasBundle): DeckInput["outOfStockLine"] {
  const est = bundle.estimates;
  if (est?.phase !== "ready") return null;
  const figure = lineFromListings(est.estimates, STOCK_LOSS_ESTIMATE_LINE);
  if (!figure || figure.status !== "estimated" || !figure.range) return null;
  return { range: figure.range, asterisk: figure.line.asterisk, means: figure.line.trail.means };
}

function estimate(value: string): string | null {
  return value === NO_ANALYST_ESTIMATE || value === ESTIMATE_LOADING ? null : value;
}

export type DeckLoad = { phase: "loading" } | { phase: "ready"; model: DeckModel };

/**
 * The deck's reads: the window every AI figure reads (date pill plus API runs, engine switch;
 * Brian Magazu, 12 Nov 2026), and the retail, findability, spec-page, and out-of-stock reads the
 * tabs show. Waits until each has settled.
 */
export function useDeckModel(bundle: CanvasBundle, retail: RetailCanvasRead): DeckLoad {
  const history = useAiHistory();
  const { read: tabRead } = useEngineGroupRead();
  const aiStale = useSummaryAiStale(tabRead);
  const findability = useFindability();
  const stock = useStockLossRead();
  // Slide s9 lists the first five fixes of the one central ranking Action Items shows.
  const { plan, sources: planSources, settled: planSettled } = useRoadmapPlan(retail, bundle);

  return useMemo<DeckLoad>(() => {
    const pending = [tabRead.phase, retail.phase, findability.phase, stock.phase, planSources.phase].includes("loading");
    if (pending || !planSettled) return { phase: "loading" };
    const model = buildDeck({
      brand: brandName(),
      brandSite: brandSite(),
      leadBrand: leadBrand(),
      tabAi: tabRead.phase === "ready" ? tabRead.snapshot : null,
      aiStale,
      retail,
      findability,
      specPages: bundle.specPages ?? null,
      stockLoss: stock.phase === "ready" ? { rows: stock.rows, populationCount: stock.populationCount } : null,
      windowLabel: history.controlLabel,
      asOf: asOfLabel(bundle.fresh),
      outOfStockLine: outOfStockLine(bundle),
      phaseOneLift: estimate(phaseOneLiftEstimate(bundle)),
      enterprisePotential: estimate(enterprisePotentialEstimate(bundle)),
      plan,
    });
    return { phase: "ready", model };
  }, [aiStale, bundle, findability, history.controlLabel, plan, planSettled, planSources.phase, retail, stock, tabRead]);
}
