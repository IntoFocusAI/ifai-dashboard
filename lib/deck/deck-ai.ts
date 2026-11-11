/**
 * C-01 deck, AI slides. Each figure is computed by the function its tab calls, on the read that
 * tab shows: the shared date-pill window with its API runs, narrowed by the engine switch.
 */

import { competitorTallies, joinBrands, largestCompetitorGap } from "@/lib/ai-search/competitors";
import { driftRead } from "@/lib/ai-search/drift";
import { factCheckAccuracyLead, factCheckAccuracyStatus } from "@/lib/ai-search/fact-check-copy";
import { competitorCategoryLine, competitorEngineLine } from "@/lib/ai-search/radar-tables";
import { categoryLabel, engineLabel } from "@/lib/ai-search/run-metrics";
import {
  BRANDED_RATE_BANDS,
  pct,
  roleRateLead,
  summarizeRun,
  UNBRANDED_RATE_BANDS,
} from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt, formatRatio } from "@/lib/fender-canvas/format";
import { SOURCES, type DeckBar, type DeckFigure, type DeckInput, type DeckSlide } from "@/lib/deck/deck-types";

const ACT_ONE = "Where the brand stands in AI answers";

/** Keeps a stored sentence to one table cell; the full text stays on Product Fact Checks. */
function clip(text: string, max = 160): string {
  // Brand voice: a stored answer's em dash reads as a comma on the slide.
  const trimmed = text.replace(/\s*\u2014\s*/g, ", ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3).trimEnd()}...` : trimmed;
}

/** Unbranded discovery, branded consideration, and fact accuracy, as Run Summary and Product Fact Checks show them. */
export function aiFigures(snapshot: AiSearchSnapshot, leadBrand: string) {
  const roles = summarizeRun(snapshot).roles;
  const unbranded = roleRateLead(roles.unbranded, UNBRANDED_RATE_BANDS);
  const branded = roleRateLead(roles.branded, BRANDED_RATE_BANDS);
  const accuracy = factCheckAccuracyLead(driftRead(snapshot.calls, snapshot.probes).coverage);
  const figures: Record<"unbranded" | "branded" | "accuracy", DeckFigure | null> = {
    unbranded: unbranded.rate
      ? {
          id: "unbranded",
          label: "Unbranded discovery",
          value: unbranded.rate,
          ratio: `${formatRatio(roles.unbranded.fenderWins, roles.unbranded.resolved)} resolved answers`,
          status: unbranded.status,
          source: SOURCES.runSummary,
          tip: `${formatInt(roles.unbranded.fenderWins)} of ${formatInt(roles.unbranded.resolved)} resolved unbranded discovery answers named ${leadBrand} most.`,
        }
      : null,
    branded: branded.rate
      ? {
          id: "branded",
          label: "Branded consideration",
          value: branded.rate,
          ratio: `${formatRatio(roles.branded.fenderWins, roles.branded.resolved)} resolved answers`,
          status: branded.status,
          source: SOURCES.runSummary,
          tip: `${formatInt(roles.branded.fenderWins)} of ${formatInt(roles.branded.resolved)} resolved branded consideration answers named ${leadBrand} most.`,
        }
      : null,
    accuracy: accuracy.rate
      ? {
          id: "accuracy",
          label: "Product fact accuracy",
          value: accuracy.rate,
          ratio: `${formatInt(accuracy.contradictions)} of ${formatInt(accuracy.checked)} answers contradicted a fact`,
          status: factCheckAccuracyStatus(accuracy.tone),
          source: SOURCES.factChecks,
          tip: accuracy.population,
        }
      : null,
  };
  return { roles, figures };
}

/** s1 and s2. Left out when the window has no resolved unbranded discovery answer. */
export function openingSlides(input: DeckInput, snapshot: AiSearchSnapshot | null): DeckSlide[] {
  if (!snapshot) return [];
  const { roles, figures } = aiFigures(snapshot, input.leadBrand);
  if (!figures.unbranded) return [];
  const { brand } = input;
  const tenths = Math.round((10 * roles.unbranded.fenderWins) / roles.unbranded.resolved);
  const rest = 10 - tenths;
  const title: DeckSlide = {
    id: "s1",
    kind: "title",
    backstage: false,
    act: ACT_ONE,
    headline: `AI assistants recommend ${brand} in ${tenths} of 10 open shopping questions.${rest > 0 ? ` Rivals take the other ${rest}.` : ""}`,
    why: `Shoppers now ask an assistant what to buy before they reach a product page. Every answer that names a rival is a sale ${brand} never gets the chance to win.`,
    figures: [{ ...figures.unbranded, accent: true }],
    sources: [SOURCES.runSummary],
    note: `Unbranded means the shopper did not name ${brand}. Across ${formatInt(roles.unbranded.resolved)} resolved answers in this window, ${input.leadBrand} was the brand named most in ${formatInt(roles.unbranded.fenderWins)}.`,
  };
  const stats = [figures.unbranded, figures.branded, figures.accuracy].filter((f): f is DeckFigure => f != null);
  const brandedAhead = figures.branded != null && roles.branded.fenderWins / roles.branded.resolved > roles.unbranded.fenderWins / roles.unbranded.resolved;
  const second: DeckSlide = {
    id: "s2",
    kind: "stats",
    backstage: false,
    act: ACT_ONE,
    headline: brandedAhead
      ? `When a shopper names ${brand}, AI backs it. When they do not, ${brand} has to earn it.`
      : `Named or not, ${brand} has to earn the AI answer.`,
    why: `Loyal buyers ask for ${brand} by name. New buyers start with an open question, and that is where ${brand} wins or loses share.`,
    figures: stats.map((figure, index) => ({ ...figure, accent: index === 0 })),
    sources: [...new Set(stats.map((figure) => figure.source))],
    note: figures.accuracy
      ? `The facts AI repeats about ${brand} are checked against the facts ${brand} publishes. ${figures.accuracy.tip ?? ""}`.trim()
      : `Product fact checks have no checked answer in this window, so accuracy is left off this slide.`,
  };
  return [title, second];
}

/** s3: rivals ranked by the unbranded answers they lead, as Competitor Wins counts them. */
export function rivalSlide(input: DeckInput, snapshot: AiSearchSnapshot | null): DeckSlide | null {
  if (!snapshot) return null;
  const tallies = competitorTallies(snapshot.calls).filter((row) => row.wins > 0);
  if (tallies.length === 0) return null;
  const total = tallies.reduce((sum, row) => sum + row.wins, 0);
  const resolved = tallies[0].resolved;
  const gap = largestCompetitorGap(snapshot.calls);
  const category = gap ? categoryLabel(gap.category) : null;
  const gapLeaders = gap ? gap.leaders.slice(0, 2) : [];
  const blue = new Map(gapLeaders.map((leader, index) => [leader.brand, (index + 1) as 1 | 2]));
  const top = tallies.slice(0, 5);
  if (blue.size === 0) top.slice(0, 2).forEach((row, index) => blue.set(row.brand, (index + 1) as 1 | 2));
  const bars: DeckBar[] = top.map((row) => ({
    label: row.brand,
    value: row.wins,
    ratio: formatRatio(row.wins, row.resolved),
    tone: blue.get(row.brand) ?? 0,
    detail: competitorCategoryLine(row),
  }));
  const headline =
    gap && category && gapLeaders.length > 0
      ? `${joinBrands(gapLeaders.map((leader) => leader.brand))} ${gapLeaders.length > 1 ? "lead" : "leads"} the ${category.toLowerCase()} answer. ${gapLeaders[0].brand} leads ${formatRatio(gapLeaders[0].wins, gap.resolved)}.`
      : `${tallies[0].brand} leads the most open answers that do not name ${input.brand}: ${formatRatio(tallies[0].wins, resolved)}.`;
  return {
    id: "s3",
    kind: "bars",
    backstage: false,
    act: ACT_ONE,
    headline,
    why: category
      ? `In ${category.toLowerCase()}, an assistant asked for a recommendation names a rival first more often than ${input.brand}. That category is decided before the shopper sees a ${input.brand} listing.`
      : `Each answer a rival leads is decided before the shopper sees a ${input.brand} listing.`,
    figures: [
      {
        id: "competitor-wins",
        label: "Competitors led",
        value: pct(total, resolved),
        ratio: `${formatRatio(total, resolved)} resolved unbranded answers`,
        status: null,
        source: SOURCES.competitorWins,
        tip: `Answers led by each rival, of ${formatInt(resolved)} resolved unbranded discovery answers.`,
      },
    ],
    bars,
    callout:
      gap && category
        ? `${category}: ${gapLeaders.map((leader) => `${leader.brand} ${formatRatio(leader.wins, gap.resolved)}`).join(", ")} answers led.`
        : undefined,
    sources: [SOURCES.competitorWins],
    note: tallies.length > 5 ? `${tallies.length - 5} more rivals are in the backstage rival table.` : "Every rival that led an answer is on this chart.",
  };
}

/** b1: every rival, with its categories and engines. */
export function rivalTableSlide(input: DeckInput, snapshot: AiSearchSnapshot | null): DeckSlide | null {
  if (!snapshot) return null;
  const tallies = competitorTallies(snapshot.calls).filter((row) => row.wins > 0);
  if (tallies.length === 0) return null;
  const shown = tallies.slice(0, 6);
  return {
    id: "b1",
    kind: "table",
    backstage: true,
    act: "Backstage",
    headline: `Every rival that led an open answer, by category and engine.`,
    why: `The full Competitor Wins table behind slide 3.`,
    figures: [],
    table: {
      columns: ["Rival", "Answers led", "Categories", "Engines"],
      rows: shown.map((row) => [
        row.brand,
        formatRatio(row.wins, row.resolved),
        competitorCategoryLine({ ...row, byCategory: row.byCategory.slice(0, 2) }),
        competitorEngineLine({ ...row, byEngine: row.byEngine.slice(0, 2) }),
      ]),
      caption: `${formatInt(shown.length)} of ${formatInt(tallies.length)} rivals, most answers led first. Top two categories and engines each.`,
    },
    sources: [SOURCES.competitorWins],
    note: `Each count is of resolved unbranded discovery answers in the window the date pill names.`,
  };
}

/** b5: the answers that contradicted a fact the brand publishes. */
export function contradictionSlide(input: DeckInput, snapshot: AiSearchSnapshot | null): DeckSlide | null {
  if (!snapshot) return null;
  const drift = driftRead(snapshot.calls, snapshot.probes);
  const confirmed = drift.probes.filter((row) => row.state === "confirmed");
  if (confirmed.length === 0) return null;
  const shown = confirmed.slice(0, 3);
  return {
    id: "b5",
    kind: "table",
    backstage: true,
    act: "Backstage",
    headline: `The AI answers that contradicted a ${input.brand} fact.`,
    why: `Each row is a stored answer next to the fact ${input.brand} publishes.`,
    figures: [],
    table: {
      columns: ["Question", "Engine", `${input.brand} publishes`, "The answer said"],
      rows: shown.map((row) => [clip(row.prompt), engineLabel(row.engine), clip(row.claim ?? ""), clip(row.evidence ?? "")]),
      caption: `${formatInt(shown.length)} of ${formatInt(confirmed.length)} contradicting answers.`,
    },
    sources: [SOURCES.factChecks],
    note: `These are the answers counted as contradicted on Product Fact Checks.`,
  };
}
