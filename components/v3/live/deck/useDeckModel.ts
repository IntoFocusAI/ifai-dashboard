"use client";

import { useMemo } from "react";
import { useAiHistory } from "@/components/v3/live/ai-search/AiHistoryContext";
import { useEngineGroupRead } from "@/components/v3/live/ai-search/EngineGroupScope";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useStockLossRead } from "@/components/v3/live/useMinimalMetricReads";
import { useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import { brandName, brandSite, leadBrand } from "@/lib/brand-copy";
import { buildDeck } from "@/lib/deck/deck-model";
import type { DeckModel } from "@/lib/deck/deck-types";
import {
  ENTERPRISE_POTENTIAL_ESTIMATE,
  NO_ANALYST_ESTIMATE,
  PHASE_ONE_LIFT_ESTIMATE,
} from "@/lib/fender-canvas/analyst-estimates";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
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

function estimate(value: string): string | null {
  return value === NO_ANALYST_ESTIMATE ? null : value;
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

  return useMemo<DeckLoad>(() => {
    const pending = [tabRead.phase, retail.phase, findability.phase, stock.phase].includes("loading");
    if (pending) return { phase: "loading" };
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
      phaseOneLift: estimate(PHASE_ONE_LIFT_ESTIMATE),
      enterprisePotential: estimate(ENTERPRISE_POTENTIAL_ESTIMATE),
    });
    return { phase: "ready", model };
  }, [aiStale, bundle, findability, history.controlLabel, retail, stock, tabRead]);
}
