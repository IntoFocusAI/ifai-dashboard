/**
 * Roadmap and Action Items: AI Actuation items (SC-03 in the shared plan; gap audit
 * recommendations 1 and 2, approved by Brian Magazu 18 Nov 2026).
 *
 * Built only from the client's stored Actuation basis (public.actuation_basis, bundle.actuation)
 * and the date-pill window's Citation Ecosystem read. When the basis did not load, no item shows.
 * - A program (P1 community, P2 PR and reviewer outreach) not in place: confirm it to IntoFocus
 *   (Days 1 to 30), with the five community or publication sites AI cites most in shopping
 *   answers as suggested targets, whatever their share.
 * - A program in place whose activity (E2 or E3) is under its target: post the activity and send
 *   the links (E2 Days 31 to 60, E3 Days 61 to 90).
 * - A program in place with 14 days or fewer left of its 90-day verification: renew it (Days 1 to 30).
 * - E1 (brand pages cited in unbranded shopping answers) under its target joins the existing
 *   brand-pages row as one sentence; it never adds a row.
 * Wording is a draft for Brian Magazu's sign-off.
 */

import { formatDay } from "@/lib/ai-search/history-eligibility";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { brandName } from "@/lib/brand-copy";
import { FACTOR_LABELS, type ClientBasis } from "@/lib/fender-canvas/actuation-records";
import {
  ACTUATION_WEIGHTS,
  E1_TARGET,
  scoreActuation,
  type OwnedAnswersBasis,
  type ProgramFactorId,
} from "@/lib/fender-canvas/actuation-score";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import type { OwnPageAction } from "@/lib/fender-canvas/roadmap-own-pages";
import { answersOf, runShares, siteType } from "@/lib/fender-canvas/roadmap-sources";

/** Suggested target sites listed per program, even when each is under the 10% source-action threshold. */
export const ACTUATION_TARGET_LIMIT = 5;
/** A program in place shows a renewal item in its last 14 days. */
export const ACTUATION_RENEW_DAYS = 14;

export type SuggestedTarget = { domain: string; answers: number; total: number };
export type ActuationTargets = { community: SuggestedTarget[]; publication: SuggestedTarget[] };

export const NO_TARGETS: ActuationTargets = { community: [], publication: [] };

/**
 * The community and publication sites AI cites most in the window's shopping answers with sources,
 * top five of each by answers, then by name. Empty lists while the window is not read.
 */
export function suggestedTargets(
  snapshot: Pick<AiSearchSnapshot, "calls" | "citations"> | null,
  limit = ACTUATION_TARGET_LIMIT,
): ActuationTargets {
  if (!snapshot) return NO_TARGETS;
  const shares = runShares(snapshot as AiSearchSnapshot);
  const total = shares.read.answersWithCitation;
  if (total <= 0) return NO_TARGETS;
  const ranked = (type: "community" | "publication") =>
    [...shares.byDomain.entries()]
      .filter(([domain]) => siteType(domain) === type)
      .map(([domain, rows]) => ({ domain, answers: answersOf(rows), total }))
      .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain))
      .slice(0, limit);
  return { community: ranked("community"), publication: ranked("publication") };
}

export type ActuationRule = "confirm" | "activity" | "renew";

export type ActuationAction = {
  id: string;
  factor: ProgramFactorId;
  rule: ActuationRule;
  phase: "days_1_30" | "days_31_60" | "days_61_90";
  label: string;
  percent: string;
  ratio: string | null;
  fact: string;
  action: string;
  /** Suggested target sites, on a confirm item. */
  targets: { label: string; sites: SuggestedTarget[] } | null;
};

const PROGRAM = {
  P1: {
    item: "E2" as const,
    noun: "community response program",
    sites: "communities",
    activity: "community responses",
    confirm: "Confirm your community response program to IntoFocus: who owns it, which communities, and how many responses every 30 days.",
    post: (target: string) => `Post responses in the target communities and send IntoFocus the links until ${target} are verified.`,
    suggested: "Suggested communities",
  },
  P2: {
    item: "E3" as const,
    noun: "PR and reviewer outreach program",
    sites: "publications",
    activity: "placements",
    confirm: "Confirm your PR and reviewer outreach program to IntoFocus: who owns it, which publications, and how many placements every 90 days.",
    post: (target: string) => `Earn placements in the target publications and send IntoFocus the links until ${target} are verified.`,
    suggested: "Suggested publications",
  },
};

/**
 * The Actuation items the stored basis supports on `asOf` (UTC ISO date). None when the basis did
 * not load: an unread record never becomes an item.
 */
export function actuationActions(input: {
  basis: ClientBasis | null | undefined;
  asOf: string;
  targets?: ActuationTargets;
}): ActuationAction[] {
  if (!input.basis) return [];
  const targets = input.targets ?? NO_TARGETS;
  const score = scoreActuation({ asOf: input.asOf, programs: input.basis.programs, items: input.basis.items, ownedAnswers: null });
  const out: ActuationAction[] = [];
  for (const factor of ["P1", "P2"] as const) {
    const copy = PROGRAM[factor];
    const program = score.factors[factor];
    const weight = ACTUATION_WEIGHTS[factor];
    if (!program.basis) {
      const sites = factor === "P1" ? targets.community : targets.publication;
      out.push({
        id: `actuation:${factor}:confirm`,
        factor,
        rule: "confirm",
        phase: "days_1_30",
        label: FACTOR_LABELS[factor],
        percent: `0 of ${weight} points`,
        ratio: null,
        fact: `The ${copy.noun} is not in place, so it scores 0 of ${weight} AI Actuation points and ${copy.activity} have no target.`,
        action: copy.confirm,
        targets: sites.length ? { label: copy.suggested, sites } : null,
      });
      continue;
    }
    const activity = score.factors[copy.item];
    const { count, target } = activity.basis;
    if (target != null && count < target) {
      const goal = formatInt(target);
      out.push({
        id: `actuation:${copy.item}:activity`,
        factor,
        rule: "activity",
        phase: factor === "P1" ? "days_31_60" : "days_61_90",
        label: FACTOR_LABELS[copy.item],
        percent: formatPct((100 * count) / target),
        ratio: formatRatio(count, target),
        fact: `${formatRatio(count, target)} ${copy.activity} verified in the last 90 days.`,
        action: copy.post(goal),
        targets: null,
      });
    }
    const expiry = score.expiries.find((due) => due.factor === factor);
    if (expiry && expiry.daysLeft <= ACTUATION_RENEW_DAYS) {
      const until = formatDay(expiry.expiresOn);
      out.push({
        id: `actuation:${factor}:renew`,
        factor,
        rule: "renew",
        phase: "days_1_30",
        label: `${FACTOR_LABELS[factor]} renewal`,
        percent: `${formatInt(expiry.daysLeft)} ${expiry.daysLeft === 1 ? "day" : "days"} left`,
        ratio: null,
        fact: `The ${copy.noun} counts until ${until}, 90 days after IntoFocus verified it.`,
        action: `Send IntoFocus current evidence for the ${copy.noun} before ${until} so it keeps its ${weight} points.`,
        targets: null,
      });
    }
  }
  return out;
}

/**
 * E1 joins the brand-pages row: one sentence after its fact when brand pages are cited in fewer
 * unbranded shopping answers than the target. The row is unchanged otherwise, and no row is added.
 */
export function withOwnedAnswersGap(own: OwnPageAction | null, owned: OwnedAnswersBasis | null): OwnPageAction | null {
  if (!own || !owned || owned.resolved <= 0 || E1_TARGET == null) return own;
  const share = owned.withOwned / owned.resolved;
  if (share >= E1_TARGET) return own;
  const gap = `${brandName()} pages are cited in ${formatPct(100 * share)} of unbranded shopping answers (${formatRatio(owned.withOwned, owned.resolved)}), against the AI Actuation target of ${formatPct(100 * E1_TARGET, 0)}.`;
  return { ...own, fact: `${own.fact} ${gap}` };
}

/** "648 of 6,215 answers": the shopping answers with sources that cite a suggested site. */
export function targetAnswers(site: SuggestedTarget): string {
  return `${formatRatio(site.answers, site.total)} answers`;
}
