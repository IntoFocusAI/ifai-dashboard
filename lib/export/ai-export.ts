import type { HistoryReadClient } from "@/lib/ai-search/history-queries";
import type { AiReadClient } from "@/lib/ai-search/queries";
import { parseAiSelectionScope, selectionFilterLabel } from "@/lib/ai-search/selection";
import { loadAiSelection, type AiSelection } from "@/lib/ai-search/selection-load";
import {
  catalogCoverageTable,
  citationCategoryTable,
  citationEngineTable,
  citationEvidenceTable,
  factCheckTable,
  parseCitationParams,
  parseExplorerFilter,
  runCategoryTable,
  runEngineTable,
  simulationTable,
  trendPointTable,
  trendTable,
  type AiTableBuild,
  type TrendTableParams,
} from "@/lib/ai-search/tables";
import { windowBounds } from "@/lib/ai-search/history-mode";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import type { SourceRead } from "@/lib/export/types";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatInt } from "@/lib/fender-canvas/format";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** AI Search tables whose download reads the selection the date pill and engine switch name. */
export const AI_EXPORT_TABLE_IDS = [
  "ai-run-engines",
  "ai-run-categories",
  "ai-simulations",
  "product-fact-checks",
  "catalog-coverage",
  "ai-history-trend",
  "ai-trend-point",
  "citation-engines",
  "citation-categories",
  "citation-evidence",
] as const;

export type AiExportTableId = (typeof AI_EXPORT_TABLE_IDS)[number];

const NO_SCOPE = "This download needs the AI Search selection on screen. Reload the tab and try again.";
const NO_ROWS = "This selection has no rows for this table.";

/** Tables that read cited links. The others skip those rows on the server. */
const NEEDS_CITATIONS: ReadonlySet<AiExportTableId> = new Set([
  "ai-simulations",
  "citation-engines",
  "citation-categories",
  "citation-evidence",
]);

const CITATION_TABLES: ReadonlySet<AiExportTableId> = new Set(["citation-engines", "citation-categories", "citation-evidence"]);

function parseTrendParams(value: unknown): TrendTableParams {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const metric = input.metric === "branded_consideration" ? "branded_consideration" : "unbranded_discovery";
  const breakdown = input.breakdown === "engine" ? "engine" : "overall";
  const raw = input.query && typeof input.query === "object" ? (input.query as Record<string, unknown>) : {};
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).slice(0, 600) : "");
  const query: TrendTableParams["query"] =
    raw.kind === "lineage" && text("promptKey")
      ? { kind: "lineage", promptKey: text("promptKey") }
      : raw.kind === "version" && text("versionKey")
        ? { kind: "version", versionKey: text("versionKey"), promptKey: text("promptKey"), promptText: text("promptText") }
        : { kind: "all" };
  return { metric, breakdown, query };
}

function build(table: AiExportTableId, selection: AiSelection, scope: Record<string, unknown>): AiTableBuild | null {
  const single = selection.scope.mode.kind === "run";
  if (table === "ai-history-trend") {
    return trendTable(
      selection.trend,
      parseTrendParams(scope.trend),
      windowBounds(selection.scope.mode, selection.scope.windowEnd),
      selection.apiDays,
    );
  }
  if (table === "ai-trend-point") {
    const pick = scope.point && typeof scope.point === "object" ? (scope.point as Record<string, unknown>) : {};
    if (typeof pick.runId !== "string" || typeof pick.seriesKey !== "string") return null;
    return trendPointTable(
      selection.trend,
      parseTrendParams(scope.trend),
      windowBounds(selection.scope.mode, selection.scope.windowEnd),
      { runId: pick.runId, seriesKey: pick.seriesKey },
    );
  }
  if (CITATION_TABLES.has(table)) {
    const snapshot = selection.citationSnapshot;
    if (!snapshot) return null;
    const params = parseCitationParams(scope.citations);
    if (table === "citation-engines") return citationEngineTable(snapshot, params);
    if (table === "citation-categories") return citationCategoryTable(snapshot, params);
    return citationEvidenceTable(snapshot, params);
  }
  if (selection.read.phase !== "ready") return null;
  const snapshot: AiSearchSnapshot = selection.read.snapshot;
  if (table === "ai-run-engines") return runEngineTable(snapshot, single);
  if (table === "ai-run-categories") return runCategoryTable(snapshot, single);
  if (table === "ai-simulations") return simulationTable(snapshot, parseExplorerFilter(scope.filter));
  if (table === "product-fact-checks") return factCheckTable(snapshot);
  return catalogCoverageTable(snapshot, !single);
}

/** "9,455 calls from 7 runs in this selection." */
function population(selection: AiSelection): string {
  const calls = selection.read.phase === "ready" ? selection.read.snapshot.calls.length : 0;
  const runs = `${formatInt(selection.runCount)} ${selection.runCount === 1 ? "run" : "runs"}`;
  return `${formatInt(calls)} ${calls === 1 ? "call" : "calls"} from ${runs} in this selection`;
}

/** "Last 30 days · Oct 10 to Nov 8, 2026. Engines: All. Shopping prompts." */
function filterLine(selection: AiSelection, tableFilter: string | null): string {
  const label = selectionFilterLabel({
    pillLabel: selection.pillLabel,
    engines: selection.scope.engines,
    enginesReady: selection.enginesReady,
  });
  return tableFilter ? `${label}. ${tableFilter}` : label;
}

/**
 * One AI Search table, read again on the server for the selection the screen showed: the same
 * runs, the same engine switch, and the same row and cell functions the table draws with.
 */
export async function loadAiTableSource(table: AiExportTableId, scope: Record<string, unknown> | null): Promise<SourceRead> {
  const selectionScope = parseAiSelectionScope(scope?.ai);
  if (!scope || !selectionScope) return { ok: false, message: NO_SCOPE };
  try {
    const client = getCanvasSupabase() as unknown as HistoryReadClient & AiReadClient;
    const loaded = await loadAiSelection(client, selectionScope, { citations: NEEDS_CITATIONS.has(table) });
    if (!loaded.ok) return { ok: false, message: loaded.message };
    const built = build(table, loaded.selection, scope);
    if (!built) return { ok: false, message: NO_ROWS };
    return {
      ok: true,
      source: {
        table,
        header: built.header,
        rows: built.rows,
        filter: filterLine(loaded.selection, built.filter),
        sort: built.sort,
        population: population(loaded.selection),
        asOf: formatCheckedAt(loaded.selection.newestRunAt) ?? READ_NOT_AVAILABLE,
      },
    };
  } catch {
    return { ok: false, message: "The runs in this selection could not be read." };
  }
}
