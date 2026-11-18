/**
 * SC-03 AI Actuation as the client sees it: the score and its basis, factor by factor (decisions 77,
 * 78, 96 to 98). Counts and dates only, never staff names, notes, or links. A factor that lapsed
 * reads exactly like one never in place.
 */

import { formatDay } from "@/lib/ai-search/history-eligibility";
import type { OwnedAnswersRead } from "@/lib/fender-canvas/actuation-e1";
import { FACTOR_LABELS } from "@/lib/fender-canvas/actuation-records";
import {
  ACTUATION_FACTORS,
  e1Tooltip,
  type ActuationFactorId,
  type ActuationScore,
  type ItemFactorResult,
  type ProgramFactorResult,
} from "@/lib/fender-canvas/actuation-score";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import type { PillarScore } from "@/lib/fender-canvas/consensus-scores";
import { formatInt, formatPct } from "@/lib/fender-canvas/format";

export type ActuationFactorRow = {
  id: ActuationFactorId;
  name: string;
  weight: number;
  points: number;
  /** "9 of 30 points". */
  pointsLabel: string;
  basis: string;
  /** Custom tooltip on the factor name (E1: the decision 98 text). */
  tip: string | null;
};

export const ACTUATION_NOT_IN_PLACE = "Not in place.";

function pointsText(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

export function factorPointsLabel(points: number, weight: number): string {
  return `${pointsText(points)} of ${weight} points`;
}

function plural(count: number, one: string, many: string): string {
  return `${formatInt(count)} ${count === 1 ? one : many}`;
}

function programBasis(factor: ProgramFactorResult): string {
  if (!factor.basis) return ACTUATION_NOT_IN_PLACE;
  const { verifiedOn, expiresOn, targetDomainCount, cadencePer30Days, targetCount } = factor.basis;
  const dates = `In place. Verified ${formatDay(verifiedOn)}, counts until ${formatDay(expiresOn)}.`;
  if (factor.id === "P1") {
    const cadence = cadencePer30Days == null ? "" : ` ${plural(cadencePer30Days, "response", "responses")} every 30 days.`;
    return `${dates} ${plural(targetDomainCount, "target community", "target communities")}.${cadence}`;
  }
  const target = targetCount == null ? "" : ` ${plural(targetCount, "placement", "placements")} every 90 days.`;
  return `${dates} ${plural(targetDomainCount, "target publication", "target publications")}.${target}`;
}

const ITEM_NOUN: Record<ItemFactorResult["id"], { one: string; many: string; program: string }> = {
  E2: { one: "community response posted", many: "community responses posted", program: "community response program" },
  E3: { one: "placement earned", many: "placements earned", program: "publication and reviewer outreach program" },
};

function itemBasis(factor: ItemFactorResult): string {
  const noun = ITEM_NOUN[factor.id];
  const count = `${plural(factor.basis.count, noun.one, noun.many)} in the last ${factor.basis.windowDays} days`;
  if (factor.basis.target == null) return `${count}. No target: the ${noun.program} is not in place.`;
  return `${count}, of a target of ${formatInt(factor.basis.target)}.`;
}

function e1Basis(score: ActuationScore, brand: string): string {
  const e1 = score.factors.E1;
  const target = e1.basis?.target ?? null;
  const targetText = target == null ? "" : ` Target ${formatPct(target * 100, 0)}.`;
  if (!e1.basis || e1.basis.resolved <= 0) {
    return `No unbranded shopping answer from an engine that cites sources in this period.${targetText}`;
  }
  const share = formatPct((100 * e1.basis.withOwned) / e1.basis.resolved);
  return `${share} of unbranded shopping answers from engines that cite sources cite a ${brand} page (${formatInt(e1.basis.withOwned)} of ${formatInt(e1.basis.resolved)}).${targetText}`;
}

/** E1's tooltip: the decision 98 text, then which engines counted in this period. */
export function e1FactorTip(brand: string, owned: OwnedAnswersRead | null): string {
  const counted = owned && owned.counted.length > 0 ? ` Counted in this period: ${owned.counted.join(", ")}.` : "";
  const leftOut = owned && owned.leftOut.length > 0 ? ` Left out, no citations returned: ${owned.leftOut.join(", ")}.` : "";
  return `${e1Tooltip(brand)}${counted}${leftOut}`;
}

/** One row per factor, in the order P1, P2, E1, E2, E3. */
export function actuationFactorRows(score: ActuationScore, owned: OwnedAnswersRead | null, brand: string): ActuationFactorRow[] {
  return ACTUATION_FACTORS.map((id) => {
    const factor = score.factors[id];
    const { P1, P2, E2, E3 } = score.factors;
    const basis =
      id === "P1" ? programBasis(P1) : id === "P2" ? programBasis(P2) : id === "E1" ? e1Basis(score, brand) : itemBasis(id === "E2" ? E2 : E3);
    return {
      id,
      name: FACTOR_LABELS[id],
      weight: factor.weight,
      points: factor.points,
      pointsLabel: factorPointsLabel(factor.points, factor.weight),
      basis,
      tip: id === "E1" ? e1FactorTip(brand, owned) : null,
    };
  });
}

/** X-25: the AI Actuation card when its basis did not load. Null when the pillar is scored. */
export function actuationPartial(pillar: PillarScore): PartialFigure | null {
  if (pillar.id !== "actuation" || pillar.included) return null;
  return {
    reason: "read-failed",
    missing: "The AI Actuation records did not load",
    source: "the AI Actuation records",
    effect: "AI Consensus leaves AI Actuation out until they load, and the other weights rescale",
  };
}
