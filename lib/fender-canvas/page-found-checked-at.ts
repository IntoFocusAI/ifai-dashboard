/**
 * When the fender.com product check last ran: the spec_readiness job's last run in
 * canvas_freshness. The job writes that time on every row it checks, found or not, so
 * it is the newest check behind the page-found share.
 */

import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export const SPEC_CHECK_JOB = "spec_readiness";

type FreshnessRead = PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type SpecCheckClient = {
  from: (view: string) => {
    select: (columns: string) => {
      eq: (column: "job_key", value: string) => FreshnessRead;
    };
  };
};

/** The job's last run time, or null when none is recorded. Throws on a failed read. */
export async function loadSpecCheckRunAt(client?: SpecCheckClient): Promise<string | null> {
  const supabase = client ?? (getCanvasSupabase() as unknown as SpecCheckClient);
  const { data, error } = await supabase
    .from("canvas_freshness")
    .select("job_key,last_run_at")
    .eq("job_key", SPEC_CHECK_JOB);
  if (error) throw new Error(`canvas_freshness: ${error.message}`);
  const rows = (data ?? []) as Array<{ job_key: string; last_run_at: string | null }>;
  const at = rows.find((row) => row.job_key === SPEC_CHECK_JOB)?.last_run_at?.trim();
  return at && Number.isFinite(Date.parse(at)) ? at : null;
}
