import type { HistoryReadClient } from "@/lib/ai-search/history-queries";
import type { AiReadClient } from "@/lib/ai-search/queries";
import type { AiSelectionScope } from "@/lib/ai-search/selection";
import { loadAiSelection } from "@/lib/ai-search/selection-load";
import { ensureSiteTypes } from "@/lib/ai-search/site-types";
import { DEFAULT_ENGINE_GROUP_CHOICE } from "@/lib/ai-search/engine-group";
import { loadExceptions } from "@/lib/export/map-export";
import { loadSpecPages } from "@/lib/fender-canvas/machine-readability";
import { withMapApprovedExceptions } from "@/lib/fender-canvas/map-approved-exceptions";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import type { ScoreSnapshotReads } from "@/lib/fender-canvas/score-snapshot";
import type { FindabilityRead } from "@/lib/findability/copy";
import { loadFindabilityRead, type FindabilityClient } from "@/lib/findability/queries";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** The date pill and engine switch a page load opens on: last 30 days, engines All. */
const DEFAULT_SCOPE: AiSelectionScope = {
  mode: { kind: "month" },
  windowEnd: null,
  engines: DEFAULT_ENGINE_GROUP_CHOICE,
  enginesReady: true,
};

async function retailRead(): Promise<RetailCanvasRead> {
  try {
    const [snapshot, exceptions] = await Promise.all([loadPortfolioRetailSnapshot(), loadExceptions()]);
    return { phase: "ready", snapshot: withMapApprovedExceptions(snapshot, exceptions.asins, { failed: exceptions.failed }) };
  } catch {
    return { phase: "error" };
  }
}

async function aiRead(): Promise<Pick<ScoreSnapshotReads, "ai" | "aiWindow">> {
  const client = getCanvasSupabase();
  await ensureSiteTypes(client);
  const history = client as unknown as HistoryReadClient & AiReadClient;
  let loaded = await loadAiSelection(history, DEFAULT_SCOPE, { citations: false });
  // The screen's engine switch reads Not available* when the API runs are missing or failed, and its
  // figures are then the search engines'. Read the same way.
  if (!loaded.ok) loaded = await loadAiSelection(history, { ...DEFAULT_SCOPE, enginesReady: false }, { citations: false });
  if (!loaded.ok) return { ai: { phase: "error", message: loaded.message }, aiWindow: null };
  const { selection } = loaded;
  return {
    ai: selection.read,
    aiWindow: {
      pillLabel: selection.pillLabel,
      runCount: selection.runCount,
      enginesReady: selection.enginesReady,
      newestRunAt: selection.newestRunAt,
    },
  };
}

/**
 * The reads Summary → Performance scores from, made with the dashboard's own loaders for the active
 * client (wrap in runWithClient). A failed read stays failed; its components drop as on screen.
 */
export async function loadScoreSnapshotReads(): Promise<ScoreSnapshotReads> {
  const [findability, specPages, retail, ai] = await Promise.all([
    loadFindabilityRead(getCanvasSupabase() as unknown as FindabilityClient).catch(
      (error: unknown): FindabilityRead => ({ phase: "error", message: error instanceof Error ? error.message : String(error) }),
    ),
    loadSpecPages().catch(() => null),
    retailRead(),
    aiRead().catch((error: unknown) => ({
      ai: { phase: "error" as const, message: error instanceof Error ? error.message : String(error) },
      aiWindow: null,
    })),
  ]);
  return { findability, specPages, retail, ...ai };
}
