import { loadAiSearchRead, type AiReadClient } from "@/lib/ai-search/queries";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import { loadBriefingAi } from "@/lib/export/briefing-ai";
import { buildBriefingExport } from "@/lib/export/briefing-export";
import type { BuiltExport } from "@/lib/export/types";
import {
  approvedExceptionAsins,
  withMapApprovedExceptions,
  type MapSetAsideFields,
} from "@/lib/fender-canvas/map-approved-exceptions";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { loadFindabilityRead, type FindabilityClient } from "@/lib/findability/queries";
import type { FindabilityRead } from "@/lib/findability/copy";
import { FMIC_CLIENT_KEY, SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/**
 * Active MAP set-asides, the same select the MAP panel's set-aside store runs,
 * so the MAP leakage count matches Summary Briefing.
 */
async function loadMapExceptions(): Promise<{ asins: Set<string>; failed: boolean }> {
  try {
    const { data, error } = await getCanvasSupabase()
      .from("canvas_issue_set_asides")
      .select("*")
      .eq("client_key", FMIC_CLIENT_KEY)
      .eq("check_key", SET_ASIDE_CHECKS.mapPricing)
      .order("updated_at", { ascending: false });
    if (error) return { asins: new Set(), failed: true };
    return {
      asins: approvedExceptionAsins((data ?? []) as MapSetAsideFields[]),
      failed: false,
    };
  } catch {
    return { asins: new Set(), failed: true };
  }
}

async function loadRetail(): Promise<RetailCanvasRead> {
  try {
    const [snapshot, exceptions] = await Promise.all([loadPortfolioRetailSnapshot(), loadMapExceptions()]);
    return {
      phase: "ready",
      snapshot: withMapApprovedExceptions(snapshot, exceptions.asins, { failed: exceptions.failed }),
    };
  } catch {
    return { phase: "error" };
  }
}

async function loadFindability(): Promise<FindabilityRead> {
  try {
    return await loadFindabilityRead(getCanvasSupabase() as unknown as FindabilityClient);
  } catch (error) {
    return { phase: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

async function loadAi(): Promise<AiSearchRead> {
  try {
    return await loadAiSearchRead(getCanvasSupabase() as unknown as AiReadClient);
  } catch (error) {
    return { phase: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/** Summary Briefing findings from briefingFindingsLead, or a failed read with no file. */
export async function loadBriefingExport(): Promise<BuiltExport> {
  const [retail, findability, current, asOf] = await Promise.all([
    loadRetail(),
    loadFindability(),
    loadAi(),
    loadDashboardAsOf(),
  ]);
  const ai = await loadBriefingAi(current);
  return buildBriefingExport({
    retail,
    findability,
    ai: ai.read,
    asOf: asOf.asOf,
    freshnessFailed: asOf.failed,
    unbrandedWindow: ai.windowLabel,
  });
}
