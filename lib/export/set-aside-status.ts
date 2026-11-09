import type { StatusCells } from "@/lib/export/shown";
import { activeSetAsideClientKey } from "@/lib/set-aside/keys";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

type ActiveSetAside = {
  entity_key: string;
  outcome: string;
  reason_label: string | null;
};

/** The chip each row shows in its Status column. Rows with no Done or set-aside stay blank. */
export async function loadSetAsideStatus(checkKey: string): Promise<StatusCells> {
  try {
    const { data, error } = await getPublicCanvasSupabase()
      .from("canvas_issue_set_asides")
      .select("entity_key,outcome,reason_label")
      .eq("client_key", activeSetAsideClientKey())
      .eq("check_key", checkKey)
      .eq("status", "active");
    if (error) return "failed";
    const cells = new Map<string, string>();
    for (const row of (data ?? []) as ActiveSetAside[]) {
      const label =
        row.outcome === "done" ? "Done" : row.reason_label ? `Set aside · ${row.reason_label}` : "Set aside";
      cells.set(row.entity_key, label);
    }
    return cells;
  } catch {
    return "failed";
  }
}
