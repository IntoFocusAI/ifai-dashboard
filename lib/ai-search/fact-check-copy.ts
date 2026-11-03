import type { FactCheckCoverage } from "@/lib/ai-search/drift";
import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { joinBrands } from "@/lib/ai-search/competitors";
import { pct } from "@/lib/ai-search/summary";

const FACT = (n: number) => `${n} Fender product fact${n === 1 ? "" : "s"}`;
const ANSWER = (n: number) => `${n} answer${n === 1 ? "" : "s"}`;
const CALL = (n: number) => `${n} fact-check call${n === 1 ? "" : "s"}`;

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

const ACCURACY_TONE_COLOR: Record<FactCheckAccuracyTone, string> = {
  danger: "var(--danger-red)",
  warning: "var(--warning-amber)",
  success: "var(--success-green)",
};

export function factCheckAccuracyColor(tone: FactCheckAccuracyTone | null): string | undefined {
  return tone ? ACCURACY_TONE_COLOR[tone] : undefined;
}

/** Pie for the Accuracy lead. Zero slices are omitted so a perfect rate is one full disc. */
export function factCheckAccuracyPie(c: FactCheckCoverage): PieDiscData | null {
  if (c.answersChecked === 0) return null;
  const matched = c.answersChecked - c.contradictions;
  const slices = [
    { key: "matched", label: "Matched the verified fact", count: matched },
    { key: "contradicted", label: "Contradicted the verified fact", count: c.contradictions },
  ].filter((slice) => slice.count > 0);
  return {
    id: "accuracy",
    title: "Accuracy",
    total: c.answersChecked,
    totalLabel: "answers checked",
    slices,
  };
}

export function factCheckAccuracyPieTip(c: FactCheckCoverage): string {
  const matched = Math.max(0, c.answersChecked - c.contradictions);
  return `${matched} answers matched the verified fact. ${c.contradictions} answers contradicted it.`;
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

export const FACT_CHECK_METHOD_TITLE = "How these products were chosen";

export type FactCheckMethodLine = {
  products: string;
  verified: string;
  /** How the products were picked, and that the pick is not recorded. */
  tip: string;
};

/**
 * "5 products checked · 4 with a verified fact", from the live coverage counts.
 * Each fact-check question names one Fender product, so questions count as products.
 * No stored field records how those products were picked or what part of the catalog
 * they stand for, so the tooltip says so instead of calling them a sample.
 */
export function factCheckMethodLine(c: FactCheckCoverage, windowed = false): FactCheckMethodLine | null {
  if (c.questionsSent === 0) return null;
  const unit = windowed ? "selection" : "run";
  const n = c.questionsSent;
  const one = n === 1;
  const named = `Each fact-check question names one Fender product, and the question set names ${n}. IntoFocus sends ${one ? "it" : "them"} to every engine on purpose.`;
  const compared = `${c.factsChecked} of ${n} ${c.factsChecked === 1 ? "was" : "were"} compared with a fact verified on an official Fender page in this ${unit}.`;
  const picked = one
    ? "How this product was picked, and what part of Fender's catalog it stands for, is not recorded, so this result covers this product only."
    : `How these products were picked, and what part of Fender's catalog they stand for, is not recorded, so this result covers these ${n} products only.`;
  return {
    products: `${n} product${one ? "" : "s"} checked`,
    verified: `${c.factsChecked} with a verified fact`,
    tip: `${named} ${compared} ${picked}`,
  };
}

export const FACT_CHECK_SCOPE =
  "These checks cover the selected facts only. They do not prove every statement in each answer is accurate.";

export const FACT_CHECK_SHOPPING_SCOPE =
  "This run checked selected product facts, not every factual claim in the shopping answers.";

export const FACT_CHECK_SHOPPING_SCOPE_WINDOW =
  "This selection checked selected product facts, not every factual claim in the shopping answers.";

/** Engines that returned nothing. Secondary, never the headline. */
export function factCheckCoverageNote(c: FactCheckCoverage): string | null {
  if (c.failedCalls === 0) return null;
  return `${joinBrands(c.failedEngines)} did not return answers for ${CALL(c.failedCalls)}.`;
}

/** Questions IntoFocus has not yet verified a fact for. */
export function factCheckPendingNote(c: FactCheckCoverage): string | null {
  if (c.answersWithoutFact === 0) return null;
  const questions = c.questionsWithoutFact.length;
  return `${questions} question${questions === 1 ? "" : "s"} ${questions === 1 ? "has" : "have"} no verified Fender fact yet, so ${ANSWER(c.answersWithoutFact)} ${c.answersWithoutFact === 1 ? "was" : "were"} not evaluated.`;
}

/** Short form for the map bubble and the guided tour. */
export function factCheckShortLine(c: FactCheckCoverage): string {
  if (c.answersChecked === 0) return "No product fact check completed";
  return c.contradictions === 0
    ? `No contradictions in ${ANSWER(c.answersChecked)}`
    : `${c.contradictions} contradictions in ${ANSWER(c.answersChecked)}`;
}

export function factsCheckedLine(c: FactCheckCoverage): string {
  return `${c.factsChecked} facts checked`;
}
