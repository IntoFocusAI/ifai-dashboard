/**
 * Server read for the staff "Sites to review" page and its CSV. Never call from the browser:
 * the staff read runs as the signed-in user (cookies), and public.site_types_to_review returns
 * rows only to IntoFocus staff.
 *
 * Until that function is applied, the list comes from public.canvas_site_types (needs_review),
 * without the reason, and saving is off.
 *
 * Every row is a site this client's own AI answers cite in the date-pill window (decisions 83
 * and 84): the default window, the last 30 days ending on the published run, read the way the
 * tabs read it. A flagged site no answer cites is left out, and when the window cannot be read
 * the list is not shown at all, so another client's sites never appear.
 */

import { citationEvidence } from "@/lib/ai-search/citations";
import { DEFAULT_ENGINE_GROUP_CHOICE } from "@/lib/ai-search/engine-group";
import type { HistoryReadClient } from "@/lib/ai-search/history-queries";
import { DEFAULT_HISTORY_MODE } from "@/lib/ai-search/history-mode";
import type { AiReadClient } from "@/lib/ai-search/queries";
import type { AiSelectionScope } from "@/lib/ai-search/selection";
import { loadAiSelection } from "@/lib/ai-search/selection-load";
import { SITE_TYPE_VIEW } from "@/lib/ai-search/site-types";
import { citedReviewRows, type RawReviewRow, type ReviewRow } from "@/lib/ai-search/site-review";
import { CLIENTS, type ClientKey } from "@/lib/client/active-client";
import { runWithClient } from "@/lib/client/server-client";
import { getCanvasSupabase, getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";
import { createClient } from "@/lib/supabase/server";

export type SitesToReviewRead =
  | {
      ok: true;
      rows: ReviewRow[];
      /** The staff read and write functions answer: reasons show and saving is on. */
      writable: boolean;
      /** The date pill's words for the window the answers are counted in. */
      windowLabel: string;
      /** False when the API-engine runs could not be read, so only search-engine answers count. */
      apiEngines: boolean;
    }
  | { ok: false; message: string };

async function staffRead(clientKey: string): Promise<RawReviewRow[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("site_types_to_review", { p_client_key: clientKey });
    return error || !Array.isArray(data) ? null : (data as RawReviewRow[]);
  } catch {
    return null;
  }
}

async function viewRead(clientKey: string): Promise<RawReviewRow[] | null> {
  const { data, error } = await getPublicCanvasSupabase()
    .from(SITE_TYPE_VIEW)
    .select("domain,site_type,source,confidence,needs_review")
    .eq("client_key", clientKey)
    .eq("needs_review", true);
  return error || !Array.isArray(data) ? null : (data as RawReviewRow[]);
}

type CitedLinks = {
  rows: Array<{ domain: string; simulationId: string }>;
  windowLabel: string;
  apiEngines: boolean;
};

const WINDOW_FAILED = "The AI answers in the last 30 days could not be read. Reload to try again.";

/** The default date-pill window, as a tab first shows it. */
function windowScope(enginesReady: boolean): AiSelectionScope {
  return {
    mode: DEFAULT_HISTORY_MODE as AiSelectionScope["mode"],
    windowEnd: null,
    engines: DEFAULT_ENGINE_GROUP_CHOICE,
    enginesReady,
  };
}

/**
 * Cited links in the client's answers in the date-pill window, one row per answer and site.
 * With every engine when the API-engine runs read, else the search engines alone. Null when the
 * window cannot be read.
 */
async function citedLinks(client: ClientKey): Promise<CitedLinks | null> {
  try {
    return await runWithClient(client, async () => {
      const supabase = getCanvasSupabase() as unknown as HistoryReadClient & AiReadClient;
      let loaded = await loadAiSelection(supabase, windowScope(true), { citations: true });
      if (!loaded.ok) loaded = await loadAiSelection(supabase, windowScope(false), { citations: true });
      if (!loaded.ok) return null;
      const { citationSnapshot, pillLabel, enginesReady } = loaded.selection;
      const rows = citationSnapshot
        ? citationEvidence(citationSnapshot.calls, citationSnapshot.citations, "all").rows
        : [];
      return { rows, windowLabel: pillLabel, apiEngines: enginesReady };
    });
  } catch {
    return null;
  }
}

export async function loadSitesToReview(client: ClientKey): Promise<SitesToReviewRead> {
  const clientKey = CLIENTS[client].setAsideKey;
  const [staff, cited] = await Promise.all([staffRead(clientKey), citedLinks(client)]);
  if (!cited) return { ok: false, message: WINDOW_FAILED };
  const raw = staff ?? (await viewRead(clientKey));
  if (!raw) return { ok: false, message: "The site type list could not be read. Reload to try again." };
  return {
    ok: true,
    rows: citedReviewRows(raw, { fromStaffRead: staff != null }, cited.rows),
    writable: staff != null,
    windowLabel: cited.windowLabel,
    apiEngines: cited.apiEngines,
  };
}
