/**
 * Action Items: the latest run behind each AI row (Brian Magazu, 12 Nov 2026). Every AI figure
 * reads the date-pill window, so a fix that shows in the newest run is named in the figure's
 * tooltip as "Latest run (Nov 12): X of Y", counted the way the row's own figure counts.
 */
import { categoryLeads } from "@/lib/ai-search/category-on-track";
import { runDay } from "@/lib/ai-search/default-window";
import { driftRead } from "@/lib/ai-search/drift";
import { categoryRoleTallies, headlineCompetitorWins } from "@/lib/ai-search/question-role";
import { shortRunDay } from "@/lib/ai-search/stale";
import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatRatio } from "@/lib/fender-canvas/format";
import type { PlanItem } from "@/lib/fender-canvas/roadmap-plan";
import type { SignalAction } from "@/lib/fender-canvas/roadmap-signals";
import { answersOf, runShares } from "@/lib/fender-canvas/roadmap-sources";

type Count = { x: number; y: number } | null;

function rivalCount(latest: AiSearchSnapshot, key: string, brand: string): Count {
  const calls = latest.calls;
  const leads = categoryLeads(categoryRoleTallies(calls), calls);
  const resolved = leads.reduce((sum, lead) => sum + lead.resolved, 0);
  if (resolved <= 0) return null;
  const inCategory = calls.filter((row) => (row.category ?? "") === key);
  const wins = headlineCompetitorWins(inCategory).find((row) => row.brand === brand)?.wins ?? 0;
  return { x: wins, y: resolved };
}

/** The latest run's count for one AI row, as its figure counts the window. Null for other rows. */
export function latestRunCount(item: PlanItem, latest: AiSearchSnapshot, rivals: ReadonlyMap<string, string>): Count {
  if (item.id === "finding:unbranded_discovery") {
    const tally = summarizeRun(latest).roles.unbranded;
    return tally.resolved > 0 ? { x: tally.fenderWins, y: tally.resolved } : null;
  }
  if (item.id === "signal:fact_contradictions") {
    const { coverage } = driftRead(latest.calls, latest.probes);
    return coverage.answersChecked > 0 ? { x: coverage.contradictions, y: coverage.answersChecked } : null;
  }
  if (item.id.startsWith("signal:rival:")) {
    const brand = rivals.get(item.id);
    return brand ? rivalCount(latest, item.id.slice("signal:rival:".length), brand) : null;
  }
  if (item.kind === "source") {
    const shares = runShares(latest);
    if (shares.read.answersWithCitation <= 0) return null;
    return { x: answersOf(shares.byDomain.get(item.label) ?? []), y: shares.read.answersWithCitation };
  }
  return null;
}

/** "Latest run (Nov 12): 5 of 40", or null when the row is not an AI row or the run has no count. */
export function latestRunTip(item: PlanItem, latest: AiSearchSnapshot, rivals: ReadonlyMap<string, string>): string | null {
  const count = latestRunCount(item, latest, rivals);
  const day = runDay(latest.run);
  if (!count || !day) return null;
  return `Latest run (${shortRunDay(day)}): ${formatRatio(count.x, count.y)}`;
}

/** The plan with each AI row's latest-run tooltip. Unchanged when the latest run is not read. */
export function withLatestRunTips(
  plan: readonly PlanItem[],
  latest: AiSearchSnapshot | null,
  signals: readonly SignalAction[],
): PlanItem[] {
  if (!latest) return [...plan];
  const rivals = new Map(signals.flatMap((signal) => (signal.rival ? [[signal.id, signal.rival] as const] : [])));
  return plan.map((item) => {
    const tip = latestRunTip(item, latest, rivals);
    return tip ? { ...item, tip } : item;
  });
}
