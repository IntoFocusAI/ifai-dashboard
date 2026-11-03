/**
 * Metrics the Minimal view slots pick from. One per map bubble that carries a figure,
 * so a picked metric reads the same figure as the map. The N of M and the disc come
 * from the hero model the bubble's tab draws for the same counts.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { competitorLeadPie } from "@/lib/ai-search/competitor-wins-lead";
import { factCheckAccuracyPie, factCheckAccuracyPieTip } from "@/lib/ai-search/fact-check-copy";
import { engineResultRoleTallies } from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import { summarizeRun, type AiRunSummary } from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import type { CanvasMetricReading, CanvasMinimalMetric } from "@/lib/canvas-sdk/minimal-view-types";
import type { CanvasMetric, CanvasNode } from "@/lib/canvas-sdk/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import { exactPageLeadPie, outcomeLeadTip, outcomeRatioFigure } from "@/lib/findability/lead";
import { countFindability } from "@/lib/findability/outcomes";
import { formatInt } from "@/lib/fender-canvas/format";
import { listingContentHeroes } from "@/lib/fender-canvas/listing-content";
import { machineReadabilityHeroes } from "@/lib/fender-canvas/machine-readability";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";
import { buyBoxHero, catalogHero, mapHero } from "@/lib/fender-canvas/retail-overview-lead";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

export type MinimalMetricInput = {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
  ai: AiSearchRead;
  findability: FindabilityRead;
  /** Phase 1 analyst estimate detail, as the Action Items bubble reads it. */
  phaseOneDetail: string;
};

type Context = MinimalMetricInput & { summary: AiRunSummary | null };

type Entry = {
  nodeId: string;
  label: (ctx: Context) => string;
  subTab: string;
  provenance?: CanvasMetric["provenance"];
  read: (ctx: Context) => CanvasMetricReading;
};

/** Every slot reads "Not available*" for a missing input, the way the tabs do. */
export const NOT_AVAILABLE = "Not available*";

function counted(ratio: string | null, noun: string, pie: PieDiscData | null, tip: string | null, missing: string): CanvasMetricReading {
  if (!ratio) return { ratio: null, pie: null, tip: null, missing };
  return { ratio: `${ratio} ${noun}`, pie, tip, missing: null };
}

function waiting(missing: string): CanvasMetricReading {
  return { ratio: null, pie: null, tip: null, missing };
}

function retailRead(ctx: Context, read: (snapshot: PortfolioRetailSnapshot) => CanvasMetricReading) {
  if (ctx.retail.phase === "loading") return waiting("The retail read is still loading.");
  if (ctx.retail.phase === "error") return waiting("The retail read could not be loaded.");
  return read(ctx.retail.snapshot);
}

function aiRead(ctx: Context, read: (summary: AiRunSummary) => CanvasMetricReading) {
  if (ctx.ai.phase === "loading") return waiting("The published AI run is still loading.");
  if (ctx.ai.phase === "error") return waiting("The published AI run did not load.");
  if (ctx.ai.phase === "no-run" || !ctx.summary) return waiting("No AI run has been published yet.");
  return read(ctx.summary);
}

/** Same disc as the Run Details lead: Fender/Squier leads versus the rest of resolved answers. */
function rateLeadPie(id: string, title: string, wins: number, resolved: number): PieDiscData | null {
  if (resolved <= 0 || wins < 0 || wins > resolved) return null;
  return {
    id,
    title,
    total: resolved,
    totalLabel: "resolved answers",
    slices: [
      { key: "fender", label: "Fender/Squier leads", count: wins },
      { key: "other", label: "Rest of resolved answers", count: resolved - wins },
    ].filter((slice) => slice.count > 0),
  };
}

function rateRead(title: string, wins: number, resolved: number, noun: string, pieId: string): CanvasMetricReading {
  const pie = rateLeadPie(pieId, title, wins, resolved);
  const tip = `${wins} Fender/Squier leads. ${resolved - wins} rest of resolved answers. Total ${resolved} resolved answers.`;
  return counted(resolved > 0 ? `${formatInt(wins)} of ${formatInt(resolved)}` : null, noun, pie, tip, "This run has no resolved answers for this question.");
}

function weakestUnbrandedEngine(ctx: Context) {
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

const ENTRIES: Entry[] = [
  {
    nodeId: "spoke-retail",
    label: () => "Buy Box withheld",
    subTab: "Retail Overview",
    read: (ctx) =>
      retailRead(ctx, (snapshot) => {
        const hero = buyBoxHero(snapshot);
        return counted(hero.ratio, "current Buy Box readings", hero.pie, hero.tip, hero.explainer);
      }),
  },
  {
    nodeId: "sat-buybox",
    label: () => "Withheld above the outside price",
    subTab: "Suppressed Listings",
    read: (ctx) =>
      retailRead(ctx, (snapshot) => {
        const counts = snapshot.suppressedListings.detail?.counts ?? null;
        const ready = counts != null && counts.current > 0;
        return counted(
          ready ? `${formatInt(counts.confirmedHighPrice)} of ${formatInt(counts.current)}` : null,
          "current Buy Box readings",
          null,
          null,
          snapshot.suppressedListings.missingMessage ?? "Buy Box reading not stored.",
        );
      }),
  },
  {
    nodeId: "sat-map",
    label: () => "MAP leakage",
    subTab: "MAP",
    read: (ctx) =>
      retailRead(ctx, (snapshot) => {
        const hero = mapHero(snapshot);
        return counted(hero.ratio, "listings with a stored MAP price", hero.pie, hero.tip, hero.explainer);
      }),
  },
  {
    nodeId: "sat-asin",
    label: () => "Unnested bundles",
    subTab: "Catalog Governance",
    read: (ctx) =>
      retailRead(ctx, (snapshot) => {
        const hero = catalogHero(snapshot);
        return counted(hero.ratio, "bundles in this retail read", hero.pie, hero.tip, hero.explainer);
      }),
  },
  {
    nodeId: "spoke-aeo",
    label: () => "Fender leads in unbranded discovery",
    subTab: "Run Summary",
    read: (ctx) =>
      aiRead(ctx, (s) =>
        rateRead("Unbranded Discovery", s.roles.unbranded.fenderWins, s.roles.unbranded.resolved, "resolved unbranded discovery answers", "role-unbranded"),
      ),
  },
  {
    nodeId: "sat-prompts",
    label: () => "Fender leads in branded consideration",
    subTab: "Run Details",
    read: (ctx) =>
      aiRead(ctx, (s) =>
        rateRead("Branded Consideration", s.roles.branded.fenderWins, s.roles.branded.resolved, "resolved branded consideration answers", "role-branded"),
      ),
  },
  {
    nodeId: "sat-citations",
    label: () => "Cited links to Fender-owned sites",
    subTab: "Citation Ecosystem",
    read: (ctx) =>
      aiRead(ctx, (s) =>
        counted(
          s.citations.rows > 0 ? `${formatInt(s.citations.fenderOwnedRows)} of ${formatInt(s.citations.rows)}` : null,
          "cited links",
          null,
          null,
          "This run has no cited links.",
        ),
      ),
  },
  {
    nodeId: "sat-drift",
    label: () => "Product fact check accuracy",
    subTab: "Product Fact Checks",
    read: (ctx) =>
      aiRead(ctx, (s) => {
        const c = s.drift.coverage;
        return counted(
          c.answersChecked > 0 ? `${formatInt(c.answersChecked - c.contradictions)} of ${formatInt(c.answersChecked)}` : null,
          "checked answers matched the verified fact",
          factCheckAccuracyPie(c),
          factCheckAccuracyPieTip(c),
          "No product fact check completed in this run.",
        );
      }),
  },
  {
    nodeId: "sat-findability",
    label: () => "Exact official product page",
    subTab: "Findability",
    read: (ctx) => {
      if (ctx.findability.phase === "loading") return waiting("Official-page outcomes are loading.");
      if (ctx.findability.phase === "error") return waiting("The official-page read did not load.");
      const counts = countFindability(ctx.findability.rows);
      return counted(
        outcomeRatioFigure(counts, "exact_official_product"),
        "listings in this read",
        exactPageLeadPie(counts),
        outcomeLeadTip(counts, "exact_official_product"),
        "This official-page read has no listings.",
      );
    },
  },
  {
    nodeId: "sat-schema",
    label: () => "Found pages missing machine-readable specs",
    subTab: "Brand-Site Specs",
    read: (ctx) => {
      const hero = machineReadabilityHeroes(ctx.bundle.specPages ?? null)[0];
      return counted(hero.ratio, "found fender.com pages", hero.pie, hero.tip, hero.explainer);
    },
  },
  {
    nodeId: "sat-tables",
    label: () => "Five Amazon bullets filled",
    subTab: "Amazon A+ Matrix",
    read: (ctx) => {
      const hero = listingContentHeroes(ctx.bundle.listingContent ?? null)[0];
      return counted(hero.ratio, "live Amazon listings checked", hero.pie, hero.tip, hero.explainer);
    },
  },
  {
    nodeId: "spoke-competitors",
    label: (ctx) => {
      const lead = rivalLead(ctx.summary);
      return lead ? `${lead.brand} lead in ${lead.where}` : "Largest competitor lead";
    },
    subTab: "Category Battlecards",
    read: (ctx) =>
      aiRead(ctx, (s) => {
        const lead = rivalLead(s);
        return counted(lead ? `${formatInt(lead.wins)} of ${formatInt(lead.resolved)}` : null, lead?.scope ?? "", null, null, "No competitor led an answer in this run.");
      }),
  },
  {
    nodeId: "sat-taylor",
    label: () => "Answers a competitor led",
    subTab: "Competitor Wins",
    read: (ctx) =>
      aiRead(ctx, (s) => {
        const resolved = s.roles.unbranded.resolved;
        const pie = competitorLeadPie(s.competitorWins, resolved);
        const tip = pie ? `${s.competitorWins} competitor led. ${resolved - s.competitorWins} Fender/Squier led. Total ${resolved} resolved unbranded discovery answers.` : null;
        return counted(resolved > 0 ? `${formatInt(s.competitorWins)} of ${formatInt(resolved)}` : null, "resolved unbranded discovery answers", pie, tip, "This run has no resolved unbranded answers.");
      }),
  },
  {
    nodeId: "sat-amps",
    label: (ctx) => {
      const engine = weakestUnbrandedEngine(ctx);
      return engine ? `Fender leads on ${engineLabel(engine.key)}, the weakest engine` : "Fender leads in unbranded discovery";
    },
    subTab: "Engine Comparison",
    read: (ctx) =>
      aiRead(ctx, (s) => {
        const tally = weakestUnbrandedEngine(ctx)?.roles.unbranded_discovery ?? s.roles.unbranded;
        return counted(tally.resolved > 0 ? `${formatInt(tally.fenderWins)} of ${formatInt(tally.resolved)}` : null, "resolved unbranded discovery answers", null, null, "This run has no resolved unbranded answers.");
      }),
  },
  {
    nodeId: "spoke-fixes",
    label: () => "Recoverable Revenue, Phase 1",
    subTab: "Revenue Estimates",
    provenance: "estimate",
    read: () => ({ ratio: null, pie: null, tip: null, missing: null }),
  },
];

function slotValue(node: CanvasNode): string {
  const value = node.heroValue?.value ?? "";
  return /^not available\*?$/i.test(value.trim()) ? NOT_AVAILABLE : value;
}

/** A value that already reads "N of M" keeps only the noun on the line under it. */
function withoutRepeatedCount(reading: CanvasMetricReading, value: string): CanvasMetricReading {
  if (!reading.ratio?.startsWith(`${value} `)) return reading;
  return { ...reading, ratio: reading.ratio.slice(value.length + 1) };
}

export function buildMinimalMetrics(nodes: CanvasNode[], input: MinimalMetricInput): CanvasMinimalMetric[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ctx: Context = { ...input, summary: input.ai.phase === "ready" ? summarizeRun(input.ai.snapshot) : null };
  return ENTRIES.flatMap((entry): CanvasMinimalMetric[] => {
    const node = byId.get(entry.nodeId);
    if (!node?.heroValue || !node.spokeId) return [];
    const value = slotValue(node);
    const reading = withoutRepeatedCount(entry.read(ctx), value);
    const provenance = entry.provenance ?? "live";
    return [
      {
        id: entry.nodeId,
        spokeId: node.spokeId,
        label: entry.label(ctx),
        value,
        detail: reading.ratio ?? (provenance === "estimate" ? `Analyst estimate. ${input.phaseOneDetail}.` : reading.missing ?? ""),
        tone: node.status,
        subTab: entry.subTab,
        provenance,
        reading,
      },
    ];
  });
}
