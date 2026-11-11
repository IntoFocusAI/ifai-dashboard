import { loadDashboardAsOf } from "@/lib/export/as-of";
import type { SourceRead } from "@/lib/export/types";
import {
  DIVISION_COLUMN_NAMES,
  divisionCellText,
  divisionPopulation,
  divisionRowModels,
} from "@/lib/fender-canvas/division-rows";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import type { CanvasDivisionRow } from "@/lib/fender-canvas/types";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

const DIVISIONS_FAILED = "The catalog division read could not be loaded.";

/**
 * Summary Performance "Catalog divisions" (X-10): the same canvas_divisions read and Buy Box
 * census as the screen, in the screen's default order (most monitored SKUs first). A failed
 * retail read leaves the Buy Box column Not available*, as on screen.
 */
export async function loadDivisionsSource(): Promise<SourceRead> {
  try {
    const [divisions, snapshot, asOf] = await Promise.all([
      getCanvasSupabase().from("canvas_divisions").select("*").order("monitored_skus", { ascending: false }),
      loadPortfolioRetailSnapshot().catch(() => null),
      loadDashboardAsOf(),
    ]);
    if (divisions.error) return { ok: false, message: DIVISIONS_FAILED };
    const rows = divisionRowModels(
      (divisions.data ?? []) as CanvasDivisionRow[],
      snapshot?.divisionCensus ?? null,
    );
    return {
      ok: true,
      source: {
        table: "catalog-divisions",
        header: [
          DIVISION_COLUMN_NAMES.division,
          DIVISION_COLUMN_NAMES.bundles,
          DIVISION_COLUMN_NAMES.buyBox,
          DIVISION_COLUMN_NAMES.next,
        ],
        rows: rows.map((row) => ({
          key: row.division,
          cells: [row.division, divisionCellText(row.bundles), divisionCellText(row.buyBox), row.next.label],
        })),
        filter: null,
        sort: "Most monitored SKUs first.",
        population: divisionPopulation(rows),
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: DIVISIONS_FAILED };
  }
}
