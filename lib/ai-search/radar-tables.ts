import {
  callsForEngine,
  categoryLeads,
  LEAD_FILTER_LABELS,
  LEAD_STATUS_LABELS,
  leadMatches,
  type BattlecardFilter,
  type LeadFilter,
} from "@/lib/ai-search/category-on-track";
import { competitorTallies, type CompetitorTally } from "@/lib/ai-search/competitors";
import {
  ROLE_LABELS,
  categoryRoleTallies,
  engineResultRoleTallies,
  headlineAside,
  headlineCompetitorWins,
  roleTally,
  type HeadlineRole,
  type RoleGroupTally,
} from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import { roleCellText, type AiTableBuild } from "@/lib/ai-search/tables";
import type { AiCallRow, AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";

/**
 * The Competitive Radar tables as plain rows. The tabs draw these cells, and Download CSV
 * writes the same cells from the same functions on the server (X-10).
 */

function largest(groups: readonly RoleGroupTally[], role: HeadlineRole): number {
  return Math.max(0, ...groups.map((group) => group.roles[role].resolved));
}

const ofResolved = (wins: number, resolved: number) => `${formatInt(wins)} of ${formatInt(resolved)}`;

// ---- Competitor Wins

export const COMPETITOR_WINS_HEADER = ["Competitor", "Leads", "Categories", "Engines"];

export function competitorLeadsCell(row: CompetitorTally): string {
  return `${ofResolved(row.wins, row.resolved)} resolved`;
}

/** "Acoustics 12 of 40, Electrics 3 of 52": the categories this brand led, most first. */
export function competitorCategoryLine(row: CompetitorTally): string {
  return row.byCategory.map((c) => `${categoryLabel(c.category)} ${ofResolved(c.wins, c.resolved)}`).join(", ");
}

/** "ChatGPT 24 of 102, Gemini 22 of 96": the engines where this brand led, most first. */
export function competitorEngineLine(row: CompetitorTally): string {
  return row.byEngine.map((e) => `${engineLabel(e.engine)} ${ofResolved(e.wins, e.resolved)}`).join(", ");
}

export function competitorWinsTable(snapshot: AiSearchSnapshot): AiTableBuild {
  return {
    header: COMPETITOR_WINS_HEADER,
    rows: competitorTallies(snapshot.calls).map((row) => ({
      key: row.brand,
      cells: [row.brand, competitorLeadsCell(row), competitorCategoryLine(row), competitorEngineLine(row)],
    })),
    sort: "Leads, most first, then competitor",
    filter: null,
  };
}

// ---- Engine Comparison: commercial outcomes by engine

export const ENGINE_COMPARISON_HEADER = [
  "Engine",
  "Model",
  ROLE_LABELS.unbranded_discovery,
  ROLE_LABELS.branded_consideration,
  "Competitor leads",
  "No leader",
  "Errors",
];

function engineCalls(calls: AiCallRow[], engine: string): AiCallRow[] {
  return calls.filter((row) => (row.engine ?? "").toLowerCase() === engine);
}

/** Each other brand an engine named most on unbranded discovery, with its count, most first. */
export function engineCompetitorLeads(calls: AiCallRow[], engine: string): Array<{ brand: string; wins: number }> {
  return headlineCompetitorWins(engineCalls(calls, engine));
}

/** "Fenix 24, Petzl 16, Streamlight 17", or "None". */
export function competitorLeadsLine(leads: ReadonlyArray<{ brand: string; wins: number }>): string {
  return leads.length ? leads.map((lead) => `${lead.brand} ${formatInt(lead.wins)}`).join(", ") : "None";
}

export function engineComparisonTable(snapshot: AiSearchSnapshot, single: boolean): AiTableBuild {
  const engines = engineResultRoleTallies(snapshot.calls);
  const unbranded = largest(engines, "unbranded_discovery");
  const branded = largest(engines, "branded_consideration");
  return {
    header: ENGINE_COMPARISON_HEADER,
    rows: engines.map((engine) => {
      const aside = headlineAside(engine);
      return {
        key: engine.key,
        cells: [
          engineLabel(engine.key),
          engine.models.join(", "),
          roleCellText(engine.roles.unbranded_discovery, unbranded, single),
          roleCellText(engine.roles.branded_consideration, branded, single),
          competitorLeadsLine(engineCompetitorLeads(snapshot.calls, engine.key)),
          formatInt(aside.unresolved),
          formatInt(aside.errors),
        ],
      };
    }),
    sort: "Resolved answers in the two rates, most first, then engine",
    filter: null,
  };
}

// ---- Engine Comparison: brand leads by engine and category (one row per engine)

/** Commercial categories in the selection, A to Z by key. */
export function commercialCategories(calls: AiCallRow[]): string[] {
  return [...new Set(calls.filter((row) => row.prompt_kind === "commercial").map((row) => row.category ?? ""))].sort();
}

export type EngineCategoryCell = {
  unbranded: ReturnType<typeof roleTally>;
  branded: ReturnType<typeof roleTally>;
};

export function engineCategoryCell(calls: AiCallRow[], engine: string, category: string): EngineCategoryCell {
  const bucket = calls.filter(
    (row) => (row.category ?? "") === category && (row.engine ?? "").toLowerCase() === engine,
  );
  return { unbranded: roleTally(bucket, "unbranded_discovery"), branded: roleTally(bucket, "branded_consideration") };
}

/** The largest resolved count across every cell, per rate, for the small-sample mark. */
export function engineCategoryLargest(
  calls: AiCallRow[],
  engines: readonly string[],
  categories: readonly string[],
): { unbranded: number; branded: number } {
  const max = { unbranded: 0, branded: 0 };
  for (const engine of engines) {
    for (const category of categories) {
      const cell = engineCategoryCell(calls, engine, category);
      max.unbranded = Math.max(max.unbranded, cell.unbranded.resolved);
      max.branded = Math.max(max.branded, cell.branded.resolved);
    }
  }
  return max;
}

/** "1 provider error", "3 provider errors". */
export function providerErrorsLine(errors: number): string {
  return `${formatInt(errors)} provider ${errors === 1 ? "error" : "errors"}`;
}

function engineCategoryText(cell: EngineCategoryCell, max: { unbranded: number; branded: number }, single: boolean): string {
  const errors = cell.unbranded.errors + cell.branded.errors;
  const parts = [
    `Unbranded ${roleCellText(cell.unbranded, max.unbranded, single)}`,
    `Branded ${roleCellText(cell.branded, max.branded, single)}`,
  ];
  if (errors) parts.push(providerErrorsLine(errors));
  return parts.join(". ");
}

export function engineCategoryTable(snapshot: AiSearchSnapshot, single: boolean): AiTableBuild {
  const engines = engineResultRoleTallies(snapshot.calls).map((engine) => engine.key);
  const categories = commercialCategories(snapshot.calls);
  const max = engineCategoryLargest(snapshot.calls, engines, categories);
  return {
    header: ["Engine", ...categories.map(categoryLabel)],
    rows: engines.map((engine) => ({
      key: engine,
      cells: [
        engineLabel(engine),
        ...categories.map((category) => engineCategoryText(engineCategoryCell(snapshot.calls, engine, category), max, single)),
      ],
    })),
    sort: "Resolved answers in the two rates, most first, then engine",
    filter: null,
  };
}

// ---- Category Battlecards

export const BATTLECARD_HEADER = [
  "Category",
  "Status",
  ROLE_LABELS.unbranded_discovery,
  ROLE_LABELS.branded_consideration,
  "Top competitor",
  "Competitor leads",
  "No leader",
  "Errors",
];

export function topCompetitorCell(top: { brand: string; wins: number } | undefined): string {
  return top ? `${top.brand} (${formatInt(top.wins)})` : "None";
}

/** Categories the chips leave on screen, competitor leads most first. */
export function battlecardRows(calls: AiCallRow[], lead: LeadFilter): RoleGroupTally[] {
  const groups = categoryRoleTallies(calls);
  const status = new Map(categoryLeads(groups, calls).map((row) => [row.key, row.status]));
  return groups
    .filter((group) => leadMatches(status.get(group.key) ?? "not_available", lead))
    .sort((a, b) => headlineAside(b).competitorWins - headlineAside(a).competitorWins || a.key.localeCompare(b.key));
}

/** The chips in plain words for the download: "Engine: ChatGPT. Who leads: Another brand leads." */
export function battlecardFilterLabel(filter: BattlecardFilter): string | null {
  const parts = [
    filter.engine ? `Engine: ${engineLabel(filter.engine)}` : null,
    filter.lead !== "all" ? `Who leads: ${LEAD_FILTER_LABELS[filter.lead]}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(". ") : null;
}

export function parseBattlecardFilter(value: unknown): BattlecardFilter {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const engine = typeof input.engine === "string" ? input.engine.slice(0, 80).toLowerCase() : "";
  const lead: LeadFilter = input.lead === "fender" || input.lead === "other" ? input.lead : "all";
  return { engine, lead };
}

export function battlecardTable(snapshot: AiSearchSnapshot, filter: BattlecardFilter, single: boolean): AiTableBuild {
  const calls = callsForEngine(snapshot.calls, filter.engine);
  const groups = categoryRoleTallies(calls);
  const leads = new Map(categoryLeads(groups, calls).map((lead) => [lead.key, lead]));
  const unbranded = largest(groups, "unbranded_discovery");
  const branded = largest(groups, "branded_consideration");
  return {
    header: BATTLECARD_HEADER,
    rows: battlecardRows(calls, filter.lead).map((row) => {
      const aside = headlineAside(row);
      const status = leads.get(row.key)?.status ?? "not_available";
      const top = headlineCompetitorWins(calls.filter((call) => (call.category ?? "") === row.key))[0];
      return {
        key: row.key,
        cells: [
          categoryLabel(row.key),
          LEAD_STATUS_LABELS[status],
          roleCellText(row.roles.unbranded_discovery, unbranded, single),
          roleCellText(row.roles.branded_consideration, branded, single),
          topCompetitorCell(top),
          formatInt(aside.competitorWins),
          formatInt(aside.unresolved),
          formatInt(aside.errors),
        ],
      };
    }),
    sort: "Competitor leads, most first, then category",
    filter: battlecardFilterLabel(filter),
  };
}
