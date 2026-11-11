/**
 * Roadmap and Action Items: always a focus (decision 21 d, Brian, 11 Nov 2026).
 *
 * Even when every finding is on track, the plan names where the brand is weakest in AI answers:
 * the weakest engine, the five weakest unbranded discovery questions, and the cited sites rising
 * or falling fastest over the last three published runs. Two guardrails hold on every item:
 * a real gap (it trails the best comparable by `GAP_POINTS` or more) and enough data (at least
 * `MIN_ANSWERS` answers behind the figure). An item that fails either is held, not acted on.
 * AI figures read the map population (decision 7).
 */

import { isCommercial, cleanPrompt, engineLabel, tallyCommercial, type OutcomeTally } from "@/lib/ai-search/run-metrics";
import { engineResultRoleTallies, questionRole } from "@/lib/ai-search/question-role";
import type { EvidenceFocus } from "@/lib/ai-search/evidence-focus";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandSite, leadBrand } from "@/lib/brand-copy";
import { formatPct, formatRatio } from "@/lib/fender-canvas/format";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import {
  answersOf,
  citedPages,
  runShares,
  shareIn,
  siteType,
  sourceActionWording,
  type CitedPage,
  type SiteType,
} from "@/lib/fender-canvas/roadmap-sources";

/** Guardrail (a): flag only when the item trails the best comparable by this many points or more. */
export const GAP_POINTS = 10;
/** Guardrail (b): answers behind the figure; fewer and the item is not acted on. */
export const MIN_ANSWERS = 30;
/** Weakest unbranded discovery questions named. */
export const WEAK_QUESTION_LIMIT = 5;
/** Sites named each way, rising and falling. */
export const MOVING_SITE_LIMIT = 3;
/** Published runs a site's movement is read across. */
export const MOVEMENT_RUNS = 3;

const RUN_DETAILS = { spokeId: "aeo", tab: "Run Details" } as const;
const CITATIONS = { spokeId: "aeo", tab: "Citation Ecosystem" } as const;

/** A client focus (rolling plan): the whole brand, or one stored question category. */
export type PlanFocus = { kind: "brand" } | { kind: "category"; key: string };

export const BRAND_FOCUS: PlanFocus = { kind: "brand" };

export type FocusKind = "engine" | "question" | "site";

export type FocusAction = {
  id: string;
  focus: FocusKind;
  label: string;
  numerator: number;
  denominator: number;
  fact: string;
  action: string;
  open: { spokeId: string; tab: string };
  evidence: EvidenceFocus | null;
  /** Category keys the item belongs to; empty when it is brand-wide. */
  categories: string[];
  /** A site item's type and cited pages. */
  siteType: SiteType | null;
  pages: CitedPage[];
  /** A site item's movement sentence, kept apart so it can join a source action on the same site. */
  trend: string | null;
  /** Points of change across the runs read (site items), or points behind the best comparable. */
  gap: number;
  partial: PartialFigure | null;
};

/** Why an item was not acted on, for the hand-back and the page's data attributes. */
export type HeldItem = { id: string; label: string; guardrail: "gap" | "data"; detail: string };

export type FocusRead = { actions: FocusAction[]; held: HeldItem[] };

function rate(tally: Pick<OutcomeTally, "fenderWins" | "resolved">): number {
  return tally.resolved > 0 ? (100 * tally.fenderWins) / tally.resolved : 0;
}

function points(value: number): string {
  return `${value.toFixed(1)} points`;
}

/** Calls in the focus: every call for the brand, or one category's. */
export function focusSnapshot(snapshot: AiSearchSnapshot, focus: PlanFocus): AiSearchSnapshot {
  if (focus.kind === "brand") return snapshot;
  const calls = snapshot.calls.filter((call) => (call.category ?? "") === focus.key);
  const ids = new Set(calls.map((call) => call.id));
  return {
    ...snapshot,
    calls,
    probes: snapshot.probes,
    citations: snapshot.citations.filter((citation) => ids.has(citation.simulation_id)),
  };
}

/** The categories a client focus can pick from, largest first. */
export function focusOptions(snapshot: AiSearchSnapshot | null): Array<{ key: string; answers: number }> {
  if (!snapshot) return [];
  const counts = new Map<string, number>();
  for (const call of snapshot.calls) {
    if (!isCommercial(call) || !call.category) continue;
    counts.set(call.category, (counts.get(call.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, answers]) => ({ key, answers }))
    .sort((a, b) => b.answers - a.answers || a.key.localeCompare(b.key));
}

/** The weakest engine on unbranded discovery, as Engine Comparison orders engines. Days 31 to 60. */
export function weakestEngine(snapshot: AiSearchSnapshot): FocusRead {
  const engines = engineResultRoleTallies(snapshot.calls)
    .map((engine) => ({ key: engine.key, tally: engine.roles.unbranded_discovery }))
    .filter((engine) => engine.tally.resolved > 0)
    .sort((a, b) => rate(a.tally) - rate(b.tally) || a.key.localeCompare(b.key));
  const weakest = engines[0];
  if (!weakest || engines.length < 2) return { actions: [], held: [] };
  const id = `focus:engine:${weakest.key}`;
  const label = `${engineLabel(weakest.key)} names ${leadBrand()} least`;
  if (weakest.tally.resolved < MIN_ANSWERS) {
    return {
      actions: [],
      held: [{ id, label, guardrail: "data", detail: `${formatRatio(weakest.tally.fenderWins, weakest.tally.resolved)} resolved answers` }],
    };
  }
  const comparable = engines.filter((engine) => engine.key !== weakest.key && engine.tally.resolved >= MIN_ANSWERS);
  const best = comparable.reduce<number | null>((top, engine) => Math.max(top ?? 0, rate(engine.tally)), null);
  if (best == null) {
    return { actions: [], held: [{ id, label, guardrail: "data", detail: "no other engine has 30 resolved answers to compare" }] };
  }
  const gap = best - rate(weakest.tally);
  if (gap < GAP_POINTS) {
    return { actions: [], held: [{ id, label, guardrail: "gap", detail: `${points(gap)} behind the best engine` }] };
  }
  const engine = engineLabel(weakest.key);
  return {
    actions: [
      {
        id,
        focus: "engine",
        label,
        numerator: weakest.tally.fenderWins,
        denominator: weakest.tally.resolved,
        fact: `${leadBrand()} is named most in ${formatRatio(weakest.tally.fenderWins, weakest.tally.resolved)} resolved unbranded discovery answers on ${engine}, the lowest of the engines checked.`,
        action: `Review the ${engine} answers that name another brand most, and the sources they cite.`,
        open: RUN_DETAILS,
        evidence: { field: "role", value: "unbranded_discovery/resolved", engine: weakest.key },
        categories: [],
        siteType: null,
        pages: [],
        trend: null,
        gap,
        partial: null,
      },
    ],
    held: [],
  };
}

/** The five weakest unbranded discovery questions, each with enough answers and a real gap. */
export function weakestQuestions(snapshot: AiSearchSnapshot): FocusRead {
  const groups = new Map<string, { calls: typeof snapshot.calls; category: string }>();
  for (const call of snapshot.calls) {
    if (!isCommercial(call) || questionRole(call) !== "unbranded_discovery") continue;
    const question = cleanPrompt(call.prompt);
    if (!question) continue;
    const group = groups.get(question) ?? { calls: [], category: call.category ?? "" };
    group.calls.push(call);
    groups.set(question, group);
  }
  const questions = [...groups.entries()]
    .map(([question, group]) => ({ question, category: group.category, tally: tallyCommercial(group.calls) }))
    .filter((entry) => entry.tally.resolved > 0);
  const held: HeldItem[] = [];
  const idOf = (question: string) => `focus:question:${question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const enough = questions.filter((entry) => {
    if (entry.tally.resolved >= MIN_ANSWERS) return true;
    held.push({ id: idOf(entry.question), label: entry.question, guardrail: "data", detail: `${formatRatio(entry.tally.fenderWins, entry.tally.resolved)} resolved answers` });
    return false;
  });
  const best = enough.reduce<number | null>((top, entry) => Math.max(top ?? 0, rate(entry.tally)), null);
  const weakest = enough
    .slice()
    .sort((a, b) => rate(a.tally) - rate(b.tally) || a.question.localeCompare(b.question))
    .slice(0, WEAK_QUESTION_LIMIT);
  const actions: FocusAction[] = [];
  for (const entry of weakest) {
    const gap = (best ?? 0) - rate(entry.tally);
    const id = idOf(entry.question);
    if (gap < GAP_POINTS) {
      held.push({ id, label: entry.question, guardrail: "gap", detail: `${points(gap)} behind the best question` });
      continue;
    }
    actions.push({
      id,
      focus: "question",
      label: `"${entry.question}"`,
      numerator: entry.tally.fenderWins,
      denominator: entry.tally.resolved,
      fact: `${leadBrand()} is named most in ${formatRatio(entry.tally.fenderWins, entry.tally.resolved)} resolved answers to "${entry.question}".`,
      action: `Word the ${brandSite()} product pages to answer this question.`,
      open: RUN_DETAILS,
      evidence: entry.category
        ? { field: "role", value: "unbranded_discovery/resolved", category: entry.category }
        : { field: "role", value: "unbranded_discovery/resolved" },
      categories: entry.category ? [entry.category] : [],
      siteType: null,
      pages: [],
      trend: null,
      gap,
      partial: null,
    });
  }
  return { actions, held };
}

/**
 * Cited sites rising or falling fastest in share of shopping answers with sources, from the
 * oldest to the latest of the last three published runs. Sites with no 21c action (brand-owned,
 * Unclassified) are left out; the brand's own site is the own-page action's.
 */
export function movingSites(runs: readonly AiSearchSnapshot[]): FocusRead {
  if (runs.length < MOVEMENT_RUNS) return { actions: [], held: [] };
  const latest = runShares(runs[0]!);
  const oldest = runShares(runs[MOVEMENT_RUNS - 1]!);
  const domains = new Set([...latest.byDomain.keys(), ...oldest.byDomain.keys()]);
  const held: HeldItem[] = [];
  if (latest.read.answersWithCitation < MIN_ANSWERS || oldest.read.answersWithCitation < MIN_ANSWERS) {
    held.push({
      id: "focus:site",
      label: "Cited sites rising or falling",
      guardrail: "data",
      detail: `${latest.read.answersWithCitation} and ${oldest.read.answersWithCitation} shopping answers with sources in the latest and oldest runs`,
    });
    return { actions: [], held };
  }
  const moves: Array<{ domain: string; type: SiteType; change: number; before: number; now: number }> = [];
  for (const domain of domains) {
    const type = siteType(domain);
    if (!sourceActionWording(type, domain)) continue;
    const now = 100 * shareIn(latest, domain);
    const before = 100 * shareIn(oldest, domain);
    const change = now - before;
    if (change === 0) continue;
    moves.push({ domain, type, change, before, now });
  }
  const pick = (sign: 1 | -1) =>
    moves
      .filter((move) => Math.sign(move.change) === sign)
      .sort((a, b) => sign * (b.change - a.change) || a.domain.localeCompare(b.domain))
      .slice(0, MOVING_SITE_LIMIT);
  const actions: FocusAction[] = [];
  for (const move of [...pick(1), ...pick(-1)]) {
    const id = `focus:site:${move.domain}`;
    const label = `${move.domain} ${move.change > 0 ? "rising" : "falling"}`;
    if (Math.abs(move.change) < GAP_POINTS) {
      held.push({ id, label, guardrail: "gap", detail: `${points(Math.abs(move.change))} of change` });
      continue;
    }
    const rows = latest.byDomain.get(move.domain) ?? [];
    const answers = answersOf(rows);
    const earlier = answersOf(oldest.byDomain.get(move.domain) ?? []);
    const trend = `Two published runs earlier it was cited in ${formatPct(move.before)} (${formatRatio(earlier, oldest.read.answersWithCitation)}).`;
    actions.push({
      id,
      focus: "site",
      label,
      numerator: answers,
      denominator: latest.read.answersWithCitation,
      fact: `${move.domain} is cited in ${formatPct(move.now)} of shopping answers with sources (${formatRatio(answers, latest.read.answersWithCitation)}). ${trend}`,
      action: sourceActionWording(move.type, move.domain)!,
      open: CITATIONS,
      evidence: { field: "domain", value: move.domain },
      categories: [],
      siteType: move.type,
      pages: citedPages(rows),
      trend,
      gap: Math.abs(move.change),
      partial: null,
    });
  }
  return { actions, held };
}

/** Every 21d focus item for the read, in plan order: engine, questions, then sites. */
export function focusActions(input: {
  current: AiSearchSnapshot | null;
  runs: readonly AiSearchSnapshot[] | null;
  focus?: PlanFocus;
}): FocusRead {
  const focus = input.focus ?? BRAND_FOCUS;
  const reads: FocusRead[] = [];
  if (input.current) {
    const scoped = focusSnapshot(input.current, focus);
    reads.push(weakestEngine(scoped), weakestQuestions(scoped));
  }
  if (input.runs) reads.push(movingSites(input.runs.map((run) => focusSnapshot(run, focus))));
  return { actions: reads.flatMap((read) => read.actions), held: reads.flatMap((read) => read.held) };
}
