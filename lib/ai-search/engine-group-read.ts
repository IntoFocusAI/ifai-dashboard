import {
  filterSnapshotByEngineGroup,
  hasApiRows,
  withApiSnapshots,
  type EngineGroupChoice,
} from "@/lib/ai-search/engine-group";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";

/** The API-engine runs the selection holds, as the switch sees them. */
export type ApiEngineLoad =
  | { phase: "loading" }
  /** The API-engine views are not in the database yet. */
  | { phase: "missing" }
  | { phase: "error"; message: string }
  | { phase: "ready"; snapshots: AiSearchSnapshot[] };

export type EngineSwitchState =
  | { kind: "loading" }
  | { kind: "ready"; choice: EngineGroupChoice }
  /** Not available*: the tooltip says why, the buttons stay off, and the figures are the search engines'. */
  | { kind: "unavailable"; reason: "missing" | "failed" | "none"; message?: string };

export const API_NOT_AVAILABLE_TIPS: Record<"missing" | "failed" | "none", string> = {
  missing: "API-engine results are not published to the dashboard yet. Every figure covers the search engines.",
  failed: "The API-engine results did not load. Every figure covers the search engines.",
  none: "No API-engine run is dated in this selection. Every figure covers the search engines.",
};

export function engineSwitchState(load: ApiEngineLoad, choice: EngineGroupChoice): EngineSwitchState {
  if (load.phase === "loading") return { kind: "loading" };
  if (load.phase === "missing") return { kind: "unavailable", reason: "missing" };
  if (load.phase === "error") return { kind: "unavailable", reason: "failed", message: load.message };
  if (!load.snapshots.some(hasApiRows)) return { kind: "unavailable", reason: "none" };
  return { kind: "ready", choice };
}

export const API_ONLY_EMPTY = "No API-engine call in this selection.";
export const SEARCH_ONLY_EMPTY = "No search-engine call in this selection.";

/**
 * What the AI Search panels show for the switch. Until the API runs are known, All and API only
 * wait instead of showing the search engines as if they were everything.
 */
export function engineGroupRead(
  displayed: AiSearchRead,
  load: ApiEngineLoad,
  choice: EngineGroupChoice,
): AiSearchRead {
  if (displayed.phase !== "ready") return displayed;
  const state = engineSwitchState(load, choice);
  if (state.kind === "loading") return choice === "search" ? narrow(displayed, displayed.snapshot, "search") : { phase: "loading" };
  if (state.kind === "unavailable") return displayed;
  if (load.phase !== "ready") return displayed;
  return narrow(displayed, withApiSnapshots(displayed.snapshot, load.snapshots), choice);
}

function narrow(
  displayed: Extract<AiSearchRead, { phase: "ready" }>,
  snapshot: AiSearchSnapshot,
  choice: EngineGroupChoice,
): AiSearchRead {
  const filtered = filterSnapshotByEngineGroup(snapshot, choice);
  if (!filtered) {
    return { phase: "error", message: choice === "api" ? API_ONLY_EMPTY : SEARCH_ONLY_EMPTY, selection: "empty" };
  }
  return displayed.stale ? { phase: "ready", snapshot: filtered, stale: true } : { phase: "ready", snapshot: filtered };
}
