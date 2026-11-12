/**
 * C-01: the generated briefing deck. Every slide is built from the reads the dashboard screens
 * already make, through the same functions those screens call, so each figure on a slide equals
 * the figure on its source tab. A slide whose data is missing is left out, never filled with
 * Not available*.
 */

import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import type { SpecPageSummary } from "@/lib/fender-canvas/machine-readability";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { StockLossRow } from "@/lib/fender-canvas/stock-loss";
import type { FindabilityRead } from "@/lib/findability/copy";

/** Dashboard area and tab a figure is read from, as the deck names it: "Catalog Health, MAP Leakage". */
export type DeckSource = string;

export type DeckFigure = {
  id: string;
  label: string;
  /** The figure as its tab shows it, asterisk included when the tab marks it partial. */
  value: string;
  /** N of M, as its tab shows it. */
  ratio: string | null;
  status: DataStatus | null;
  /** Status word when the tab uses its own (Critical, At risk). Defaults to Poor, Fair, Good. */
  statusWord?: string;
  source: DeckSource;
  /** Tooltip text the tab carries for this figure. */
  tip: string | null;
  /** Dollar figures carry the analyst estimate label. */
  estimate?: boolean;
  /** The one ice-blue figure on its slide. */
  accent?: boolean;
};

export type DeckBar = {
  label: string;
  value: number;
  ratio: string;
  /** 1 and 2 are the two blue series; 0 is gray. */
  tone: 0 | 1 | 2;
  detail: string;
};

export type DeckFix = {
  rank: number;
  action: string;
  ratio: string;
  status: DataStatus | null;
  statusWord: string;
};

export type DeckMarker = { title: string; line: string };

export type DeckSlideKind = "title" | "stats" | "bars" | "pipeline" | "fixes" | "table";

export type DeckSlide = {
  /** s1 to s9 for the main flow, b1 to b5 for backstage. */
  id: string;
  kind: DeckSlideKind;
  backstage: boolean;
  act: string;
  headline: string;
  why: string;
  figures: DeckFigure[];
  bars?: DeckBar[];
  callout?: string;
  steps?: string[];
  markers?: DeckMarker[];
  fixes?: DeckFix[];
  /** Line under the fix list, for example the Phase 1 analyst estimate. */
  meta?: DeckFigure | null;
  table?: { columns: string[]; rows: string[][]; caption: string };
  sources: DeckSource[];
  note: string;
};

export type DeckOmission = { id: string; reason: string };

export type DeckModel = {
  brand: string;
  title: string;
  window: string;
  runId: string | null;
  asOf: string | null;
  slides: DeckSlide[];
  omitted: DeckOmission[];
};

export type DeckInput = {
  brand: string;
  brandSite: string;
  /** "Fender/Squier" for Fender, else the brand. */
  leadBrand: string;
  /** What the AI Search and Competitive Radar tabs read: the date-pill window with its API runs. */
  tabAi: AiSearchSnapshot | null;
  /** What Summary and Action Items read: the published run with its matching API run. */
  mapAi: AiSearchSnapshot | null;
  mapAiStale?: PartialFigure | null;
  retail: RetailCanvasRead;
  findability: FindabilityRead;
  specPages: SpecPageSummary | null;
  stockLoss: { rows: readonly StockLossRow[]; populationCount: number | null } | null;
  /** The shared date pill's label. */
  windowLabel: string;
  asOf: string | null;
  /** Hand-entered analyst estimates; null when the client has none. */
  phaseOneLift: string | null;
  enterprisePotential: string | null;
};

export const SOURCES = {
  runSummary: "AI Search Visibility, Run Summary",
  factChecks: "AI Search Visibility, Product Fact Checks",
  competitorWins: "Competitive Radar, Competitor Wins",
  suppressed: "Catalog Health, Suppressed Listings",
  outOfStock: "Catalog Health, Out of Stock",
  map: "Catalog Health, MAP Leakage",
  governance: "Catalog Health, Catalog Governance",
  findability: "AI Readiness, Findability",
  brandSiteSpecs: "AI Readiness, Brand-Site Specs",
  actionItems: "Action Items, Urgent Interventions",
  revenueEstimates: "Action Items, Revenue Estimates",
  summaryBriefing: "Summary, Briefing",
} as const;

export const ANALYST_ESTIMATE = "analyst estimate";
