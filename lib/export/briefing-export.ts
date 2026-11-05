import type { AiSearchRead } from "@/lib/ai-search/types";
import { EMPTY_SELECTION_MESSAGE } from "@/lib/ai-search/displayed-read";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import {
  briefingFindingsLead,
  type BriefingFinding,
  type BriefingFindingId,
} from "@/lib/fender-canvas/briefing-retail-lead";
import { approvedExceptionsSentence } from "@/lib/fender-canvas/map-approved-exceptions";
import { LIVE_OFFER_BUNDLES } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { FindabilityRead } from "@/lib/findability/copy";
import { csvDocument, provenanceRows } from "@/lib/export/csv";
import type { BuiltExport, ExportProvenance } from "@/lib/export/types";

export const BRIEFING_EXPORT_HREF = "/dashboard/export/briefing";
export const BRIEFING_EXPORT_FILENAME = "summary-briefing-findings.csv";

export const BRIEFING_SORT =
  "Summary Briefing order: Buy Box withheld, MAP leakage, Splintered bundles, Exact official product pages, Unbranded discovery.";

/**
 * What each ratio is of. The phrases are the ones the briefing pies and tips already use:
 * current Buy Box readings, the MAP comparison set, live-offer bundles, the Findability
 * read, and resolved unbranded discovery answers.
 */
export const BRIEFING_POPULATION: Record<BriefingFindingId, string> = {
  buy_box: "current Buy Box readings",
  map_leakage: "listings with a stored MAP price and at least one stored channel price",
  splintered_bundles: LIVE_OFFER_BUNDLES,
  exact_official_product: "listings in this read",
  unbranded_discovery: "resolved unbranded discovery answers",
};

const RETAIL_FAILED = "The retail read could not be loaded.";
const FINDABILITY_FAILED = "The Findability read could not be loaded.";
const AI_FAILED = "The AI Search read could not be loaded.";
const AI_WINDOW_FAILED = "The last 30 days of Unbranded discovery could not be loaded.";
const AI_NO_RUN = "No published AI Search run is stored.";
const ALL_FAILED = `${RETAIL_FAILED} ${FINDABILITY_FAILED} ${AI_FAILED}`;

function mapExceptionClause(retail: RetailCanvasRead): string | null {
  if (retail.phase !== "ready") return null;
  if (retail.snapshot.mapApprovedExceptionsFailed) return approvedExceptionsSentence(0, true);
  const leftOut = retail.snapshot.mapLeakage.detail?.approvedExceptions ?? 0;
  if (leftOut === 0) return null;
  return approvedExceptionsSentence(leftOut, false);
}

/**
 * Retail findings and exact pages have no row filter unless MAP approved exceptions apply.
 * Unbranded discovery uses the dashboard's default window, the last 30 days.
 */
export function briefingFilter(retail: RetailCanvasRead, unbrandedWindow: string | null = null): string {
  const exception = mapExceptionClause(retail);
  if (!exception && !unbrandedWindow) return "No filter.";
  const open = exception
    ? "No filter on Buy Box withheld, Splintered bundles, or Exact official product pages."
    : "No filter on Buy Box withheld, MAP leakage, Splintered bundles, or Exact official product pages.";
  const window = unbrandedWindow ? ` Unbranded discovery is ${unbrandedWindow}.` : " No filter on Unbranded discovery.";
  return `${open}${window}${exception ? ` ${exception}` : ""}`;
}

export function findingPopulationSentence(finding: BriefingFinding): string {
  if (finding.numerator == null || finding.denominator == null || finding.ratio == null) {
    return `${finding.label}: ${finding.explainer}`;
  }
  if (finding.id === "splintered_bundles") return `${finding.label}: ${finding.ratio}.`;
  return `${finding.label}: ${finding.ratio} ${BRIEFING_POPULATION[finding.id]}.`;
}

export function briefingPopulationSentence(findings: readonly BriefingFinding[]): string {
  return findings.map(findingPopulationSentence).join(" ");
}

function populationCell(finding: BriefingFinding): string {
  if (finding.numerator == null || finding.denominator == null) return finding.explainer;
  return BRIEFING_POPULATION[finding.id];
}

function countCell(value: number | null): string {
  return value == null ? "" : String(value);
}

export function briefingTableRows(findings: readonly BriefingFinding[]): string[][] {
  return findings.map((finding) => [
    finding.label,
    finding.percent,
    countCell(finding.numerator),
    countCell(finding.denominator),
    populationCell(finding),
  ]);
}

function failuresFor(retail: RetailCanvasRead, findability: FindabilityRead, ai: AiSearchRead): string[] {
  const failures: string[] = [];
  if (retail.phase !== "ready") failures.push(RETAIL_FAILED);
  if (findability.phase !== "ready") failures.push(FINDABILITY_FAILED);
  if (ai.phase === "no-run") failures.push(AI_NO_RUN);
  else if (ai.phase === "error" && ai.selection === "failed") failures.push(AI_WINDOW_FAILED);
  else if (ai.phase === "error" && ai.selection === "empty") {
    failures.push(EMPTY_SELECTION_MESSAGE);
  } else if (ai.phase !== "ready") failures.push(AI_FAILED);
  return failures;
}

export function buildBriefingExport(input: {
  retail: RetailCanvasRead;
  findability: FindabilityRead;
  ai: AiSearchRead;
  asOf: string;
  freshnessFailed: boolean;
  /** Dashboard label for the default Unbranded discovery window. Null when that window is not in this file. */
  unbrandedWindow?: string | null;
}): BuiltExport {
  const anyReady =
    input.retail.phase === "ready" || input.findability.phase === "ready" || input.ai.phase === "ready";
  const failures = failuresFor(input.retail, input.findability, input.ai);
  if (input.freshnessFailed) failures.push("The freshness read could not be loaded.");

  if (!anyReady) {
    return {
      model: { ok: false, message: failures.length > 0 ? failures.join(" ") : ALL_FAILED },
      csv: null,
    };
  }

  const lead = briefingFindingsLead(input.retail, input.findability, input.ai);
  const provenance: ExportProvenance = {
    filter: briefingFilter(input.retail, input.unbrandedWindow ?? null),
    sort: BRIEFING_SORT,
    asOf: input.asOf || READ_NOT_AVAILABLE,
    population: briefingPopulationSentence(lead.findings),
  };
  const csv = csvDocument([
    ...provenanceRows(provenance),
    ["Finding", "Percent", "Numerator", "Denominator", "Population"],
    ...briefingTableRows(lead.findings),
  ]);
  return {
    model: { ok: true, href: BRIEFING_EXPORT_HREF, provenance, failures },
    csv,
  };
}
