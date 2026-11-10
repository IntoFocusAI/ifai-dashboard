import {
  callOutcome,
  cleanPrompt,
  isCommercial,
  isError,
  isFailedResultEngine,
  modelLabel,
  tallyCommercial,
  type OutcomeTally,
} from "@/lib/ai-search/run-metrics";
import { storedQuestionRole } from "@/lib/ai-search/stored-question-roles";
import type { AiCallRow } from "@/lib/ai-search/types";
import { activeClientKey } from "@/lib/client/active-client";

/**
 * What kind of question a stored prompt is: the role the client's battery stores for that
 * wording when it stores one (stored-question-roles.ts), else read from its text.
 * Product-fact probes (`prompt_kind = probe`) stay their own bucket.
 * The other five roles are commercial prompts that must not share one win rate.
 */
export const QUESTION_ROLES = [
  "unbranded_discovery",
  "brand_associated_discovery",
  "branded_consideration",
  "shopping_guidance",
  "product_fact",
  "probe",
  "other",
] as const;

export type QuestionRole = (typeof QUESTION_ROLES)[number];

export const ROLE_LABELS: Record<QuestionRole, string> = {
  unbranded_discovery: "Unbranded discovery",
  brand_associated_discovery: "Brand-associated discovery",
  branded_consideration: "Branded consideration",
  shopping_guidance: "Shopping guidance",
  product_fact: "Product-fact question",
  probe: "Product fact check",
  other: "Unclassified shopping question",
};

/** The two rates the AI Search headline leads with. */
export const HEADLINE_ROLES = ["unbranded_discovery", "branded_consideration"] as const;

/** Named brands and model lines. A model line such as Stratocaster counts as brand-associated. */
const BRAND =
  /\b(fender|squier|stratocaster|telecaster|acoustasonic|yamaha|gibson|epiphone|prs|sire|ibanez|taylor|boss|katana|spark|les paul|jaguar|mustang|precision bass|jazz bass|affinity)\b/i;

/** Asks how a named product is built, or how two models differ, rather than which to buy. */
const PRODUCT_FACT = /pickup types?|tube types?|biasing|tonal differences?|\bdifferences?\b|different from/i;

/** Asks how to shop, not which product to choose. */
const SHOPPING_GUIDANCE = /how much should|should .+ spend/i;

/** Names options and asks the shopper to choose, or asks whether a named product is a good buy. */
const CONSIDERATION = /\bvs\.?\b|\bversus\b|\bcomparison\b|\bis\b.+\bgood\b/i;

/** Asks what to buy, without naming the contenders. */
const DISCOVERY = /\bbest\b|\balternative\b/i;

export function questionRole(row: {
  prompt_kind?: string | null;
  prompt?: string | null;
}): QuestionRole {
  if (row.prompt_kind === "probe") return "probe";
  // A battery that stores each prompt's role is the truth for that client (Ledlenser).
  const stored = storedQuestionRole(activeClientKey(), cleanPrompt(row.prompt));
  if (stored) return stored;
  const text = row.prompt ?? "";
  if (PRODUCT_FACT.test(text)) return "product_fact";
  if (SHOPPING_GUIDANCE.test(text)) return "shopping_guidance";
  const named = BRAND.test(text);
  if (named && CONSIDERATION.test(text)) return "branded_consideration";
  if (named && DISCOVERY.test(text)) return "brand_associated_discovery";
  if (!named && DISCOVERY.test(text)) return "unbranded_discovery";
  return "other";
}

export type RoleTally = OutcomeTally & { role: QuestionRole };

export function roleTallies(rows: AiCallRow[]): RoleTally[] {
  return QUESTION_ROLES.map((role) => ({
    role,
    ...tallyCommercial(rows.filter((row) => questionRole(row) === role)),
  })).filter((tally) => tally.calls > 0 || tally.role === "unbranded_discovery" || tally.role === "branded_consideration");
}

export function roleTally(rows: AiCallRow[], role: QuestionRole): RoleTally {
  return { role, ...tallyCommercial(rows.filter((row) => questionRole(row) === role)) };
}

export type HeadlineRole = (typeof HEADLINE_ROLES)[number];

export function isHeadlineRole(role: QuestionRole): role is HeadlineRole {
  return role === "unbranded_discovery" || role === "branded_consideration";
}

/** One engine or category, with a separate tally for every question role. */
export type RoleGroupTally = {
  key: string;
  models: string[];
  roles: Record<QuestionRole, OutcomeTally>;
};

function rolesFor(rows: AiCallRow[]): Record<QuestionRole, OutcomeTally> {
  return Object.fromEntries(
    QUESTION_ROLES.map((role) => [role, tallyCommercial(rows.filter((row) => questionRole(row) === role))]),
  ) as Record<QuestionRole, OutcomeTally>;
}

function groupRoleTallies(rows: AiCallRow[], keyOf: (row: AiCallRow) => string): RoleGroupTally[] {
  const buckets = new Map<string, AiCallRow[]>();
  for (const row of rows) {
    if (!isCommercial(row)) continue;
    const key = keyOf(row);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  return [...buckets.entries()].map(([key, bucket]) => {
    const answered = bucket.filter((row) => !isError(row));
    return {
      key,
      models: [...new Set((answered.length ? answered : bucket).map((row) => modelLabel(row.model)))].sort(),
      roles: rolesFor(bucket),
    };
  });
}

/** Commercial calls split by engine. Role totals across engines match `roleTally`. */
export function engineRoleTallies(rows: AiCallRow[]): RoleGroupTally[] {
  return groupRoleTallies(rows, (row) => (row.engine ?? "").toLowerCase()).sort(
    (a, b) =>
      b.roles.unbranded_discovery.resolved +
      b.roles.branded_consideration.resolved -
      (a.roles.unbranded_discovery.resolved + a.roles.branded_consideration.resolved) ||
      a.key.localeCompare(b.key),
  );
}

/** Answered commercial calls for one engine across every question role. */
export function roleGroupAnswered(group: RoleGroupTally): number {
  return QUESTION_ROLES.reduce((sum, role) => sum + group.roles[role].answered, 0);
}

/** Commercial calls for one engine across every question role. */
export function roleGroupCalls(group: RoleGroupTally): number {
  return QUESTION_ROLES.reduce((sum, role) => sum + group.roles[role].calls, 0);
}

/**
 * Engines that returned at least one commercial answer.
 * An engine whose calls are all errors or all empty is not a client result.
 */
export function engineResultRoleTallies(rows: AiCallRow[]): RoleGroupTally[] {
  return engineRoleTallies(rows).filter(
    (engine) => !isFailedResultEngine({ calls: roleGroupCalls(engine), answered: roleGroupAnswered(engine) }),
  );
}

/** Commercial calls split by category. Role totals across categories match `roleTally`. */
export function categoryRoleTallies(rows: AiCallRow[]): RoleGroupTally[] {
  return groupRoleTallies(rows, (row) => row.category ?? "").sort((a, b) => a.key.localeCompare(b.key));
}

export function sumRoleTallies(groups: readonly RoleGroupTally[], role: QuestionRole): OutcomeTally {
  const tally: OutcomeTally = {
    calls: 0,
    answered: 0,
    resolved: 0,
    fenderWins: 0,
    disqualified: 0,
    competitorWins: 0,
    unresolved: 0,
    errors: 0,
    unsupported: 0,
    winPct: null,
  };
  for (const group of groups) {
    const part = group.roles[role];
    tally.calls += part.calls;
    tally.answered += part.answered;
    tally.resolved += part.resolved;
    tally.fenderWins += part.fenderWins;
    tally.disqualified += part.disqualified;
    tally.competitorWins += part.competitorWins;
    tally.unresolved += part.unresolved;
    tally.errors += part.errors;
    tally.unsupported += part.unsupported;
  }
  tally.winPct = tally.resolved > 0 ? (100 * tally.fenderWins) / tally.resolved : null;
  return tally;
}

/**
 * Aside counts for Category Battlecards.
 * Unresolved and errors stay on the two Fender-lead rates.
 * Competitor wins use unbranded discovery only.
 */
export function headlineAside(group: RoleGroupTally): { unresolved: number; errors: number; competitorWins: number } {
  const parts = HEADLINE_ROLES.map((role) => group.roles[role]);
  return {
    unresolved: parts.reduce((sum, part) => sum + part.unresolved, 0),
    errors: parts.reduce((sum, part) => sum + part.errors, 0),
    competitorWins: group.roles.unbranded_discovery.competitorWins,
  };
}

/** Competitor wins on unbranded discovery only. Branded consideration is not in this count. */
export function headlineCompetitorWins(rows: AiCallRow[]): Array<{ brand: string; wins: number }> {
  const brands = new Map<string, number>();
  for (const row of rows) {
    if (questionRole(row) !== "unbranded_discovery") continue;
    if (callOutcome(row) !== "competitor_win") continue;
    const brand = row.primary_brand?.trim() || "Brand not recorded";
    brands.set(brand, (brands.get(brand) ?? 0) + 1);
  }
  return [...brands.entries()]
    .map(([brand, wins]) => ({ brand, wins }))
    .sort((a, b) => b.wins - a.wins || a.brand.localeCompare(b.brand));
}
