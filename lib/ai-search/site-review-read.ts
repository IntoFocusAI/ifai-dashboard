/**
 * Server read for the staff "Sites to review" page and its CSV. Never call from the browser:
 * the staff read runs as the signed-in user (cookies), and public.site_types_to_review returns
 * rows only to IntoFocus staff.
 *
 * Until that function is applied, the list comes from public.canvas_site_types (needs_review),
 * without the reason, and saving is off.
 */

import { citationEvidence } from "@/lib/ai-search/citations";
import { loadAiSearchRead, type AiReadClient } from "@/lib/ai-search/queries";
import { SITE_TYPE_VIEW } from "@/lib/ai-search/site-types";
import { answersByDomain, reviewRows, type RawReviewRow, type ReviewRow } from "@/lib/ai-search/site-review";
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
      /** The published-run citation read worked, so the answers column shows. */
      hasAnswers: boolean;
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

/** Cited links in the published run, per answer. Null when the run cannot be read. */
async function citedLinks(client: ClientKey): Promise<Array<{ domain: string; simulationId: string }> | null> {
  try {
    return await runWithClient(client, async () => {
      const read = await loadAiSearchRead(getCanvasSupabase() as unknown as AiReadClient);
      if (read.phase !== "ready") return null;
      return citationEvidence(read.snapshot.calls, read.snapshot.citations, "all").rows;
    });
  } catch {
    return null;
  }
}

export async function loadSitesToReview(client: ClientKey): Promise<SitesToReviewRead> {
  const clientKey = CLIENTS[client].setAsideKey;
  const [staff, cited] = await Promise.all([staffRead(clientKey), citedLinks(client)]);
  const raw = staff ?? (await viewRead(clientKey));
  if (!raw) return { ok: false, message: "The site type list could not be read. Reload to try again." };
  const flagged = reviewRows(raw, { fromStaffRead: staff != null });
  const answers = cited ? answersByDomain(cited, flagged.map((row) => row.domain)) : null;
  return {
    ok: true,
    rows: reviewRows(raw, { fromStaffRead: staff != null, answers }),
    writable: staff != null,
    hasAnswers: answers != null,
  };
}
