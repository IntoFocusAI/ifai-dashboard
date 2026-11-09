import type { FactCheckCoverage } from "@/lib/ai-search/drift";
import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { joinBrands } from "@/lib/ai-search/competitors";
import { formatInt } from "@/lib/fender-canvas/format";
import type { CatalogProductsLead, RotationSummary } from "@/lib/ai-search/probe-catalog";
import { engineLabel } from "@/lib/ai-search/run-metrics";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import { pct } from "@/lib/ai-search/summary";
import { brandName, brandSite } from "@/lib/brand-copy";

const FACT = (n: number) => `${n} ${brandName()} product fact${n === 1 ? "" : "s"}`;
const ANSWER = (n: number) => `${n} answer${n === 1 ? "" : "s"}`;
const CALL = (n: number) => `${n} fact-check call${n === 1 ? "" : "s"}`;

/** "1 contradiction", "2 contradictions". */
export function contradictionCount(n: number): string {
  return `${n} contradiction${n === 1 ? "" : "s"}`;
}

/** Same bands as the Fact Checks satellite: red below 95, green above 98, yellow on the closed interval. */
export type FactCheckAccuracyTone = "danger" | "warning" | "success";

/**
 * Product Fact Checks lead figure. Same rate as the Fact Checks satellite:
 * (answersChecked - contradictions) / answersChecked via pct(). Empty when nothing was checked.
 */
export function factCheckAccuracyLead(c: FactCheckCoverage): {
  rate: string | null;
  matched: number;
  checked: number;
  contradictions: number;
  population: string | null;
  tone: FactCheckAccuracyTone | null;
  ratePct: number | null;
} {
  if (c.answersChecked === 0) {
    return {
      rate: null,
      matched: 0,
      checked: 0,
      contradictions: 0,
      population: null,
      tone: null,
      ratePct: null,
    };
  }
  const matched = c.answersChecked - c.contradictions;
  const ratePct = (100 * matched) / c.answersChecked;
  const tone: FactCheckAccuracyTone =
    ratePct < 95 ? "danger" : ratePct > 98 ? "success" : "warning";
  return {
    rate: pct(matched, c.answersChecked),
    matched,
    checked: c.answersChecked,
    contradictions: c.contradictions,
    population: `${matched} of ${c.answersChecked} answers matched.`,
    tone,
    ratePct,
  };
}

const ACCURACY_TONE_STATUS: Record<FactCheckAccuracyTone, DataStatus> = {
  danger: "bad",
  warning: "okay",
  success: "good",
};

/** The Accuracy figure's status: color, mark, and word travel together (StatusMark). */
export function factCheckAccuracyStatus(tone: FactCheckAccuracyTone | null): DataStatus | null {
  return tone ? ACCURACY_TONE_STATUS[tone] : null;
}

/** Pie for the Accuracy lead. Zero slices are omitted so a perfect rate is one full disc. */
export function factCheckAccuracyPie(c: FactCheckCoverage): PieDiscData | null {
  if (c.answersChecked === 0) return null;
  const matched = c.answersChecked - c.contradictions;
  const slices = [
    { key: "matched", label: "Matched the verified fact", count: matched, tone: "measured" as const },
    { key: "contradicted", label: "Contradicted the verified fact", count: c.contradictions, tone: "rest" as const },
  ].filter((slice) => slice.count > 0);
  return {
    id: "accuracy",
    title: "Accuracy",
    total: c.answersChecked,
    totalLabel: "answers checked",
    slices,
  };
}

export function factCheckAccuracyPieTip(c: FactCheckCoverage, askingEngines: readonly string[] = []): string {
  const matched = Math.max(0, c.answersChecked - c.contradictions);
  const engines = factCheckEnginesTip(c, askingEngines);
  return [`${ANSWER(matched)} matched the verified fact. ${ANSWER(c.contradictions)} contradicted it.`, engines]
    .filter(Boolean)
    .join(" ");
}

/** The business result, first: what was checked, on which engines, and what came back. */
export function factCheckHeadline(c: FactCheckCoverage, windowed = false): string {
  const unit = windowed ? "selection" : "run";
  if (c.answersChecked === 0) {
    return c.questionsSent === 0
      ? `This ${unit} sent no product fact checks.`
      : `No product fact check completed in this ${unit}, so there is no accuracy result to report on ${FACT(c.questionsWithFact)}.`;
  }
  const scope = `${FACT(c.factsChecked)} ${c.factsChecked === 1 ? "was" : "were"} checked across ${joinBrands(c.checkedEngines)}.`;
  const result =
    c.contradictions === 0
      ? `No contradictions were found in ${ANSWER(c.answersChecked)}.`
      : `${c.contradictions} of ${c.answersChecked} answers contradicted the verified fact.`;
  return `${scope} ${result}`;
}

export const CATALOG_PRODUCTS_TITLE = "Catalog products checked";

/** "180 of 181", the figure the tab leads with. */
export function catalogProductsFigure(lead: Extract<CatalogProductsLead, { phase: "ready" }>): string {
  return `${formatInt(lead.checked)} of ${formatInt(lead.inScope)}`;
}

/** The words after the figure. */
export const CATALOG_PRODUCTS_UNIT = "catalog products checked";

/** "Only ChatGPT, Gemini, and Perplexity ask the rotating catalog questions." */
export function rotatingEnginesSentence(askingEngines: readonly string[]): string {
  const names = joinBrands(askingEngines.map((engine) => engineLabel(engine)));
  return `Only ${names} ask the rotating catalog questions.`;
}

/**
 * Tooltip on "N of M catalog products checked": which engines the figure covers, how a
 * product is counted, what M is, and how the products were picked.
 */
export function catalogProductsTip(
  lead: Extract<CatalogProductsLead, { phase: "ready" }>,
  rotation: RotationSummary,
  windowed = false,
): string {
  const covers = lead.shownEngines.length
    ? `This figure covers ${joinBrands(lead.shownEngines.map((engine) => engineLabel(engine)))}.`
    : `No engine in this engine choice asks the rotating catalog questions, so this figure reads 0.`;
  const counted = `A product counts once an engine was asked about it, counted by ${brandSite()} spec page, then SKU.`;
  const compared =
    lead.checked > 0
      ? `${formatInt(lead.compared)} of the ${formatInt(lead.checked)} had at least one answer compared with the product's own ${brandSite()} spec value.`
      : "";
  const scope = `${formatInt(lead.inScope)} catalog products are in scope in ${windowed ? "the newest run of this selection" : "this run"}.`;
  return [covers, rotatingEnginesSentence(lead.askingEngines), counted, compared, scope, rotation.tip]
    .filter(Boolean)
    .join(" ");
}

/** Tooltip when the catalog coverage read failed, so M is unknown. */
export function catalogProductsUnavailableTip(askingEngines: readonly string[]): string {
  return `The catalog coverage view did not load for this selection, so the number of catalog products in scope is unknown. ${rotatingEnginesSentence(askingEngines)}`;
}

/** Pie beside the lead: products checked against the rest of the catalog in scope. */
export function catalogProductsPie(lead: Extract<CatalogProductsLead, { phase: "ready" }>): PieDiscData | null {
  if (lead.inScope <= 0 || lead.checked > lead.inScope) return null;
  const slices = [
    { key: "checked", label: "Checked", count: lead.checked, tone: "measured" as const },
    { key: "unchecked", label: "Not checked yet", count: lead.inScope - lead.checked, tone: "rest" as const },
  ].filter((slice) => slice.count > 0);
  return { id: "catalog-products", title: CATALOG_PRODUCTS_TITLE, total: lead.inScope, totalLabel: "catalog products in scope", slices };
}

/** Under the lead: the rotation cycles, then the fixed questions asked beside them. */
export function catalogProductsSubline(c: FactCheckCoverage, rotation: RotationSummary): string {
  const fixed = c.questionsSent - c.catalogProducts;
  const parts = [rotation.label];
  if (fixed > 0) parts.push(`${formatInt(fixed)} fixed ${fixed === 1 ? "question" : "questions"}`);
  return parts.join(" · ");
}

/**
 * Which engines the Accuracy figure covers. With the rotation on, only the asking engines
 * answer catalog questions; any other engine in the figure answers the fixed questions.
 */
export function factCheckEnginesTip(c: FactCheckCoverage, askingEngines: readonly string[] = []): string {
  if (c.checkedEngines.length === 0) return "";
  const covers = `This figure covers ${joinBrands(c.checkedEngines)}.`;
  if (askingEngines.length === 0) return covers;
  const asking = new Set(askingEngines.map((engine) => engineLabel(engine)));
  const fixedOnly = c.checkedEngines.filter((engine) => !asking.has(engine));
  const rest = fixedOnly.length
    ? ` ${joinBrands(fixedOnly)} ${fixedOnly.length === 1 ? "answers" : "answer"} the fixed questions.`
    : "";
  return `${covers} ${rotatingEnginesSentence(askingEngines)}${rest}`;
}

export const FACT_CHECK_METHOD_TITLE = "How these products were chosen";

export type FactCheckMethodLine = {
  products: string;
  verified: string;
  /** How the products were picked, or that the pick is not recorded. */
  tip: string;
};

/**
 * "5 products checked · 4 with a verified fact", for a selection from before the catalog
 * rotation. Each fact-check question names one Fender product, so questions count as products.
 * No stored field records how those products were picked or what part of the catalog they
 * stand for, so the tooltip says so instead of calling them a sample.
 * Once a check names its catalog product, the tab leads with catalogProductsLead instead.
 */
export function factCheckMethodLine(c: FactCheckCoverage, windowed = false): FactCheckMethodLine | null {
  if (c.questionsSent === 0) return null;
  const unit = windowed ? "selection" : "run";
  const n = c.questionsSent;
  const one = n === 1;
  const named = `Each fact-check question names one ${brandName()} product, and the question set names ${n}. IntoFocus sends ${one ? "it" : "them"} to every engine on purpose.`;
  const compared = `${c.factsChecked} of ${n} ${c.factsChecked === 1 ? "was" : "were"} compared with a fact verified on an official ${brandName()} page in this ${unit}.`;
  const picked = one
    ? `How this product was picked, and what part of ${brandName()}'s catalog it stands for, is not recorded, so this result covers this product only.`
    : `How these products were picked, and what part of ${brandName()}'s catalog they stand for, is not recorded, so this result covers these ${n} products only.`;
  return {
    products: `${n} product${one ? "" : "s"} checked`,
    verified: `${c.factsChecked} with a verified fact`,
    tip: `${named} ${compared} ${picked}`,
  };
}

export const AMAZON_DIFFERS_TITLE = "Amazon listing differs";

/** Catalog checks whose Amazon value disagrees with fender.com. Silent before the rotation. */
export function amazonMismatchNote(c: FactCheckCoverage): string | null {
  if (c.amazonMismatches === 0) return null;
  const n = c.amazonMismatches;
  return `${n} ${n === 1 ? "product's Amazon listing shows" : "products' Amazon listings show"} a different value than ${brandSite()} for the checked spec.`;
}

export function amazonDiffersTip(amazon: string | null, fenderValue: string | null): string {
  return `Amazon lists "${amazon ?? ""}". The ${brandSite()} spec page lists "${fenderValue ?? ""}".`;
}

export const CATALOG_COVERAGE_TITLE = "Catalog models checked";

/** Tooltip on each "N of M" cell of the catalog table. */
export function catalogCoverageTip(basis: "run" | "selection", inScope: number): string {
  const counted = `counted by ${brandSite()} spec page, then SKU`;
  return basis === "run"
    ? `Distinct catalog models checked in this run, ${counted}, of the ${formatInt(inScope)} models in scope.`
    : `Distinct catalog models checked across the runs in this selection, ${counted}, of the ${formatInt(inScope)} models in scope in the newest run.`;
}

export const ANCHOR_TITLE = "Anchor";

export const ANCHOR_TIP = "IntoFocus asks this product in every run, on top of the rotating catalog models.";

/** Drawer tooltip on "catalog products", once a check names the product it asked about. */
export const CATALOG_PICK_TIP =
  `Catalog products are counted by ASIN. Each check compares the answer with that product's own value on its ${brandSite()} spec page.`;

/** Drawer tooltip on "product questions": the pick is not recorded. */
export function factCheckPickTip(n: number): string {
  return n === 1
    ? `This fact-check question names one ${brandName()} product. How it was picked, and what part of ${brandName()}'s catalog it stands for, is not recorded.`
    : `Each fact-check question names one ${brandName()} product. How these ${n} products were picked, and what part of ${brandName()}'s catalog they stand for, is not recorded.`;
}

export const FACT_CHECK_SCOPE_LINE = "These checks cover the selected facts only.";

export const FACT_CHECK_SCOPE = `${FACT_CHECK_SCOPE_LINE} They do not prove every statement in each answer is accurate.`;

export const FACT_CHECK_SHOPPING_SCOPE =
  "This run checked selected product facts, not every factual claim in the shopping answers.";

export const FACT_CHECK_SHOPPING_SCOPE_WINDOW =
  "This selection checked selected product facts, not every factual claim in the shopping answers.";

export const FACT_CHECK_ACCURACY_TITLE = "Accuracy";

/** Scope qualifiers live in the Accuracy figure's tooltip, never as on-screen sentences. */
export function factCheckScopeTip(windowed = false): string {
  return `${FACT_CHECK_SCOPE} ${windowed ? FACT_CHECK_SHOPPING_SCOPE_WINDOW : FACT_CHECK_SHOPPING_SCOPE}`;
}

/** Tooltip on the Accuracy figure: its N of M, the engines it covers, then the scope of the checks. */
export function factCheckAccuracyTip(
  c: FactCheckCoverage,
  windowed = false,
  askingEngines: readonly string[] = [],
): string {
  const matched = Math.max(0, c.answersChecked - c.contradictions);
  const engines = factCheckEnginesTip(c, askingEngines);
  return [`${formatInt(matched)} of ${formatInt(c.answersChecked)} answers matched.`, engines, factCheckScopeTip(windowed)]
    .filter(Boolean)
    .join(" ");
}

export const UNVERIFIED_FLAG_TIP =
  `The answer carries a flag that was never verified against a ${brandName()} page, so it is not reported as a contradiction.`;

/** Engines that returned nothing. Secondary, never the headline. */
export function factCheckCoverageNote(c: FactCheckCoverage): string | null {
  if (c.failedCalls === 0) return null;
  return `${joinBrands(c.failedEngines)} did not return answers for ${CALL(c.failedCalls)}.`;
}

/** Questions IntoFocus has not yet verified a fact for. */
export function factCheckPendingNote(c: FactCheckCoverage): string | null {
  if (c.answersWithoutFact === 0) return null;
  const questions = c.questionsWithoutFact.length;
  const unit = c.catalogProducts > 0 ? "product" : "question";
  return `${questions} ${unit}${questions === 1 ? "" : "s"} ${questions === 1 ? "has" : "have"} no verified ${brandName()} fact yet, so ${ANSWER(c.answersWithoutFact)} ${c.answersWithoutFact === 1 ? "was" : "were"} not evaluated.`;
}

/** Short form for the map bubble and the guided tour. */
export function factCheckShortLine(c: FactCheckCoverage): string {
  if (c.answersChecked === 0) return "No product fact check completed";
  return c.contradictions === 0
    ? `No contradictions in ${ANSWER(c.answersChecked)}`
    : `${contradictionCount(c.contradictions)} in ${ANSWER(c.answersChecked)}`;
}

export function factsCheckedLine(c: FactCheckCoverage): string {
  return `${c.factsChecked} facts checked`;
}
