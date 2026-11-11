import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import type { AiProbeCoverageRow, AiProbeRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { isFenderClient } from "@/lib/brand-copy";

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
      /** "run" counts one run's models; "selection" counts distinct models across the runs. */
      basis: "run" | "selection";
      /** models_in_scope of the newest run in the selection. */
      inScope: number;
      engines: string[];
      rows: Array<{ category: string; cells: Record<string, CatalogCoverageCell> }>;
    };

function cellKey(category: string, engine: string): string {
  return `${category}\u0000${engine}`;
}

/** canvas_ai_probe_coverage counts a model by its fender.com spec page, then its SKU. */
export function catalogModelKey(
  row: Pick<AiProbeRow, "probe_source_url" | "probe_fender_sku" | "probe_asin">,
): string {
  return row.probe_source_url?.trim() || row.probe_fender_sku?.trim() || row.probe_asin?.trim() || "";
}

/** models_in_scope of the newest catalog run that has a coverage row, by its latest fact check. */
function newestInScope(catalog: readonly AiProbeRow[], coverage: readonly AiProbeCoverageRow[]): number | null {
  const latest = new Map<string, string>();
  for (const row of catalog) {
    const at = row.created_at ?? "";
    if (!latest.has(row.audit_run_id) || at > latest.get(row.audit_run_id)!) latest.set(row.audit_run_id, at);
  }
  const scope = new Map<string, number>();
  for (const row of coverage) {
    if (row.models_in_scope != null && latest.has(row.audit_run_id)) scope.set(row.audit_run_id, row.models_in_scope);
  }
  const newest = [...scope.keys()].sort((a, b) => latest.get(b)!.localeCompare(latest.get(a)!))[0];
  return newest === undefined ? null : scope.get(newest)!;
}

/**
 * "N of M catalog models checked" by category and engine. Null while no fact check names a
 * catalog product, so runs before the rotation show nothing here. Only rows with probe_asin
 * count; fixed questions stay in the fact-check table as before.
 * Models count the way canvas_ai_probe_coverage counts them, by spec page and then SKU, as
 * distinct models across every run in the selection. M is the newest run's models_in_scope.
 */
export function catalogCoverage(snapshot: AiSearchSnapshot, windowed: boolean): CatalogCoverage | null {
  const catalog = snapshot.probes.filter(isCatalogProbe);
  if (catalog.length === 0) return null;
  const coverage = snapshot.probeCoverage;
  const inScope = coverage ? newestInScope(catalog, coverage) : null;
  if (inScope == null) return { phase: "unavailable" };

  const models = new Map<string, Set<string>>();
  for (const probe of catalog) {
    const key = cellKey(categoryLabel(probe.probe_category), (probe.engine ?? "").toLowerCase());
    const seen = models.get(key) ?? new Set<string>();
    seen.add(catalogModelKey(probe));
    models.set(key, seen);
  }
  const engines = [...new Set(catalog.map((probe) => (probe.engine ?? "").toLowerCase()))].sort((a, b) =>
    engineLabel(a).localeCompare(engineLabel(b)),
  );
  const categories = [...new Set(catalog.map((probe) => categoryLabel(probe.probe_category)))].sort();
  return {
    phase: "ready",
    basis: windowed ? "selection" : "run",
    inScope,
    engines,
    rows: categories.map((category) => {
      const cells: Record<string, CatalogCoverageCell> = {};
      for (const engine of engines) {
        cells[engine] = { checked: models.get(cellKey(category, engine))?.size ?? 0, inScope };
      }
      return { category, cells };
    }),
  };
}

export type CatalogProductsLead =
  | {
      phase: "unavailable";
      /** Engines that ask the rotating catalog questions in this selection, as stored values. */
      askingEngines: string[];
    }
  | {
      phase: "ready";
      /** Distinct catalog products the engines on screen were asked about. */
      checked: number;
      /** Of those, the products with at least one answer compared with the product's own spec value. */
      compared: number;
      /** models_in_scope of the newest run in the selection. */
      inScope: number;
      askingEngines: string[];
      /** The asking engines that are in the figures on screen. */
      shownEngines: string[];
    };

function probeEngines(rows: readonly AiProbeRow[]): string[] {
  return [...new Set(rows.map((row) => (row.engine ?? "").toLowerCase()).filter(Boolean))].sort((a, b) =>
    engineLabel(a).localeCompare(engineLabel(b)),
  );
}

/**
 * "N of M catalog products checked": the lead of Product Fact Checks on every engine choice.
 * N counts distinct catalog products the engines on screen were asked about, the way
 * canvas_ai_probe_coverage counts a model. M is the newest run's models_in_scope. M and the
 * engines that ask the rotating questions read the selection before the engine switch, so a
 * choice with none of those engines reads 0 of M instead of losing the line.
 * Null before the rotation: no fact check in the selection names a catalog product.
 */
export function catalogProductsLead(snapshot: AiSearchSnapshot): CatalogProductsLead | null {
  const before = (snapshot.engineScope?.probesBefore ?? snapshot.probes).filter(isCatalogProbe);
  if (before.length === 0) return null;
  const askingEngines = probeEngines(before);
  const inScope = snapshot.probeCoverage ? newestInScope(before, snapshot.probeCoverage) : null;
  if (inScope == null) return { phase: "unavailable", askingEngines };
  const shown = snapshot.probes.filter(isCatalogProbe);
  const compared = shown.filter(
    (row) =>
      row.call_status !== "error" &&
      (row.material_hallucination === "none" ||
        (row.material_hallucination === "confirmed" && Boolean(row.hallucination_evidence?.trim()))),
  );
  return {
    phase: "ready",
    checked: new Set(shown.map(catalogModelKey)).size,
    compared: new Set(compared.map(catalogModelKey)).size,
    inScope,
    askingEngines,
    shownEngines: probeEngines(shown),
  };
}

/** Coverage rows for a pooled selection, in the order the runs were pooled. */
export function poolProbeCoverage(snapshots: readonly AiSearchSnapshot[]): AiProbeCoverageRow[] | null | undefined {
  if (snapshots.every((snapshot) => snapshot.probeCoverage === undefined)) return undefined;
  if (snapshots.some((snapshot) => snapshot.probeCoverage === null)) return null;
  return snapshots.flatMap((snapshot) => snapshot.probeCoverage ?? []);
}

/** The approved rotation plan. No stored field carries the rule, so it is fixed here. */
export const CATALOG_ROTATION_RULE =
  "about 90 catalog models per run, each asked once per engine, all 180 in-scope guitar and bass models every 2 runs, plus anchors p17 and p33";

/** Rotation cycles (cycle_no) recorded for the runs whose fact checks name a catalog product, lowest first. */
export function catalogCycles(snapshot: AiSearchSnapshot): number[] {
  const runs = new Set(snapshot.probes.filter(isCatalogProbe).map((row) => row.audit_run_id));
  const cycles = new Set<number>();
  for (const row of snapshot.probeCoverage ?? []) {
    const cycle = row.cycle_no == null ? NaN : Number(row.cycle_no);
    if (runs.has(row.audit_run_id) && Number.isFinite(cycle)) cycles.add(cycle);
  }
  return [...cycles].sort((a, b) => a - b);
}

export type RotationSummary = { label: string; tip: string };

/** "Catalog rotation, cycle 3" and the rule. Only called once a fact check names a catalog product. */
export function rotationSummary(cycles: readonly number[], windowed = false): RotationSummary {
  // The stored rule is Fender's rotation plan. Other clients name the rule without its Fender counts.
  const picked = isFenderClient()
    ? `IntoFocus picked these products by its catalog rotation rule: ${CATALOG_ROTATION_RULE}.`
    : "IntoFocus picked these products by its catalog rotation rule.";
  if (cycles.length === 0) return { label: "Catalog rotation", tip: picked };
  const span = cycles.length === 1 ? `cycle ${cycles[0]}` : `cycles ${cycles[0]} to ${cycles[cycles.length - 1]}`;
  return {
    label: `Catalog rotation, ${span}`,
    tip: `${picked} ${windowed ? `This selection covers ${span}` : `This run is ${span}`}.`,
  };
}
