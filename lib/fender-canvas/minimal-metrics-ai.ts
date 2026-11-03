/** Minimal view entries for AI Search Visibility and Competitive Radar, in tab order. */

import { competitorLeadPie } from "@/lib/ai-search/competitor-wins-lead";
import { factCheckAccuracyPie, factCheckAccuracyPieTip } from "@/lib/ai-search/fact-check-copy";
import {
  categoryRoleTallies,
  engineResultRoleTallies,
  sumRoleTallies,
  type HeadlineRole,
} from "@/lib/ai-search/question-role";
import { PROMPT_BATTERY } from "@/lib/ai-search/prompt-battery";
import { categoryLabel, engineLabel, isSmallSample } from "@/lib/ai-search/run-metrics";
import { BRANDED_RATE_BANDS, SMALL_SAMPLE_LABEL, UNBRANDED_RATE_BANDS, type AiRunSummary } from "@/lib/ai-search/summary";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  aiFigure,
  aiReading,
  bubbleEntry,
  cached,
  counted,
  missingFigure,
  rateFigure,
  rateLeadPie,
  rateTip,
  runSummary,
  type MinimalContext,
  type MinimalEntry,
  type MinimalEntryFamily,
  type MinimalListItem,
} from "@/lib/fender-canvas/minimal-metric-kit";

const ROLE = {
  unbranded_discovery: {
    title: "Unbranded Discovery",
    label: "Fender leads in unbranded discovery",
    noun: "resolved unbranded discovery answers",
    bands: UNBRANDED_RATE_BANDS,
    pick: (s: AiRunSummary) => s.roles.unbranded,
  },
  branded_consideration: {
    title: "Branded Consideration",
    label: "Fender leads in branded consideration",
    noun: "resolved branded consideration answers",
    bands: BRANDED_RATE_BANDS,
    pick: (s: AiRunSummary) => s.roles.branded,
  },
} as const;

const NO_RESOLVED = "This run has no resolved answers for this question.";

/** A headline rate as one tab draws it. `pieId` is that tab's disc, or null when the tab draws none. */
function roleRateEntry(
  id: string,
  spokeId: string,
  tab: string,
  role: HeadlineRole,
  pieId: string | null,
  tally: (ctx: MinimalContext, summary: AiRunSummary) => { fenderWins: number; resolved: number } = (_ctx, s) => ROLE[role].pick(s),
): MinimalEntry {
  const meta = ROLE[role];
  return {
    id,
    spokeId,
    tab,
    label: meta.label,
    read: (ctx) =>
      aiFigure(ctx, (s) => {
        const t = tally(ctx, s);
        const pie = pieId ? rateLeadPie(pieId, meta.title, t.fenderWins, t.resolved) : null;
        return rateFigure(t, meta.bands, meta.noun, pie, NO_RESOLVED);
      }),
  };
}

function engineTotal(ctx: MinimalContext, role: HeadlineRole) {
  return ctx.ai.phase === "ready" ? sumRoleTallies(engineResultRoleTallies(ctx.ai.snapshot.calls), role) : { fenderWins: 0, resolved: 0 };
}

function weakestUnbrandedEngine(ctx: MinimalContext) {
  if (ctx.ai.phase !== "ready") return null;
  return (
    engineResultRoleTallies(ctx.ai.snapshot.calls)
      .filter((engine) => engine.roles.unbranded_discovery.resolved > 0)
      .sort((a, b) => {
        const aRate = a.roles.unbranded_discovery.fenderWins / a.roles.unbranded_discovery.resolved;
        const bRate = b.roles.unbranded_discovery.fenderWins / b.roles.unbranded_discovery.resolved;
        return aRate - bRate || a.key.localeCompare(b.key);
      })[0] ?? null
  );
}

function rivalLead(summary: AiRunSummary | null) {
  const gap = summary?.largestGap;
  const rival = gap?.leaders[0];
  if (gap && rival && gap.resolved > 0) {
    return { brand: rival.brand, wins: rival.wins, resolved: gap.resolved, scope: `resolved ${categoryLabel(gap.category)} answers`, where: categoryLabel(gap.category) };
  }
  const top = summary?.topCompetitor;
  if (top && top.resolved > 0) {
    return { brand: top.brand, wins: top.wins, resolved: top.resolved, scope: "resolved unbranded discovery answers", where: "unbranded discovery" };
  }
  return null;
}

/** The battery's question categories, in the order it asks them. */
const BATTERY_CATEGORIES = [...new Set(PROMPT_BATTERY.filter((prompt) => prompt.kind === "commercial").map((prompt) => prompt.category))];

function categoryRows(ctx: MinimalContext) {
  return cached(ctx, "category-role-tallies", () => (ctx.ai.phase === "ready" ? categoryRoleTallies(ctx.ai.snapshot.calls) : []));
}

function categoryId(category: string): string {
  const slug = category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `battlecards-${slug || "uncategorized"}-unbranded`;
}

/** One category's unbranded rate, as its Category Battlecards row reads it, small-sample mark included. */
function categoryUnbrandedEntry(category: string): MinimalEntry {
  const name = categoryLabel(category);
  return {
    id: categoryId(category),
    spokeId: "competitors",
    tab: "Category Battlecards",
    label: `${name}: Fender leads in unbranded discovery`,
    read: (ctx) =>
      aiFigure(ctx, () => {
        const all = categoryRows(ctx);
        const row = all.find((item) => item.key === category);
        if (!row) return missingFigure(`The published run asked no ${name} questions.`);
        const tally = row.roles.unbranded_discovery;
        const figure = rateFigure(
          tally,
          UNBRANDED_RATE_BANDS,
          `resolved ${name} unbranded discovery answers`,
          null,
          `The published run has no resolved ${name} unbranded discovery answers.`,
        );
        const largest = Math.max(0, ...all.map((item) => item.roles.unbranded_discovery.resolved));
        if (!figure.ratio || !isSmallSample(tally.resolved, largest)) return figure;
        return { ...figure, ratio: `${figure.ratio} · ${SMALL_SAMPLE_LABEL}` };
      }),
  };
}

/** Every battery category, then any other category the published run holds. */
const CATEGORY_UNBRANDED: MinimalEntryFamily = {
  family: "battlecards-category-unbranded",
  entries: (ctx) => {
    const extra = categoryRows(ctx)
      .map((row) => row.key)
      .filter((key) => !BATTERY_CATEGORIES.includes(key));
    const ids = new Set<string>();
    return [...BATTERY_CATEGORIES, ...extra].flatMap((category) => {
      const id = categoryId(category);
      if (ids.has(id)) return [];
      ids.add(id);
      return [categoryUnbrandedEntry(category)];
    });
  },
};

export const AI_SEARCH_ENTRIES: MinimalEntry[] = [
  bubbleEntry({
    id: "spoke-aeo",
    spokeId: "aeo",
    label: ROLE.unbranded_discovery.label,
    tab: "Run Summary",
    read: (ctx) =>
      aiReading(ctx, (s) =>
        counted(
          s.roles.unbranded.resolved > 0 ? `${formatInt(s.roles.unbranded.fenderWins)} of ${formatInt(s.roles.unbranded.resolved)}` : null,
          ROLE.unbranded_discovery.noun,
          null,
          null,
          NO_RESOLVED,
        ),
      ),
  }),
  roleRateEntry("run-summary-branded", "aeo", "Run Summary", "branded_consideration", null),
  roleRateEntry("run-details-unbranded", "aeo", "Run Details", "unbranded_discovery", "role-unbranded"),
  bubbleEntry({
    id: "sat-prompts",
    spokeId: "aeo",
    label: ROLE.branded_consideration.label,
    tab: "Run Details",
    read: (ctx) =>
      aiReading(ctx, (s) => {
        const { fenderWins, resolved } = s.roles.branded;
        const pie = rateLeadPie("role-branded", ROLE.branded_consideration.title, fenderWins, resolved);
        return counted(
          resolved > 0 ? `${formatInt(fenderWins)} of ${formatInt(resolved)}` : null,
          ROLE.branded_consideration.noun,
          pie,
          rateTip(fenderWins, resolved),
          NO_RESOLVED,
        );
      }),
  }),
  bubbleEntry({
    id: "sat-drift",
    spokeId: "aeo",
    label: "Product fact check accuracy",
    tab: "Product Fact Checks",
    read: (ctx) =>
      aiReading(ctx, (s) => {
        const c = s.drift.coverage;
        return counted(
          c.answersChecked > 0 ? `${formatInt(c.answersChecked - c.contradictions)} of ${formatInt(c.answersChecked)}` : null,
          "checked answers matched the verified fact",
          factCheckAccuracyPie(c),
          factCheckAccuracyPieTip(c),
          "No product fact check completed in this run.",
        );
      }),
  }),
  bubbleEntry({
    id: "sat-citations",
    spokeId: "aeo",
    label: "Cited links to Fender-owned sites",
    tab: "Citation Ecosystem",
    read: (ctx) =>
      aiReading(ctx, (s) =>
        counted(
          s.citations.rows > 0 ? `${formatInt(s.citations.fenderOwnedRows)} of ${formatInt(s.citations.rows)}` : null,
          "cited links",
          null,
          null,
          "This run has no cited links.",
        ),
      ),
  }),
];

export const COMPETITIVE_ENTRIES: MinimalListItem[] = [
  bubbleEntry({
    id: "spoke-competitors",
    spokeId: "competitors",
    label: (ctx) => {
      const lead = rivalLead(runSummary(ctx));
      return lead ? `${lead.brand} lead in ${lead.where}` : "Largest competitor lead";
    },
    tab: "Category Battlecards",
    read: (ctx) =>
      aiReading(ctx, (s) => {
        const lead = rivalLead(s);
        return counted(lead ? `${formatInt(lead.wins)} of ${formatInt(lead.resolved)}` : null, lead?.scope ?? "", null, null, "No competitor led an answer in this run.");
      }),
  }),
  roleRateEntry("battlecards-unbranded", "competitors", "Category Battlecards", "unbranded_discovery", "role-unbranded"),
  roleRateEntry("battlecards-branded", "competitors", "Category Battlecards", "branded_consideration", "role-branded"),
  CATEGORY_UNBRANDED,
  bubbleEntry({
    id: "sat-taylor",
    spokeId: "competitors",
    label: "Answers a competitor led",
    tab: "Competitor Wins",
    read: (ctx) =>
      aiReading(ctx, (s) => {
        const resolved = s.roles.unbranded.resolved;
        const pie = competitorLeadPie(s.competitorWins, resolved);
        const tip = pie ? `${s.competitorWins} competitor led. ${resolved - s.competitorWins} Fender/Squier led. Total ${resolved} resolved unbranded discovery answers.` : null;
        return counted(resolved > 0 ? `${formatInt(s.competitorWins)} of ${formatInt(resolved)}` : null, ROLE.unbranded_discovery.noun, pie, tip, "This run has no resolved unbranded answers.");
      }),
  }),
  bubbleEntry({
    id: "sat-amps",
    spokeId: "competitors",
    label: (ctx) => {
      const engine = weakestUnbrandedEngine(ctx);
      return engine ? `Fender leads on ${engineLabel(engine.key)}, the weakest engine` : ROLE.unbranded_discovery.label;
    },
    tab: "Engine Comparison",
    read: (ctx) =>
      aiReading(ctx, (s) => {
        const tally = weakestUnbrandedEngine(ctx)?.roles.unbranded_discovery ?? s.roles.unbranded;
        return counted(tally.resolved > 0 ? `${formatInt(tally.fenderWins)} of ${formatInt(tally.resolved)}` : null, ROLE.unbranded_discovery.noun, null, null, "This run has no resolved unbranded answers.");
      }),
  }),
  roleRateEntry("engines-unbranded", "competitors", "Engine Comparison", "unbranded_discovery", "engine-unbranded_discovery", (ctx) => engineTotal(ctx, "unbranded_discovery")),
  roleRateEntry("engines-branded", "competitors", "Engine Comparison", "branded_consideration", "engine-branded_consideration", (ctx) => engineTotal(ctx, "branded_consideration")),
];
