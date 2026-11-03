import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { AiProbeCoverageRow, AiProbeRow, AiSearchSnapshot, ProbeRotation } from "@/lib/ai-search/types";

/** Collector v15 columns on canvas_ai_probes and canvas_ai_history_probes. NULL until the rotation is on. */
export const PROBE_CATALOG_COLUMNS =
  "probe_asin,probe_asins,probe_fender_sku,probe_category,probe_series,probe_spec_field,probe_expected_value,probe_source_url,probe_amazon_value,probe_is_anchor";

export const PROBE_COVERAGE_VIEW = "canvas_ai_probe_coverage";

export const PROBE_COVERAGE_COLUMNS =
  "audit_run_id,cycle_no,category,engine,models_in_scope,models_checked,asins_covered,wrong_answers";

/** The collector named the catalog product it asked about. Rows without it keep today's counting. */
export function isCatalogProbe(row: Pick<AiProbeRow, "probe_asin">): boolean {
  return Boolean(row.probe_asin?.trim());
}

function sameValue(a: string, b: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

/** Amazon lists a different value for the spec than the fender.com page the check used. */
export function amazonDiffers(row: Pick<AiProbeRow, "probe_expected_value" | "probe_amazon_value">): boolean {
  const expected = row.probe_expected_value?.trim();
  const amazon = row.probe_amazon_value?.trim();
  return Boolean(expected && amazon && !sameValue(expected, amazon));
}

/** "scale_length" reads "Scale length". */
export function specFieldLabel(field: string | null | undefined): string | null {
  const words = field?.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The fact a catalog check compares against: the spec and its fender.com value. */
export function catalogClaim(row: Pick<AiProbeRow, "probe_spec_field" | "probe_expected_value">): string | null {
  const value = row.probe_expected_value?.trim();
  if (!value) return null;
  const field = specFieldLabel(row.probe_spec_field);
  return field ? `${field}: ${value}` : value;
}

export type CatalogCoverageCell = { checked: number; inScope: number };

export type CatalogCoverage =
  | { phase: "unavailable" }
  | {
      phase: "ready";
      /** "run" reads the coverage view as stored; "selection" counts products by ASIN across the runs. */
      basis: "run" | "selection";
      engines: string[];
      rows: Array<{ category: string; cells: Record<string, CatalogCoverageCell> }>;
    };

const CHECKED = new Set(["confirmed", "none"]);

function cellKey(category: string, engine: string): string {
  return `${category}\u0000${engine}`;
}

/**
 * "N of M catalog products checked" by category and engine. Null while no fact check names a
 * catalog product, so runs before the rotation show nothing here.
 * One run reads models_checked of models_in_scope from canvas_ai_probe_coverage. A selection of
 * runs counts distinct ASINs checked across them, against the newest run's models_in_scope.
 */
export function catalogCoverage(snapshot: AiSearchSnapshot, windowed: boolean): CatalogCoverage | null {
  const catalog = snapshot.probes.filter(isCatalogProbe);
  if (catalog.length === 0) return null;
  const coverage = snapshot.probeCoverage;
  if (!coverage) return { phase: "unavailable" };

  const cells = new Map<string, CatalogCoverageCell & { category: string; engine: string }>();
  for (const row of coverage) {
    const category = row.category?.trim() || "";
    const engine = (row.engine ?? "").toLowerCase();
    if (!category || !engine || row.models_in_scope == null) continue;
    const checked = windowed ? 0 : (row.models_checked ?? 0);
    cells.set(cellKey(category, engine), { category, engine, checked, inScope: row.models_in_scope });
  }
  if (windowed) {
    const asins = new Map<string, Set<string>>();
    for (const probe of catalog) {
      if (probe.call_status === "error" || !CHECKED.has(String(probe.material_hallucination))) continue;
      const key = cellKey(probe.probe_category?.trim() || "", (probe.engine ?? "").toLowerCase());
      const seen = asins.get(key) ?? new Set<string>();
      seen.add(probe.probe_asin!.trim());
      asins.set(key, seen);
    }
    for (const [key, cell] of cells) cell.checked = asins.get(key)?.size ?? 0;
  }

  const engines = [...new Set([...cells.values()].map((cell) => cell.engine))].sort((a, b) =>
    engineLabel(a).localeCompare(engineLabel(b)),
  );
  const categories = [...new Set([...cells.values()].map((cell) => cell.category))].sort();
  return {
    phase: "ready",
    basis: windowed ? "selection" : "run",
    engines,
    rows: categories.map((category) => {
      const byEngine: Record<string, CatalogCoverageCell> = {};
      for (const engine of engines) {
        const cell = cells.get(cellKey(category, engine));
        if (cell) byEngine[engine] = { checked: cell.checked, inScope: cell.inScope };
      }
      return { category, cells: byEngine };
    }),
  };
}

/** Coverage rows for a pooled selection, in the order the runs were pooled. */
export function poolProbeCoverage(snapshots: readonly AiSearchSnapshot[]): AiProbeCoverageRow[] | null | undefined {
  if (snapshots.every((snapshot) => snapshot.probeCoverage === undefined)) return undefined;
  if (snapshots.some((snapshot) => snapshot.probeCoverage === null)) return null;
  return snapshots.flatMap((snapshot) => snapshot.probeCoverage ?? []);
}

export type RotationSummary = { label: string; tip: string };

/** The run's rotation rule and cycle, when the collector recorded them. */
export function rotationSummary(rotation: ProbeRotation | null | undefined): RotationSummary | null {
  const rule = rotation?.rule?.trim() || null;
  const cycle = rotation?.cycle == null ? null : String(rotation.cycle).trim() || null;
  if (!rule && !cycle) return null;
  const picked = rule
    ? `IntoFocus picked these products by its catalog rotation rule: ${rule}.`
    : "IntoFocus picked these products by its catalog rotation.";
  return {
    label: cycle ? `Catalog rotation, cycle ${cycle}` : "Catalog rotation",
    tip: cycle ? `${picked} This run is cycle ${cycle}.` : picked,
  };
}
