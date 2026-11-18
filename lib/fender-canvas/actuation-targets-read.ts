/**
 * Server read for the staff Actuation records page: the suggested P1 and P2 target sites, from the
 * client's own AI answers in the default date-pill window (the last 30 days, every engine when the
 * API-engine runs read), the same read Action Items builds its Actuation items from. Never call
 * from the browser. Null when the window cannot be read, so no list shows rather than another
 * client's sites.
 */

import { DEFAULT_ENGINE_GROUP_CHOICE } from "@/lib/ai-search/engine-group";
import type { HistoryReadClient } from "@/lib/ai-search/history-queries";
import { DEFAULT_HISTORY_MODE } from "@/lib/ai-search/history-mode";
import type { AiReadClient } from "@/lib/ai-search/queries";
import type { AiSelectionScope } from "@/lib/ai-search/selection";
import { loadAiSelection } from "@/lib/ai-search/selection-load";
import { ensureSiteTypes } from "@/lib/ai-search/site-types";
import type { ClientKey } from "@/lib/client/active-client";
import { runWithClient } from "@/lib/client/server-client";
import { suggestedTargets, type ActuationTargets } from "@/lib/fender-canvas/roadmap-actuation";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export type ActuationTargetsRead = { targets: ActuationTargets; windowLabel: string } | null;

function scope(enginesReady: boolean): AiSelectionScope {
  return {
    mode: DEFAULT_HISTORY_MODE as AiSelectionScope["mode"],
    windowEnd: null,
    engines: DEFAULT_ENGINE_GROUP_CHOICE,
    enginesReady,
  };
}

export async function loadActuationTargets(client: ClientKey): Promise<ActuationTargetsRead> {
  try {
    return await runWithClient(client, async () => {
      const supabase = getCanvasSupabase();
      await ensureSiteTypes(supabase);
      const reader = supabase as unknown as HistoryReadClient & AiReadClient;
      let loaded = await loadAiSelection(reader, scope(true), { citations: true });
      if (!loaded.ok) loaded = await loadAiSelection(reader, scope(false), { citations: true });
      if (!loaded.ok || loaded.selection.read.phase !== "ready") return null;
      return { targets: suggestedTargets(loaded.selection.read.snapshot), windowLabel: loaded.selection.pillLabel };
    });
  } catch {
    return null;
  }
}
