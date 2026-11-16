/**
 * SC-03 AI Actuation score (decisions 77, 78, 96). Pure: no reads, no clock. Every caller passes
 * the day it scores for (`asOf`, an ISO date in UTC), so the staff page, the client figure and the
 * tests agree.
 *
 * Factors and weights (decision 96, may be tuned later):
 *   P1 community response program               20  planned
 *   P2 publication and reviewer outreach program 20  planned
 *   E1 owned answers                            30  measured (Citation Ecosystem read)
 *   E2 community responses posted               15  logged, staff-verified
 *   E3 placements earned                        15  logged, staff-verified
 *
 * A program counts only with an owner, an evidence link, a verification date and an expiry after
 * `asOf` (verification + 90 days). Anything less scores 0 and reads exactly like a program never
 * recorded: no dates, no counts (decision 78).
 */

export type ActuationFactorId = "P1" | "P2" | "E1" | "E2" | "E3";
export type ProgramFactorId = "P1" | "P2";
export type ItemFactorId = "E2" | "E3";

export const ACTUATION_FACTORS: readonly ActuationFactorId[] = ["P1", "P2", "E1", "E2", "E3"];

export const ACTUATION_WEIGHTS: Readonly<Record<ActuationFactorId, number>> = {
  P1: 20,
  P2: 20,
  E1: 30,
  E2: 15,
  E3: 15,
};

/** A program's verification holds this many days; E2 and E3 count items posted in this window. */
export const ACTUATION_VALID_DAYS = 90;

/** Days before expiry when a reminder is due (decision 77). The due-soon list starts at the first. */
export const EXPIRY_REMINDER_DAYS = [30, 14, 3] as const;
export type ExpiryReminder = (typeof EXPIRY_REMINDER_DAYS)[number];

/**
 * E1 target: the share (0 to 1) of unbranded discovery answers citing a brand page that earns full
 * E1 points (30, capped). 15%, about what the strongest competitor brands reach in their best
 * product category (decision 98, Brian). A null target would make E1 read as pending with no points.
 */
export const E1_TARGET: number | null = 0.15;

/** E1's tooltip for phase 2 to show beside the figure (decision 98), in the client's brand name. */
export function e1Tooltip(brand: string): string {
  const target = E1_TARGET == null ? "" : ` Target: ${Math.round(E1_TARGET * 100)}%, about what the strongest competitor brands reach in their best product category.`;
  return (
    `Owned answers. The share of AI answers to shopping questions that do not name a brand which cite at least one page on ${brand}'s own sites. ` +
    `Each answer counts once, however many ${brand} pages it cites. Only AI engines that cite sources are counted.` +
    target
  );
}

/** A P1 or P2 record as the score needs it. Staff records and the client basis both map to this. */
export type ProgramBasis = {
  factor: ProgramFactorId;
  hasOwner: boolean;
  hasEvidence: boolean;
  /** ISO date the evidence was verified, or null. */
  verifiedOn: string | null;
  targetDomainCount: number;
  /** P1: responses per 30 days. */
  cadencePer30Days: number | null;
  /** P2: placements per 90 days. */
  targetCount: number | null;
};

/** E1 inputs from the Citation Ecosystem read: unbranded discovery answers citing a brand page. */
export type OwnedAnswersBasis = { withOwned: number; resolved: number };

/** One engine's unbranded discovery answers in the window, from the Citation Ecosystem read. */
export type EngineOwnedAnswers = {
  engine: string;
  /** Links this engine's answers cited in the window (any site, any question). */
  citations: number;
  withOwned: number;
  resolved: number;
};

/**
 * E1 counts only engines that returned at least one citation in the window (decision 97). Decided
 * from the data, not the engine type, so an API engine joins once it returns citations. Null when
 * no engine qualifies.
 */
export function ownedAnswersFromEngines(engines: readonly EngineOwnedAnswers[]): OwnedAnswersBasis | null {
  const counted = engines.filter((engine) => engine.citations > 0);
  if (counted.length === 0) return null;
  return counted.reduce(
    (sum, engine) => ({ withOwned: sum.withOwned + engine.withOwned, resolved: sum.resolved + engine.resolved }),
    { withOwned: 0, resolved: 0 },
  );
}

export type ActuationInputs = {
  asOf: string;
  programs: readonly ProgramBasis[];
  /** Verified E2 / E3 items posted in the 90 days ending `asOf` (see itemsInWindow). */
  items: Readonly<Record<ItemFactorId, number>>;
  ownedAnswers: OwnedAnswersBasis | null;
  /** Defaults to E1_TARGET. */
  e1Target?: number | null;
};

export type ProgramFactorResult = {
  id: ProgramFactorId;
  weight: number;
  points: number;
  status: "in_place" | "not_in_place";
  basis: {
    verifiedOn: string;
    expiresOn: string;
    targetDomainCount: number;
    cadencePer30Days: number | null;
    targetCount: number | null;
  } | null;
};

export type ItemFactorResult = {
  id: ItemFactorId;
  weight: number;
  points: number;
  status: "scored" | "no_target";
  basis: { count: number; target: number | null; windowDays: number };
};

export type OwnedAnswersResult = {
  id: "E1";
  weight: number;
  points: number;
  status: "scored" | "pending" | "no_answers";
  basis: { withOwned: number; resolved: number; target: number | null } | null;
};

export type ActuationExpiry = {
  factor: ProgramFactorId;
  expiresOn: string;
  daysLeft: number;
  reminder: ExpiryReminder;
};

export type ActuationScore = {
  /** 0 to 100, rounded. */
  score: number;
  /** Points the factors can earn today: 100, or 70 while E1 is pending. */
  available: number;
  factors: {
    P1: ProgramFactorResult;
    P2: ProgramFactorResult;
    E1: OwnedAnswersResult;
    E2: ItemFactorResult;
    E3: ItemFactorResult;
  };
  /** In-place programs expiring within 30 days, soonest first. */
  expiries: ActuationExpiry[];
};

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(iso: string): number {
  if (!ISO_DAY.test(iso)) throw new Error(`Not an ISO date: ${iso}`);
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Not an ISO date: ${iso}`);
  return Math.round(ms / DAY_MS);
}

function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** The UTC calendar day of a moment, as the database's current_date reads it. */
export function isoDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoFromDay(dayNumber(iso) + days);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso);
}

/** verified_on + 90 days, as the database's generated expires_on. */
export function expiresOn(verifiedOn: string): string {
  return addDays(verifiedOn, ACTUATION_VALID_DAYS);
}

/** Owner, evidence, verification date, and an expiry after asOf. A future verification date does not count. */
export function programInPlace(program: ProgramBasis | undefined, asOf: string): boolean {
  if (!program || !program.hasOwner || !program.hasEvidence || !program.verifiedOn) return false;
  if (!ISO_DAY.test(program.verifiedOn)) return false;
  if (daysBetween(program.verifiedOn, asOf) < 0) return false;
  return daysBetween(asOf, expiresOn(program.verifiedOn)) > 0;
}

/** Verified items posted in the 90 days ending asOf (posted after asOf - 90, on or before asOf). */
export function itemsInWindow(
  items: ReadonlyArray<{ postedOn: string; verifiedOn: string | null }>,
  asOf: string,
): number {
  return items.filter((item) => {
    if (!item.verifiedOn || !ISO_DAY.test(item.postedOn)) return false;
    const age = daysBetween(item.postedOn, asOf);
    return age >= 0 && age < ACTUATION_VALID_DAYS;
  }).length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaled(weight: number, count: number, target: number | null): number {
  if (target == null || target <= 0) return 0;
  return weight * Math.min(1, Math.max(0, count) / target);
}

function programResult(id: ProgramFactorId, program: ProgramBasis | undefined, asOf: string): ProgramFactorResult {
  const weight = ACTUATION_WEIGHTS[id];
  if (!program || !programInPlace(program, asOf)) return { id, weight, points: 0, status: "not_in_place", basis: null };
  const verifiedOn = program.verifiedOn as string;
  return {
    id,
    weight,
    points: weight,
    status: "in_place",
    basis: {
      verifiedOn,
      expiresOn: expiresOn(verifiedOn),
      targetDomainCount: program.targetDomainCount,
      cadencePer30Days: id === "P1" ? program.cadencePer30Days : null,
      targetCount: id === "P2" ? program.targetCount : null,
    },
  };
}

/** E2 target: the P1 cadence over 90 days. E3 target: the P2 target count. No program, no target. */
function itemResult(id: ItemFactorId, count: number, program: ProgramFactorResult): ItemFactorResult {
  const weight = ACTUATION_WEIGHTS[id];
  const raw =
    program.basis == null
      ? null
      : id === "E2"
        ? program.basis.cadencePer30Days == null
          ? null
          : program.basis.cadencePer30Days * (ACTUATION_VALID_DAYS / 30)
        : program.basis.targetCount;
  const target = raw != null && raw > 0 ? raw : null;
  return {
    id,
    weight,
    points: round1(scaled(weight, count, target)),
    status: target == null ? "no_target" : "scored",
    basis: { count: Math.max(0, count), target, windowDays: ACTUATION_VALID_DAYS },
  };
}

function ownedAnswersResult(owned: OwnedAnswersBasis | null, target: number | null): OwnedAnswersResult {
  const weight = ACTUATION_WEIGHTS.E1;
  const basis = owned ? { withOwned: owned.withOwned, resolved: owned.resolved, target } : null;
  if (target == null || !(target > 0)) return { id: "E1", weight, points: 0, status: "pending", basis };
  if (!owned || owned.resolved <= 0) return { id: "E1", weight, points: 0, status: "no_answers", basis };
  const share = owned.withOwned / owned.resolved;
  return { id: "E1", weight, points: round1(weight * Math.min(1, share / target)), status: "scored", basis };
}

/** In-place programs whose expiry is within 30 days of asOf, with the reminder band each is in. */
export function expiriesDue(factors: readonly ProgramFactorResult[], asOf: string): ActuationExpiry[] {
  const due: ActuationExpiry[] = [];
  for (const factor of factors) {
    if (!factor.basis) continue;
    const daysLeft = daysBetween(asOf, factor.basis.expiresOn);
    const reminder = [...EXPIRY_REMINDER_DAYS].reverse().find((band) => daysLeft <= band);
    if (reminder == null) continue;
    due.push({ factor: factor.id, expiresOn: factor.basis.expiresOn, daysLeft, reminder });
  }
  return due.sort((a, b) => a.daysLeft - b.daysLeft || a.factor.localeCompare(b.factor));
}

export function scoreActuation(inputs: ActuationInputs): ActuationScore {
  const { asOf } = inputs;
  dayNumber(asOf);
  const byFactor = new Map(inputs.programs.map((program) => [program.factor, program]));
  const P1 = programResult("P1", byFactor.get("P1"), asOf);
  const P2 = programResult("P2", byFactor.get("P2"), asOf);
  const e1Target = inputs.e1Target === undefined ? E1_TARGET : inputs.e1Target;
  const E1 = ownedAnswersResult(inputs.ownedAnswers, e1Target);
  const E2 = itemResult("E2", inputs.items.E2, P1);
  const E3 = itemResult("E3", inputs.items.E3, P2);
  const raw = P1.points + P2.points + E1.points + E2.points + E3.points;
  return {
    score: Math.round(raw),
    available: E1.status === "pending" ? 100 - ACTUATION_WEIGHTS.E1 : 100,
    factors: { P1, P2, E1, E2, E3 },
    expiries: expiriesDue([P1, P2], asOf),
  };
}
