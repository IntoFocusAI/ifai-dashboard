/**
 * How each hover slot is chosen (FDD X-22).
 * Gap: the check with the highest share of its own population falling short.
 * Opportunity: the check whose closing adds the most score points, by the approved weights (FDD 7).
 * Ties go to the larger count, then to list order. A check still loading holds the slot on Loading.
 */

import { categoryLabel, MIN_COMPARABLE_RESOLVED } from "@/lib/ai-search/run-metrics";
import type { HubEvidenceSlot } from "@/lib/canvas-sdk/hub-slot-types";
import type { HubSlotChart } from "@/lib/canvas-sdk/types";
import { CONSENSUS_SCORE_BANDS, scoreTone } from "@/lib/fender-canvas/consensus-score-display";
import {
  foundationScore,
  type ConsensusScore,
  type PillarScore,
  type ScoreComponentId,
  type ScoredComponent,
} from "@/lib/fender-canvas/consensus-scores";
import { consensusFromLive, foundationInputsFromLive } from "@/lib/fender-canvas/consensus-scores-from-live";
import type { CheckBook, CheckId, CheckTarget, SlotCheck, SlotReads } from "@/lib/fender-canvas/hub-slot-checks";
import {
  bandWord,
  checkChart,
  countLine,
  evidenceSlot,
  lastCheckedLine,
  loadingSlot,
  percentFigure,
  shortShare,
  targetLine,
  unavailableSlot,
  weightFigure,
} from "@/lib/fender-canvas/hub-slot-format";

export type ScoreRead = {
  consensus: ConsensusScore | null;
  foundation: PillarScore;
  commerce: PillarScore | null;
  /** The retail read is still loading, so AI Commerce and AI Consensus are not ready. */
  retailPending: boolean;
};

export function readScores(reads: SlotReads): ScoreRead {
  const retail = reads.retail ?? { phase: "loading" as const };
  const specPages = reads.bundle?.specPages;
  const consensus = consensusFromLive({
    findability: reads.findability,
    specPages,
    retail,
    ai: reads.ai,
    authorizedPartners: reads.authorizedPartners ?? null,
  });
  const foundation =
    consensus?.foundation ??
    foundationScore(foundationInputsFromLive({ findability: reads.findability, specPages, retail, ai: reads.ai }));
  return { consensus, foundation, commerce: consensus?.commerce ?? null, retailPending: retail.phase === "loading" };
}

export function scoreTarget(name: string, score: number): CheckTarget {
  return {
    text: `${name} above ${CONSENSUS_SCORE_BANDS.greenAbove}`,
    now: score.toFixed(1),
    tone: scoreTone(score) ?? "warning",
  };
}

type Evidence = { spokeId: string; subTab: string };

export type GapPool = {
  ids: CheckId[];
  rule: string;
  /** Re-homes a check's evidence link onto this bubble when its rows also live here. */
  evidence?: Partial<Record<CheckId, Evidence>>;
};

function largestShare<T extends SlotCheck>(checks: T[]): T | null {
  let best: T | null = null;
  for (const check of checks) {
    if (!best) {
      best = check;
      continue;
    }
    const share = shortShare(check);
    const bestShare = shortShare(best);
    if (share > bestShare || (share === bestShare && check.failing > best.failing)) best = check;
  }
  return best;
}

export function gapSlot(check: SlotCheck, rule: string, evidence?: Evidence): HubEvidenceSlot {
  const tone = check.target ? check.target.tone : check.failing > 0 ? "warning" : "success";
  const statusWord = check.target ? bandWord(check.target.tone) : check.failing > 0 ? "Open gap" : "No gap";
  return evidenceSlot({
    role: "gap",
    rule,
    figure: percentFigure(shortShare(check)),
    label: check.label,
    note: check.note,
    noteDefinition: check.noteDefinition,
    tone,
    statusWord,
    chart: checkChart(check),
    target: targetLine(check.target),
    countedOutOf: countLine(check.failing, check.total, check.population),
    lastChecked: lastCheckedLine(check.checkedAt, check.source),
    spokeId: evidence?.spokeId ?? check.spokeId,
    subTab: evidence?.subTab ?? check.subTab,
  });
}

/** The gap is the pool check with the highest share falling short. */
export function pickGap(book: CheckBook, pool: GapPool, bubble: string, home: Evidence): HubEvidenceSlot {
  const label = `${bubble} checks`;
  if (pool.ids.some((id) => book.pending.has(id))) {
    return loadingSlot("gap", label, pool.rule, home.spokeId, home.subTab);
  }
  const checks = pool.ids.map((id) => book.checks[id]).filter((check): check is SlotCheck => check != null);
  const best = largestShare(checks);
  if (!best) {
    return unavailableSlot("gap", label, pool.rule, `No ${bubble} check has a stored population yet.`, home.spokeId, home.subTab);
  }
  return gapSlot(best, pool.rule, pool.evidence?.[best.id as CheckId]);
}

/** Of the unbranded categories with enough resolved answers to compare, the highest share another brand led. */
export function pickCategoryGap(book: CheckBook): HubEvidenceSlot {
  const home = { spokeId: "competitors", subTab: "Category Battlecards" };
  const comparable = book.categories.filter((check) => check.total >= MIN_COMPARABLE_RESOLVED);
  const pool = comparable.length ? comparable : book.categories;
  const rule = comparable.length
    ? `Of the ${pool.length} unbranded categories with at least ${MIN_COMPARABLE_RESOLVED} resolved answers, this one has the highest share led by another brand.`
    : `No unbranded category has ${MIN_COMPARABLE_RESOLVED} resolved answers yet, so this is the highest share led by another brand among all ${pool.length}.`;
  if (book.categoriesPending) return loadingSlot("gap", "Unbranded categories", rule, home.spokeId, home.subTab);
  const best = largestShare(pool);
  if (!best) {
    return unavailableSlot(
      "gap",
      "Unbranded categories",
      "Competitive Radar uses the published AI run. This slot waits for a run with resolved unbranded answers.",
      "The published AI run has no resolved unbranded category answers.",
      home.spokeId,
      home.subTab,
    );
  }
  return gapSlot(best, rule);
}

export type OpportunityUnit = "AI Foundation" | "AI Commerce" | "AI Consensus";

type Candidate = {
  component: ScoredComponent;
  /** Points in the unit's own 0-100 score. */
  gain: number;
  /** The component's share of the unit, in percent. */
  weight: number;
  failing: number;
  total: number;
};

const COMPONENT_CHECK: Record<ScoreComponentId, { check: CheckId | null; fix: string }> = {
  exact_official_pages: { check: "exact_pages", fix: "every listing had an exact official page" },
  machine_readable_specs: { check: "machine_readable", fix: "every found page had machine-readable specs" },
  required_marketplace_specs: { check: "required_specs", fix: "every checked listing filled the required specs" },
  unbranded_named_most: { check: "unbranded", fix: "Fender/Squier led every unbranded answer" },
  fact_check_match: { check: "fact_checks", fix: "every checked answer matched the verified fact" },
  controlled_buy_box: { check: "controlled_buy_box", fix: "Amazon or a partner held every Buy Box" },
  not_suppressed: { check: "buy_box_withheld", fix: "no Buy Box was withheld" },
  active_products_available: { check: null, fix: "every active product was available" },
  not_splintered: { check: "splintered", fix: "every bundle was nested" },
  no_map_violation: { check: "map_violation", fix: "no listing was below MAP" },
};

export function componentCheckId(id: ScoreComponentId): CheckId | null {
  return COMPONENT_CHECK[id].check;
}

function candidates(pillar: PillarScore | null, scale: number, only?: ScoreComponentId[]): Candidate[] {
  if (!pillar) return [];
  return pillar.components
    .filter((component): component is ScoredComponent => component.included)
    .filter((component) => !only || only.includes(component.id))
    .map((component) => ({
      component,
      gain: (scale * component.weight * (100 - component.score)) / 100,
      weight: scale * component.weight,
      failing: component.coverage.denominator - component.coverage.numerator,
      total: component.coverage.denominator,
    }));
}

export type OpportunityPool = {
  unit: OpportunityUnit;
  /** Components that belong to this bubble. Omit for every component in the unit. */
  only?: ScoreComponentId[];
  /** Checks whose reads must finish before the largest one is named. */
  waitFor: CheckId[];
  evidence: Evidence;
  rule?: string;
};

function unitScore(scores: ScoreRead, unit: OpportunityUnit): { score: number | null; list: Candidate[] } {
  if (unit === "AI Foundation") return { score: scores.foundation.score, list: candidates(scores.foundation, 1) };
  if (unit === "AI Commerce") return { score: scores.commerce?.score ?? null, list: candidates(scores.commerce, 1) };
  const consensus = scores.consensus;
  if (!consensus) return { score: null, list: [] };
  const pillars = [consensus.foundation, consensus.commerce];
  return {
    score: consensus.score,
    list: pillars.flatMap((pillar) => candidates(pillar, (pillar.weight ?? 0) / 100)),
  };
}

/** The opportunity is the measured check whose closing adds the most points to the unit's score. */
export function pickOpportunity(book: CheckBook, scores: ScoreRead, pool: OpportunityPool): HubEvidenceSlot {
  const { unit, evidence } = pool;
  const rule =
    pool.rule ??
    `Of the ${unit} checks on this bubble, closing this one would add the most ${unit} points, by its approved weight.`;
  const label = `${unit} points`;
  const needsRetail = unit !== "AI Foundation";
  if ((needsRetail && scores.retailPending) || pool.waitFor.some((id) => book.pending.has(id))) {
    return loadingSlot("opportunity", label, rule, evidence.spokeId, evidence.subTab);
  }
  const { score, list } = unitScore(scores, unit);
  const scoped = list.filter((row) => !pool.only || pool.only.includes(row.component.id));
  let best: Candidate | null = null;
  for (const row of scoped) {
    if (!best || row.gain > best.gain || (row.gain === best.gain && row.failing > best.failing)) best = row;
  }
  if (!best || score == null) {
    return unavailableSlot(
      "opportunity",
      label,
      rule,
      needsRetail ? `${unit} needs the retail read, which did not load.` : `${unit} has no measured check on this bubble yet.`,
      evidence.spokeId,
      evidence.subTab,
    );
  }
  const map = COMPONENT_CHECK[best.component.id];
  const check = map.check ? book.checks[map.check] : undefined;
  const placeholder = best.component.placeholder ? best.component.placeholderTooltip : undefined;
  const chart: HubSlotChart | null = check
    ? { part: best.failing, total: best.total, partLabel: check.failLabel, restLabel: check.passLabel }
    : null;
  return evidenceSlot({
    role: "opportunity",
    rule,
    figure: `+${best.gain.toFixed(1)}`,
    label: best.gain > 0 ? `${unit} points if ${map.fix}` : `Every ${unit} check on this bubble is fully met`,
    note: `This check carries ${weightFigure(best.weight)} of ${unit}.${placeholder ? " Placeholder list." : ""}`,
    noteDefinition: placeholder,
    tone: "neutral",
    statusWord: "Score points",
    chart,
    target: targetLine(scoreTarget(unit, score)),
    countedOutOf: countLine(best.failing, best.total, check?.population ?? "in this score input", " fall short"),
    lastChecked: lastCheckedLine(check?.checkedAt ?? [], check?.source ?? "This score input"),
    spokeId: evidence.spokeId,
    subTab: evidence.subTab,
  });
}

/**
 * Competitive Radar: the category with the most answers another brand led. Turning those into
 * Fender/Squier leads moves the unbranded component of AI Foundation by its approved weight.
 */
export function pickCategoryOpportunity(book: CheckBook, scores: ScoreRead): HubEvidenceSlot {
  const evidence = { spokeId: "competitors", subTab: "Competitor Wins" };
  const rule =
    "Of the unbranded categories, this one has the most answers another brand led, so Fender/Squier leading them would add the most AI Foundation points.";
  const label = "AI Foundation points";
  if (book.categoriesPending) return loadingSlot("opportunity", label, rule, evidence.spokeId, evidence.subTab);
  const unbranded = scores.foundation.components.find(
    (component): component is ScoredComponent => component.id === "unbranded_named_most" && component.included,
  );
  const best = book.categories.find((check) => check.competitorWins > 0) ?? null;
  const foundation = scores.foundation.score;
  if (!unbranded || !best || foundation == null) {
    return unavailableSlot(
      "opportunity",
      label,
      rule,
      "The published AI run has no unbranded category answers another brand led.",
      evidence.spokeId,
      evidence.subTab,
    );
  }
  const gain = (unbranded.weight * best.competitorWins) / unbranded.coverage.denominator;
  return evidenceSlot({
    role: "opportunity",
    rule,
    figure: `+${gain.toFixed(1)}`,
    label: `AI Foundation points if Fender/Squier led the ${categoryLabel(best.category)} answers another brand led`,
    note: `Unbranded answers carry ${weightFigure(unbranded.weight)} of AI Foundation.`,
    tone: "neutral",
    statusWord: "Score points",
    chart: checkChart(best),
    target: targetLine(scoreTarget("AI Foundation", foundation)),
    countedOutOf: countLine(best.failing, best.total, best.population),
    lastChecked: lastCheckedLine(best.checkedAt, best.source),
    spokeId: evidence.spokeId,
    subTab: evidence.subTab,
  });
}

/** Strategy Roadmap has no stored plan, so its gap is AI Consensus against the approved band. */
export function consensusGap(book: CheckBook, scores: ScoreRead): HubEvidenceSlot {
  const evidence = { spokeId: "hub", subTab: "Performance" };
  const rule = `Strategy Roadmap has no stored plan yet, so its gap is the overall one: AI Consensus against its approved target, above ${CONSENSUS_SCORE_BANDS.greenAbove}.`;
  const label = "AI Consensus score";
  if (scores.retailPending) return loadingSlot("gap", label, rule, evidence.spokeId, evidence.subTab);
  const consensus = scores.consensus;
  if (!consensus || consensus.score == null) {
    return unavailableSlot(
      "gap",
      label,
      rule,
      "AI Consensus needs the retail read, which did not load.",
      evidence.spokeId,
      evidence.subTab,
    );
  }
  const score = consensus.score;
  const target = scoreTarget("AI Consensus", score);
  const included = [consensus.foundation, consensus.commerce].flatMap((pillar) =>
    pillar.components.filter((component) => component.included),
  );
  const times = included.flatMap((component) => {
    const id = componentCheckId(component.id);
    return (id && book.checks[id]?.checkedAt) || [];
  });
  return evidenceSlot({
    role: "gap",
    rule,
    figure: score.toFixed(1),
    label,
    note: "AI Actuation is not included.",
    tone: target.tone,
    statusWord: bandWord(target.tone),
    chart: { part: Math.round(score), total: 100, partLabel: "Points", restLabel: "Points to 100" },
    target: targetLine(target),
    countedOutOf: {
      text: `${score.toFixed(1)} of 100 points, from ${consensus.coverage.numerator} of ${consensus.coverage.denominator} pillars`,
    },
    lastChecked: lastCheckedLine(times, "AI Consensus"),
    spokeId: evidence.spokeId,
    subTab: evidence.subTab,
  });
}
