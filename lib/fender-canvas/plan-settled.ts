/**
 * The ranked list waits for every read it ranks (Worker 32.13). Each read the plan is built from
 * can still be loading on first paint; ranking before they land shows one item at #1, then a
 * different one a few seconds later. A failed read is settled: the plan builds with the existing
 * failed-read handling. Only "loading" holds the list back.
 */

import type { PlanItem } from "@/lib/fender-canvas/roadmap-plan";
import type { RoadmapPlanInput } from "@/lib/fender-canvas/roadmap-plan-read";

/**
 * The plan every surface receives while a read it ranks is loading. One shared empty list, so a
 * surface that cannot take a new prop (the map) can still tell "loading" from "nothing to fix".
 */
export const PLAN_PENDING: PlanItem[] = Object.freeze([]) as unknown as PlanItem[];

export function isPlanPending(plan: readonly PlanItem[] | null | undefined): boolean {
  return plan === PLAN_PENDING;
}

type SettledInput = Pick<RoadmapPlanInput, "retail" | "bundle" | "findability" | "ai" | "stock" | "sources" | "windows">;

/** Names of the reads still loading, in a stable order; empty when every read has settled. */
export function pendingPlanReads(input: SettledInput): string[] {
  const pending: string[] = [];
  if (!input.bundle) pending.push("canvas metrics");
  if (input.bundle?.estimates?.phase === "loading") pending.push("analyst estimates");
  if (input.retail.phase === "loading") pending.push("retail");
  if (input.findability.phase === "loading") pending.push("findability");
  if (input.ai.phase === "loading") pending.push("AI search");
  if (input.stock.phase === "loading") pending.push("stock");
  if (input.sources.phase === "loading") pending.push("source runs");
  if (input.windows.phase === "loading") pending.push("30-day windows");
  return pending;
}

export function planSettled(input: SettledInput): boolean {
  return pendingPlanReads(input).length === 0;
}
