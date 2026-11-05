import { loadAiSearchRead, type AiReadClient } from "@/lib/ai-search/queries";
import { competitorTallies } from "@/lib/ai-search/competitors";
import { competitorWinsFigure } from "@/lib/ai-search/competitor-wins-lead";
import { categoryRoleTallies, engineResultRoleTallies, headlineAside, headlineCompetitorWins } from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import { driftRead, PROBE_STATE_LABELS } from "@/lib/ai-search/drift";
import { factCheckAccuracyTip } from "@/lib/ai-search/fact-check-copy";
import { defaultWindowLabel } from "@/lib/ai-search/default-window";
import { utcDay } from "@/lib/ai-search/history-eligibility";
import { loadBriefingAi } from "@/lib/export/briefing-ai";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import { exportFailed, exportFile } from "@/lib/export/file";
import type { BuiltExport } from "@/lib/export/types";
import { formatInt, formatRatio } from "@/lib/fender-canvas/format";
import { summarizeRun } from "@/lib/ai-search/summary";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";

const AI_FAILED = "The AI Search read could not be loaded.";

async function displayed(): Promise<{ read: AiSearchRead; windowLabel: string | null; asOf: string }> {
  const [current, asOf] = await Promise.all([
    loadAiSearchRead(getCanvasSupabase() as unknown as AiReadClient),
    loadDashboardAsOf(),
  ]);
  const ai = await loadBriefingAi(current);
  const end =
    current.phase === "ready" ? utcDay(current.snapshot.run.published_at ?? current.snapshot.run.completed_at) : null;
  return { read: ai.read, windowLabel: ai.windowLabel ?? defaultWindowLabel(end), asOf: asOf.asOf };
}

function windowFilter(label: string | null): string {
  return label ? label : "No filter.";
}

function rate(wins: number, resolved: number): string {
  if (resolved <= 0) return "No resolved answers";
  return formatRatio(wins, resolved);
}

export async function loadCompetitorWinsExport(): Promise<BuiltExport> {
  try {
    const ai = await displayed();
    if (ai.read.phase !== "ready") return exportFailed(AI_FAILED);
    const snapshot = ai.read.snapshot;
    const tallies = competitorTallies(snapshot.calls);
    const summary = summarizeRun(snapshot);
    return exportFile(
      "competitor-wins",
      {
        filter: windowFilter(ai.windowLabel),
        sort: "Most leads first, then brand name.",
        asOf: ai.asOf,
        population: competitorWinsFigure(summary.competitorWins, summary.roles.unbranded.resolved),
      },
      ["Competitor", "Leads", "Categories", "Engines"],
      tallies.map((row) => [
        row.brand,
        `${formatInt(row.wins)} of ${formatInt(row.resolved)}`,
        row.byCategory.map((item) => `${categoryLabel(item.category)} ${formatInt(item.wins)} of ${formatInt(item.resolved)}`).join(", "),
        row.byEngine.map((item) => `${engineLabel(item.engine)} ${formatInt(item.wins)} of ${formatInt(item.resolved)}`).join(", "),
      ]),
    );
  } catch {
    return exportFailed(AI_FAILED);
  }
}

export async function loadEngineComparisonExport(): Promise<BuiltExport> {
  try {
    const ai = await displayed();
    if (ai.read.phase !== "ready") return exportFailed(AI_FAILED);
    const calls = ai.read.snapshot.calls;
    const engines = engineResultRoleTallies(calls);
    const brands = headlineCompetitorWins(calls).map((entry) => entry.brand);
    const header = ["Engine", "Unbranded discovery", "Branded consideration", ...brands, "No leader", "Errors"];
    return exportFile(
      "engine-comparison",
      {
        filter: windowFilter(ai.windowLabel),
        sort: "Read order.",
        asOf: ai.asOf,
        population: `${formatInt(engines.length)} engines with a finished commercial result.`,
      },
      header,
      engines.map((engine) => {
        const aside = headlineAside(engine);
        return [
          engineLabel(engine.key),
          rate(engine.roles.unbranded_discovery.fenderWins, engine.roles.unbranded_discovery.resolved),
          rate(engine.roles.branded_consideration.fenderWins, engine.roles.branded_consideration.resolved),
          ...brands.map((brand) => String(headlineCompetitorWins(calls.filter((row) => (row.engine ?? "").toLowerCase() === engine.key)).find((entry) => entry.brand === brand)?.wins ?? 0)),
          String(aside.unresolved),
          String(aside.errors),
        ];
      }),
    );
  } catch {
    return exportFailed(AI_FAILED);
  }
}

export async function loadBattlecardsExport(): Promise<BuiltExport> {
  try {
    const ai = await displayed();
    if (ai.read.phase !== "ready") return exportFailed(AI_FAILED);
    const calls = ai.read.snapshot.calls;
    const rows = categoryRoleTallies(calls).sort(
      (a, b) => headlineAside(b).competitorWins - headlineAside(a).competitorWins || a.key.localeCompare(b.key),
    );
    return exportFile(
      "category-battlecards",
      {
        filter: `${windowFilter(ai.windowLabel)} No engine filter.`,
        sort: "Most competitor leads first, then category name.",
        asOf: ai.asOf,
        population: `${formatInt(rows.length)} categories in this window.`,
      },
      ["Category", "Unbranded discovery", "Branded consideration", "Top competitor", "Competitor leads", "No leader", "Errors"],
      rows.map((row) => {
        const aside = headlineAside(row);
        const top = headlineCompetitorWins(calls.filter((call) => (call.category ?? "") === row.key))[0];
        return [
          categoryLabel(row.key),
          rate(row.roles.unbranded_discovery.fenderWins, row.roles.unbranded_discovery.resolved),
          rate(row.roles.branded_consideration.fenderWins, row.roles.branded_consideration.resolved),
          top ? `${top.brand} (${top.wins})` : "None",
          String(aside.competitorWins),
          String(aside.unresolved),
          String(aside.errors),
        ];
      }),
    );
  } catch {
    return exportFailed(AI_FAILED);
  }
}

export async function loadFactChecksExport(): Promise<BuiltExport> {
  try {
    const ai = await displayed();
    if (ai.read.phase !== "ready") return exportFailed(AI_FAILED);
    const snapshot: AiSearchSnapshot = ai.read.snapshot;
    const drift = driftRead(snapshot.calls, snapshot.probes);
    return exportFile(
      "fact-checks",
      {
        filter: windowFilter(ai.windowLabel),
        sort: "Read order.",
        asOf: ai.asOf,
        population: factCheckAccuracyTip(drift.coverage, true),
      },
      ["Question checked", "Engine", "Result", "Verified fact", "Checked"],
      drift.probes.map((row) => [
        row.prompt,
        engineLabel(row.engine),
        PROBE_STATE_LABELS[row.state],
        row.claim ?? "",
        row.checkedAt ?? "",
      ]),
    );
  } catch {
    return exportFailed(AI_FAILED);
  }
}
