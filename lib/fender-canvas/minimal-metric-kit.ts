/**
 * Shared pieces for the Minimal view metric list. Each area file lists its entries with these
 * helpers, and minimal-metrics.ts strings the areas together in map order.
 */

import type { PieDiscData } from "@/lib/ai-search/citation-pies";
import { roleRateLead, summarizeRun, type AiRunSummary } from "@/lib/ai-search/summary";
import type { AiSearchRead, AiSearchSnapshot } from "@/lib/ai-search/types";
import type { CanvasMetricReading } from "@/lib/canvas-sdk/minimal-view-types";
import type { CanvasMetric, CanvasNode, NodeStatus } from "@/lib/canvas-sdk/types";
import type { FindabilityRead } from "@/lib/findability/copy";
import type { AmazonFieldTotals } from "@/lib/fender-canvas/ai-readiness-lead";
import { scoreAgainst100Pie, scoreTone } from "@/lib/fender-canvas/consensus-score-display";
import { formatInt, formatPct, formatRatio } from "@/lib/fender-canvas/format";
import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { StockLossRow } from "@/lib/fender-canvas/stock-loss";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/** The Out of Stock rows, loaded once for the slots the same way the tab loads them. */
export type StockLossRead =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; rows: StockLossRow[]; populationCount: number | null };

export type MinimalMetricInput = {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
  /** The published run, as the map reads it. */
  ai: AiSearchRead;
  findability: FindabilityRead;
  /** The viewer's saved authorized sellers, as AI Commerce reads them. */
  authorizedPartners: readonly string[] | null;
  stockLoss: StockLossRead;
  /** Amazon Specs field totals when the metrics row does not store them. */
  amazonFieldTotals: AmazonFieldTotals | null;
  /** Analyst estimates, as the Action Items tabs read them. */
  phaseOne: Pick<CanvasMetric, "value" | "detail">;
  enterprise: Pick<CanvasMetric, "value" | "detail">;
};

export type MinimalContext = MinimalMetricInput & {
  node: (id: string) => CanvasNode | undefined;
};

/** What one entry reads for the slots. */
export type MinimalFigure = CanvasMetricReading & {
  value: string;
  tone: NodeStatus;
  /** Words after "Analyst estimate." on an estimate. */
  estimate?: string;
};

export type MinimalEntry = {
  /** Stored in the viewer's slots. A map bubble's entry keeps the bubble id. */
  id: string;
  spokeId: string;
  /** The tab the slot opens. It must show this figure. */
  tab: string;
  label: string | ((ctx: MinimalContext) => string);
  provenance?: "live" | "estimate";
  /** False leaves the option out of the picker, e.g. a sales source with no listings. */
  offered?: (ctx: MinimalContext) => boolean;
  read: (ctx: MinimalContext) => MinimalFigure;
};

/** Every slot reads "Not available*" for a missing input, the way the tabs do. */
export const NOT_AVAILABLE = "Not available*";

const caches = new WeakMap<MinimalContext, Map<string, unknown>>();

/** One computation per build, shared by every entry that needs it. */
export function cached<T>(ctx: MinimalContext, key: string, compute: () => T): T {
  let cache = caches.get(ctx);
  if (!cache) {
    cache = new Map();
    caches.set(ctx, cache);
  }
  if (!cache.has(key)) cache.set(key, compute());
  return cache.get(key) as T;
}

export function runSummary(ctx: MinimalContext): AiRunSummary | null {
  return cached(ctx, "run-summary", () => (ctx.ai.phase === "ready" ? summarizeRun(ctx.ai.snapshot) : null));
}

export function isNotAvailable(value: string): boolean {
  return /^(not available\*?|pending data)$/i.test(value.trim());
}

const NO_READING = { ratio: null, pie: null, tip: null } as const;

export function loadingFigure(reason: string): MinimalFigure {
  return { value: "Loading", tone: "neutral", ...NO_READING, missing: reason };
}

export function missingFigure(reason: string): MinimalFigure {
  return { value: NOT_AVAILABLE, tone: "warning", ...NO_READING, missing: reason };
}

type Blocked = { loading: boolean; reason: string };

function blockedFigure(blocked: Blocked): MinimalFigure {
  return blocked.loading ? loadingFigure(blocked.reason) : missingFigure(blocked.reason);
}

function retailBlocked(ctx: MinimalContext): Blocked | null {
  if (ctx.retail.phase === "loading") return { loading: true, reason: "The retail read is still loading." };
  if (ctx.retail.phase === "error") return { loading: false, reason: "The retail read could not be loaded." };
  return null;
}

function aiBlocked(ctx: MinimalContext): Blocked | null {
  if (ctx.ai.phase === "loading") return { loading: true, reason: "The published AI run is still loading." };
  if (ctx.ai.phase === "error") return { loading: false, reason: "The published AI run did not load." };
  if (ctx.ai.phase === "no-run" || !runSummary(ctx)) return { loading: false, reason: "No AI run has been published yet." };
  return null;
}

export function retailFigure(ctx: MinimalContext, read: (snapshot: PortfolioRetailSnapshot) => MinimalFigure): MinimalFigure {
  if (ctx.retail.phase === "ready") return read(ctx.retail.snapshot);
  return blockedFigure(retailBlocked(ctx)!);
}

export function aiFigure(
  ctx: MinimalContext,
  read: (summary: AiRunSummary, snapshot: AiSearchSnapshot) => MinimalFigure,
): MinimalFigure {
  const summary = runSummary(ctx);
  if (ctx.ai.phase === "ready" && summary) return read(summary, ctx.ai.snapshot);
  return blockedFigure(aiBlocked(ctx)!);
}

/** A map bubble's figure: the value and tone come from the bubble, the rest from its tab. */
export function bubbleEntry(
  entry: Omit<MinimalEntry, "read" | "offered"> & {
    read: (ctx: MinimalContext) => CanvasMetricReading & { estimate?: string };
  },
): MinimalEntry {
  return {
    ...entry,
    offered: (ctx) => Boolean(ctx.node(entry.id)?.heroValue),
    read: (ctx) => {
      const node = ctx.node(entry.id)!;
      const value = node.heroValue?.value ?? "";
      return {
        ...entry.read(ctx),
        value: /^not available\*?$/i.test(value.trim()) ? NOT_AVAILABLE : value,
        tone: node.status,
      };
    },
  };
}

/** The reading behind a bubble, from the gated read, or the reason it is missing. */
export function retailReading(
  ctx: MinimalContext,
  read: (snapshot: PortfolioRetailSnapshot) => CanvasMetricReading,
): CanvasMetricReading {
  if (ctx.retail.phase === "ready") return read(ctx.retail.snapshot);
  return { ...NO_READING, missing: retailBlocked(ctx)!.reason };
}

export function aiReading(ctx: MinimalContext, read: (summary: AiRunSummary) => CanvasMetricReading): CanvasMetricReading {
  const summary = runSummary(ctx);
  if (ctx.ai.phase === "ready" && summary) return read(summary);
  return { ...NO_READING, missing: aiBlocked(ctx)!.reason };
}

/** "N of M" plus the noun, or the reason when either side is not stored. */
export function counted(
  ratio: string | null,
  noun: string,
  pie: PieDiscData | null,
  tip: string | null,
  missing: string,
): CanvasMetricReading {
  if (!ratio) return { ...NO_READING, missing };
  return { ratio: `${ratio} ${noun}`, pie, tip, missing: null };
}

export function toneFromColor(color: string | null | undefined): NodeStatus {
  if (!color) return "neutral";
  if (color.includes("danger")) return "danger";
  if (color.includes("warning")) return "warning";
  if (color.includes("success")) return "success";
  return "neutral";
}

/** The hero model shape the tab leads share: a share figure, N of M, and a disc. */
type HeroModel = {
  percent: string;
  ratio: string | null;
  color: string | null;
  pie: PieDiscData | null;
  tip: string | null;
  explainer?: string;
  tone?: NodeStatus;
};

export function heroFigure(hero: HeroModel, noun: string, missing: string): MinimalFigure {
  if (hero.ratio == null || isNotAvailable(hero.percent)) return missingFigure(hero.explainer ?? missing);
  return {
    value: hero.percent,
    tone: hero.tone ?? toneFromColor(hero.color),
    ratio: `${hero.ratio} ${noun}`,
    pie: hero.pie,
    tip: hero.tip,
    missing: null,
  };
}

/** Fender/Squier leads versus the rest of resolved answers, as the AI tab leads draw it. */
export function rateLeadPie(id: string, title: string, wins: number, resolved: number): PieDiscData | null {
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

export function rateTip(wins: number, resolved: number): string {
  return `${wins} Fender/Squier leads. ${resolved - wins} rest of resolved answers. Total ${resolved} resolved answers.`;
}

/** A Fender-lead rate. The pie is the one the tab draws, or null when the tab draws none. */
export function rateFigure(
  tally: { fenderWins: number; resolved: number },
  bands: { redBelow: number; greenAbove: number },
  noun: string,
  pie: PieDiscData | null,
  empty: string,
): MinimalFigure {
  const lead = roleRateLead(tally, bands);
  if (lead.rate == null) return missingFigure(empty);
  return {
    value: lead.rate,
    tone: toneFromColor(lead.color),
    ratio: `${formatInt(tally.fenderWins)} of ${formatInt(tally.resolved)} ${noun}`,
    pie,
    tip: pie ? rateTip(tally.fenderWins, tally.resolved) : null,
    missing: null,
  };
}

/** An AI Consensus score hero: 0 to 100, inputs in, and the score-against-100 disc. */
export function scoreFigure(
  pieId: string,
  label: string,
  pillar: { score: number | null; coverage: { numerator: number; denominator: number } | null },
  missing: string,
): MinimalFigure {
  if (pillar.score == null) return missingFigure(missing);
  const ratio = pillar.coverage ? formatRatio(pillar.coverage.numerator, pillar.coverage.denominator) : null;
  return {
    value: formatPct(pillar.score, 0),
    tone: scoreTone(pillar.score) ?? "neutral",
    ratio: ratio ? `${ratio} inputs in` : null,
    pie: scoreAgainst100Pie(pieId, label, pillar.score),
    tip: ratio ? `${label}: ${formatPct(pillar.score)} · ${ratio} of inputs in.` : null,
    missing: null,
  };
}
