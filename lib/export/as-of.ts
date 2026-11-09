import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export type AsOfRead = {
  asOf: string;
  failed: boolean;
};

/**
 * Newest `last_run_at` on canvas_freshness, the same read the dashboard's
 * "Data as of" line uses. A failed read stays Not available*.
 */
export async function loadDashboardAsOf(): Promise<AsOfRead> {
  try {
    const { data, error } = await getCanvasSupabase().from("canvas_freshness").select("*");
    if (error) return { asOf: READ_NOT_AVAILABLE, failed: true };
    let newest: { at: number; iso: string } | null = null;
    for (const row of (data ?? []) as CanvasFreshnessRow[]) {
      if (!row.last_run_at) continue;
      const at = new Date(row.last_run_at).getTime();
      if (!Number.isFinite(at)) continue;
      if (!newest || at > newest.at) newest = { at, iso: row.last_run_at };
    }
    if (!newest) return { asOf: READ_NOT_AVAILABLE, failed: false };
    return { asOf: formatCheckedAt(newest.iso) ?? READ_NOT_AVAILABLE, failed: false };
  } catch {
    return { asOf: READ_NOT_AVAILABLE, failed: true };
  }
}
