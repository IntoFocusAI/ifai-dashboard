/**
 * Roadmap and Action Items: always a focus (decision 21 d, Brian, 11 Nov 2026).
 *
 * Even when every finding is on track, the plan names where the brand is weakest in AI answers:
 * the weakest engine, the five weakest unbranded discovery questions, and the cited sites whose
 * share moved most. Every figure counts the answers in the last 30 days ending on the published
 * run, the window the AI Search tabs open on, read as the map reads a run (decision 7), never one
 * run. An engine or question needs at least `MIN_ANSWERS` resolved answers in the window. When it
 * trails the best comparable by `GAP_POINTS` or more it is a priority action (Days 31 to 60);
 * otherwise it is a watch line, ranked after every other action (Days 61 to 90), so the client
 * still sees where the brand is weakest.
 */

import { isCommercial, cleanPrompt, engineLabel, tallyCommercial, type OutcomeTally } from "@/lib/ai-search/run-metrics";
import { engineResultRoleTallies, questionRole } from "@/lib/ai-search/question-role";
import type { EvidenceFocus } from "@/lib/ai-search/evidence-focus";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandSite, leadBrand } from "@/lib/brand-copy";
import { activeClient } from "@/lib/client/active-client";
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

/** Points behind the best comparable at or over which a weak engine or question is a priority action. */
export const GAP_POINTS = 10;
/** Answers in the window behind a figure; fewer and the item is held. */
export const MIN_ANSWERS = 30;
/** Weakest unbranded discovery questions named. */
export const WEAK_QUESTION_LIMIT = 5;
/** Sites named each way, rising and falling. */
export const MOVING_SITE_LIMIT = 3;
/** A moving site's share of shopping answers with sources, in the current or previous window. */
export const MOVING_SITE_MIN_SHARE = 0.03;
/** Answers citing a moving site in the current window. */
export const MOVING_SITE_MIN_ANSWERS = 10;
/** Change in a site's share, relative to its earlier share, that flags it. */
export const MOVING_SITE_CHANGE = 0.1;

const RUN_DETAILS = { spokeId: "aeo", tab: "Run Details" } as const;
const CITATIONS = { spokeId: "aeo", tab: "Citation Ecosystem" } as const;

/** A client focus (rolling plan): the whole brand, or one stored question category. */
export type PlanFocus = { kind: "brand" } | { kind: "category"; key: string };

export const BRAND_FOCUS: PlanFocus = { kind: "brand" };

/**
 * The focus IntoFocus staff set for the client on screen: `roadmapFocusCategory` in
 * lib/client/active-client.ts. Null there is the whole brand. Clients get no control.
 */
export function staffFocus(category: string | null = activeClient().roadmapFocusCategory): PlanFocus {
  if (!category) return BRAND_FOCUS;
  const cached = staffFocuses.get(category) ?? { kind: "category", key: category };
  staffFocuses.set(category, cached);
  return cached;
}

/** One object per category, so a hook's memo sees the same focus on every render. */
const staffFocuses = new Map<string, PlanFocus>();

export type FocusKind = "engine" | "question" | "site";

/** A priority action, or a watch line when the gap to the best is under `GAP_POINTS`. */
export type FocusTier = "priority" | "watch";

export type FocusAction = {
  id: string;
  focus: FocusKind;
  tier: FocusTier;
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
  /** Points behind the best comparable, or a site's change in share relative to its earlier share (percent). */
  gap: number;
  partial: PartialFigure | null;
};

/** Why an item was not acted on, for the hand-back and the page's data attributes. */
export type HeldItem = { id: string; label: string; guardrail: "gap" | "data"; detail: string };

export type FocusRead = { actions: FocusAction[]; held: HeldItem[] };

/** The two 30-day windows, each pooled across its runs. The current one ends on the published run. */
export type FocusWindows = { current: AiSearchSnapshot | null; previous: AiSearchSnapshot | null };

function rate(tally: Pick<OutcomeTally, "fenderWins" | "resolved">): number {
  return tally.resolved > 0 ? (100 * tally.fenderWins) / tally.resolved : 0;
}

function tierOf(gap: number): FocusTier {
  return gap >= GAP_POINTS ? "priority" : "watch";
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

/** Resolved unbranded discovery answers per engine, lowest rate first, as Engine Comparison orders them. */
export function engineCounts(snapshot: AiSearchSnapshot): Array<{ key: string; tally: OutcomeTally }> {
  return engineResultRoleTallies(snapshot.calls)
    .map((engine) => ({ key: engine.key, tally: engine.roles.unbranded_discovery }))
    .filter((engine) => engine.tally.resolved > 0)
    .sort((a, b) => rate(a.tally) - rate(b.tally) || a.key.localeCompare(b.key));
}

/** Resolved answers per unbranded discovery question. */
export function questionCounts(snapshot: AiSearchSnapshot): Array<{ question: string; category: string; tally: OutcomeTally }> {
  const groups = new Map<string, { calls: typeof snapshot.calls; category: string }>();
  for (const call of snapshot.calls) {
    if (!isCommercial(call) || questionRole(call) !== "unbranded_discovery") continue;
    const question = cleanPrompt(call.prompt);
    if (!question) continue;
    const group = groups.get(question) ?? { calls: [], category: call.category ?? "" };
    group.calls.push(call);
    groups.set(question, group);
  }
  return [...groups.entries()]
    .map(([question, group]) => ({ question, category: group.category, tally: tallyCommercial(group.calls) }))
    .filter((entry) => entry.tally.resolved > 0);
}

/**
 * The weakest engine on unbranded discovery, among the engines with `MIN_ANSWERS` resolved
 * answers in the window. A priority action when it trails the best of them by `GAP_POINTS` or
 * more, else a watch line. Engines under the floor are held.
 */
export function weakestEngine(snapshot: AiSearchSnapshot): FocusRead {
  const held: HeldItem[] = [];
  const enough = engineCounts(snapshot).filter((engine) => {
    if (engine.tally.resolved >= MIN_ANSWERS) return true;
    held.push({
      id: `focus:engine:${engine.key}`,
      label: engineLabel(engine.key),
      guardrail: "data",
      detail: `${formatRatio(engine.tally.fenderWins, engine.tally.resolved)} resolved answers in the window`,
    });
    return false;
  });
  const weakest = enough[0];
  if (!weakest) return { actions: [], held };
  const id = `focus:engine:${weakest.key}`;
  const label = `${engineLabel(weakest.key)} names ${leadBrand()} least`;
  if (enough.length < 2) {
    held.push({ id, label, guardrail: "data", detail: "no other engine has 30 resolved answers in the window to compare" });
    return { actions: [], held };
  }
  const best = Math.max(...enough.slice(1).map((engine) => rate(engine.tally)));
  const gap = best - rate(weakest.tally);
  const tier = tierOf(gap);
  const engine = engineLabel(weakest.key);
  const action: FocusAction = {
    id,
    focus: "engine",
    tier,
    label,
    numerator: weakest.tally.fenderWins,
    denominator: weakest.tally.resolved,
    fact: `${leadBrand()} is named most in ${formatRatio(weakest.tally.fenderWins, weakest.tally.resolved)} resolved unbranded discovery answers on ${engine}, the lowest of the engines checked.`,
    action: tier === "priority" ? `Review the ${engine} answers that name another brand most, and the sources they cite.` : `Watch ${engine}.`,
    open: RUN_DETAILS,
    evidence: { field: "role", value: "unbranded_discovery/resolved", engine: weakest.key },
    categories: [],
    siteType: null,
    pages: [],
    trend: null,
    gap,
    partial: null,
  };
  return { actions: [action], held };
}

/**
 * The five weakest unbranded discovery questions with `MIN_ANSWERS` resolved answers in the
 * window. Each is a priority action when it trails the best such question by `GAP_POINTS` or
 * more, else a watch line. Questions under the floor are held.
 */
export function weakestQuestions(snapshot: AiSearchSnapshot): FocusRead {
  const held: HeldItem[] = [];
  const idOf = (question: string) => `focus:question:${question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const enough = questionCounts(snapshot).filter((entry) => {
    if (entry.tally.resolved >= MIN_ANSWERS) return true;
    held.push({
      id: idOf(entry.question),
      label: entry.question,
      guardrail: "data",
      detail: `${formatRatio(entry.tally.fenderWins, entry.tally.resolved)} resolved answers in the window`,
    });
    return false;
  });
  const best = enough.reduce((top, entry) => Math.max(top, rate(entry.tally)), 0);
  const weakest = enough
    .slice()
    .sort((a, b) => rate(a.tally) - rate(b.tally) || a.question.localeCompare(b.question))
    .slice(0, WEAK_QUESTION_LIMIT);
  const actions = weakest.map<FocusAction>((entry) => {
    const gap = best - rate(entry.tally);
    const tier = tierOf(gap);
    return {
      id: idOf(entry.question),
      focus: "question",
      tier,
      label: `"${entry.question}"`,
      numerator: entry.tally.fenderWins,
      denominator: entry.tally.resolved,
      fact: `${leadBrand()} is named most in ${formatRatio(entry.tally.fenderWins, entry.tally.resolved)} resolved answers to "${entry.question}".`,
      action: tier === "priority" ? `Word the ${brandSite()} product pages to answer this question.` : "Watch this question.",
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
    };
  });
  return { actions, held };
}

/**
 * Cited sites whose share of shopping answers with sources moved most between the previous 30
 * days and the current 30 days. A candidate holds `MOVING_SITE_MIN_SHARE` in either window and is
 * cited in `MOVING_SITE_MIN_ANSWERS` answers in the current one. It is flagged when its share
 * changed by `MOVING_SITE_CHANGE` or more of its earlier share (20% to 22%, or 20% to 18%).
 * Brand-owned and Unclassified sites are left out; the brand's own site is the own-page action's.
 * Skipped, and held, when either window has fewer than `MIN_ANSWERS` shopping answers with sources.
 */
export function movingSites(current: AiSearchSnapshot | null, previous: AiSearchSnapshot | null): FocusRead {
  if (!current) return { actions: [], held: [] };
  const now = runShares(current);
  const before = previous ? runShares(previous) : null;
  const priorAnswers = before?.read.answersWithCitation ?? 0;
  if (!before || priorAnswers < MIN_ANSWERS || now.read.answersWithCitation < MIN_ANSWERS) {
    const held: HeldItem = {
      id: "focus:site",
      label: "Cited sites rising or falling",
      guardrail: "data",
      detail: `${now.read.answersWithCitation} shopping answers with sources in the last 30 days and ${priorAnswers} in the 30 days before`,
    };
    return { actions: [], held: [held] };
  }
  const moves: Array<{ domain: string; type: SiteType; relative: number; was: number; is: number }> = [];
  for (const domain of new Set([...now.byDomain.keys(), ...before.byDomain.keys()])) {
    const type = siteType(domain);
    if (!sourceActionWording(type, domain)) continue;
    const is = shareIn(now, domain);
    const was = shareIn(before, domain);
    if (Math.max(is, was) < MOVING_SITE_MIN_SHARE) continue;
    if (answersOf(now.byDomain.get(domain) ?? []) < MOVING_SITE_MIN_ANSWERS) continue;
    const relative = was > 0 ? (is - was) / was : Number.POSITIVE_INFINITY;
    if (Math.abs(relative) < MOVING_SITE_CHANGE) continue;
    moves.push({ domain, type, relative, was, is });
  }
  const pick = (sign: 1 | -1) =>
    moves
      .filter((move) => Math.sign(move.relative) === sign)
      .sort((a, b) => sign * (b.relative - a.relative) || a.domain.localeCompare(b.domain))
      .slice(0, MOVING_SITE_LIMIT);
  const actions = [...pick(1), ...pick(-1)].map<FocusAction>((move) => {
    const rows = now.byDomain.get(move.domain) ?? [];
    const answers = answersOf(rows);
    const earlier = answersOf(before.byDomain.get(move.domain) ?? []);
    const shares = `${formatPct(100 * move.is)} of shopping answers with sources in the last 30 days (${formatRatio(answers, now.read.answersWithCitation)}), against ${formatPct(100 * move.was)} (${formatRatio(earlier, before.read.answersWithCitation)}) in the 30 days before.`;
    return {
      id: `focus:site:${move.domain}`,
      focus: "site",
      tier: "priority",
      label: `${move.domain} ${move.relative > 0 ? "rising" : "falling"}`,
      numerator: answers,
      denominator: now.read.answersWithCitation,
      fact: `${move.domain} is cited in ${shares}`,
      action: sourceActionWording(move.type, move.domain)!,
      open: CITATIONS,
      evidence: { field: "domain", value: move.domain },
      categories: [],
      siteType: move.type,
      pages: citedPages(rows),
      trend: `It is cited in ${shares}`,
      gap: Number.isFinite(move.relative) ? 100 * Math.abs(move.relative) : 100,
      partial: null,
    };
  });
  return { actions, held: [] };
}

/** Every 21d focus item for the two windows, in plan order: engine, questions, then sites. */
export function focusActions(input: { windows: FocusWindows | null; focus?: PlanFocus }): FocusRead {
  if (!input.windows) return { actions: [], held: [] };
  const focus = input.focus ?? BRAND_FOCUS;
  const current = input.windows.current ? focusSnapshot(input.windows.current, focus) : null;
  const previous = input.windows.previous ? focusSnapshot(input.windows.previous, focus) : null;
  const reads: FocusRead[] = [];
  if (current) reads.push(weakestEngine(current), weakestQuestions(current));
  reads.push(movingSites(current, previous));
  return { actions: reads.flatMap((read) => read.actions), held: reads.flatMap((read) => read.held) };
}
