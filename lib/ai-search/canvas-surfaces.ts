import type { CanvasMetric, CanvasNode, NodeStatus, PriorityItem } from "@/lib/canvas-sdk/types";
import { citationEvidence, groupCitations } from "@/lib/ai-search/citations";
import {
  battleSentence,
  categoryBattles,
  joinBrands,
  type CategoryBattle,
} from "@/lib/ai-search/competitors";
import {
  factCheckHeadline,
  factCheckShortLine,
  factsCheckedLine,
} from "@/lib/ai-search/fact-check-copy";
import { engineResultRoleTallies, questionRole, type RoleGroupTally } from "@/lib/ai-search/question-role";
import { categoryLabel, engineLabel, MIN_COMPARABLE_RESOLVED } from "@/lib/ai-search/run-metrics";
import {
  errorLine,
  headlineLine,
  pct,
  resolvedPhrase,
  runStateLabel,
  summarizeRun,
  UNBRANDED_RATE_BANDS,
} from "@/lib/ai-search/summary";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { selectionLine } from "@/lib/ai-search/displayed-read";
import { isWindowHistoryKind } from "@/lib/ai-search/window-display";

/** Engines with resolved unbranded answers, weakest Fender-lead share first (same order as Engine Comparison). */
function unbrandedEnginesWeakestFirst(engines: readonly RoleGroupTally[]): RoleGroupTally[] {
  return engines
    .filter((engine) => engine.roles.unbranded_discovery.resolved > 0)
    .slice()
    .sort((a, b) => {
      const aRate = a.roles.unbranded_discovery.fenderWins / a.roles.unbranded_discovery.resolved;
      const bRate = b.roles.unbranded_discovery.fenderWins / b.roles.unbranded_discovery.resolved;
      return aRate - bRate || a.key.localeCompare(b.key);
    });
}

export type NodeFace = Pick<CanvasNode, "status" | "title" | "stats" | "meta" | "tooltip" | "subTab" | "heroValue">;

export const AI_TABS = {
  summary: "Run Summary",
  simulations: "Run Details",
  drift: "Product Fact Checks",
  citations: "Citation Ecosystem",
} as const;

export const RADAR_TABS = {
  battlecards: "Category Battlecards",
  wins: "Competitor Wins",
  engines: "Engine Comparison",
} as const;

const EMPTY_TOOLTIP = { title: "", desc: "" } as const;

/**
 * A main-spoke bubble's status word is self-sufficient (e.g. "Loading run"). It carries no
 * hover explainer. Satellites also stay hoverless: the hero figure is the whole map read.
 * Main bubbles lead with heroValue; satellites use a worded or scored heroValue of their own.
 */
function stateFace(read: AiSearchRead, title: string, subTab: string, hoverless = false): NodeFace | null {
  if (read.phase === "ready") return null;
  const copy = {
    loading: ["Loading run", "Reading the published AI run."],
    error: ["Read failed", `The published AI run did not load. ${read.phase === "error" ? read.message : ""}`],
    "no-run": ["No published run", "No AI run has been published yet, so no AI Search figure is shown."],
  }[read.phase];
  return {
    status: read.phase === "error" ? "danger" : "neutral",
    title,
    stats: [copy[0]],
    // Main spokes render heroValue; a worded value stays at label size (never a fake 0%).
    heroValue: hoverless ? { value: copy[0], label: "" } : undefined,
    meta: "AI Search Visibility",
    subTab,
    tooltip: hoverless ? { ...EMPTY_TOOLTIP } : { title, desc: copy[1].trim() },
  };
}

/** Satellite pending face: worded hero, no hover tooltip. */
function satelliteStateFace(
  read: AiSearchRead,
  title: string,
  subTab: string,
  label: string,
): NodeFace {
  const pending = stateFace(read, title, subTab) as NodeFace;
  return {
    ...pending,
    heroValue: { value: pending.stats[0] ?? "Loading run", label },
    tooltip: { ...EMPTY_TOOLTIP },
  };
}

/** Highest Fender share among categories with a comparable sample, else the largest sample. */
export function strongestCategory(battles: CategoryBattle[]): CategoryBattle | null {
  const resolved = battles.filter((b) => b.resolved > 0);
  const comparable = resolved.filter((b) => b.resolved >= MIN_COMPARABLE_RESOLVED);
  const pool = comparable.length ? comparable : resolved;
  return (
    [...pool].sort(
      (a, b) => b.fenderWins / b.resolved - a.fenderWins / a.resolved || b.resolved - a.resolved,
    )[0] ?? null
  );
}

/** A rate as a 0-100 number, or null when there is no resolved denominator to read. */
function ratePct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (100 * numerator) / denominator : null;
}

/**
 * One main bubble or satellite's hero value: a single scored percentage, red below
 * `redBelow`, green above `greenAbove`, yellow in between. No resolved answers reads neutral.
 */
function heroPctFace(rate: number | null, formatted: string, label: string, redBelow: number, greenAbove: number) {
  const status: NodeStatus = rate === null ? "neutral" : rate < redBelow ? "danger" : rate > greenAbove ? "success" : "warning";
  return { status, heroValue: { value: formatted, label } };
}

export type AiNodeFaces = Record<
  "spokeAeo" | "satPrompts" | "satCitations" | "satDrift" | "spokeCompetitors" | "satGap" | "satLead",
  NodeFace
>;

export function aiNodeFaces(read: AiSearchRead): AiNodeFaces {
  const pending = (title: string, subTab: string, hoverless = false) =>
    stateFace(read, title, subTab, hoverless) as NodeFace;
  if (read.phase !== "ready") {
    return {
      spokeAeo: pending("AI Search Visibility", AI_TABS.summary, true),
      satPrompts: satelliteStateFace(read, "Run Details", AI_TABS.simulations, "Brand Consideration"),
      satCitations: satelliteStateFace(read, "Citations", AI_TABS.citations, "Fender-Owned Links"),
      satDrift: satelliteStateFace(read, "Fact Checks", AI_TABS.drift, "Accuracy"),
      spokeCompetitors: pending("Competitive Radar", RADAR_TABS.battlecards, true),
      satGap: satelliteStateFace(read, "Competitor Wins", RADAR_TABS.wins, "competitors led"),
      satLead: satelliteStateFace(read, "Engine Comparison", RADAR_TABS.engines, "Unbranded discovery"),
    };
  }

  const s = summarizeRun(read.snapshot);
  const { completeness: run, drift, citations } = s;
  const state = runStateLabel(run.state);
  const gap = s.largestGap;
  const weakestEngine = unbrandedEnginesWeakestFirst(engineResultRoleTallies(read.snapshot.calls))[0] ?? null;

  // The main bubble and its three satellites each lead with one scored headline value.
  // Bands are a first draft per metric; a later pass may let intelligence choose the
  // hero metric per brand instead of this fixed AI-Search-Visibility template.
  const unbrandedHero = heroPctFace(
    ratePct(s.roles.unbranded.fenderWins, s.roles.unbranded.resolved),
    pct(s.roles.unbranded.fenderWins, s.roles.unbranded.resolved),
    "Unbranded SOV",
    30,
    65,
  );
  const brandedHero = heroPctFace(
    ratePct(s.roles.branded.fenderWins, s.roles.branded.resolved),
    pct(s.roles.branded.fenderWins, s.roles.branded.resolved),
    "Brand Consideration",
    70,
    90,
  );
  const citationsHero = heroPctFace(
    ratePct(citations.fenderOwnedRows, citations.rows),
    pct(citations.fenderOwnedRows, citations.rows),
    "Fender-Owned Links",
    15,
    35,
  );
  const factAccuracyHero = heroPctFace(
    ratePct(drift.coverage.answersChecked - drift.coverage.contradictions, drift.coverage.answersChecked),
    pct(drift.coverage.answersChecked - drift.coverage.contradictions, drift.coverage.answersChecked),
    "Accuracy",
    95,
    98,
  );

  return {
    spokeAeo: {
      status: unbrandedHero.status,
      title: "AI Search Visibility",
      stats: [],
      heroValue:
        s.roles.unbranded.resolved > 0
          ? unbrandedHero.heroValue
          : { value: "No resolved answers", label: "Unbranded SOV" },
      meta: `${state} run · ${run.answered ?? "?"} of ${run.expected ?? "?"} answered`,
      subTab: AI_TABS.summary,
      // The hero value above is the whole explanation. Open Run Summary for the engine and run detail.
      tooltip: { title: "", desc: "" },
    },
    satPrompts: {
      status: brandedHero.status,
      title: "Run Details",
      stats: [
        `Unbranded ${s.roles.unbranded.fenderWins} of ${s.roles.unbranded.resolved}`,
        `Branded ${s.roles.branded.fenderWins} of ${s.roles.branded.resolved}`,
      ],
      heroValue: brandedHero.heroValue,
      meta: `Completed ${s.completedAt}`,
      subTab: AI_TABS.simulations,
      tooltip: { ...EMPTY_TOOLTIP },
    },
    satCitations: {
      status: citationsHero.status,
      title: "Citations",
      stats: [
        `${citations.answersWithCitation} of ${citations.answered} answers cited sources`,
        `Fender-owned ${pct(citations.fenderOwnedRows, citations.rows)} of links`,
      ],
      heroValue: citationsHero.heroValue,
      meta: `${citations.rows} cited links · ${citations.domains} domains`,
      subTab: AI_TABS.citations,
      tooltip: { ...EMPTY_TOOLTIP },
    },
    satDrift: {
      status: factAccuracyHero.status,
      title: "Fact Checks",
      stats: [factsCheckedLine(drift.coverage), factCheckShortLine(drift.coverage)],
      heroValue: factAccuracyHero.heroValue,
      meta: `Across ${joinBrands(drift.coverage.checkedEngines)}`,
      subTab: AI_TABS.drift,
      tooltip: { ...EMPTY_TOOLTIP },
    },
    spokeCompetitors: {
      // Category Battlecards: lead with the largest category gap when rivals lead there,
      // else the top competitor share across unbranded discovery.
      status: s.competitorWins > 0 ? "warning" : "success",
      title: "Competitive Radar",
      stats: [],
      heroValue: (() => {
        const rival = gap?.leaders[0];
        if (gap && rival != null && gap.resolved > 0) {
          return {
            value: pct(rival.wins, gap.resolved),
            label: `${categoryLabel(gap.category)} · ${rival.brand}`,
          };
        }
        if (s.topCompetitor) {
          return {
            value: pct(s.topCompetitor.wins, s.topCompetitor.resolved),
            label: `${s.topCompetitor.brand} wins`,
          };
        }
        return { value: "No competitor wins", label: "Unbranded discovery" };
      })(),
      meta: `${s.competitorWins} competitor wins · unbranded discovery`,
      subTab: RADAR_TABS.battlecards,
      tooltip: { title: "", desc: "" },
    },
    satGap: {
      status: s.competitorWins > 0 ? "warning" : "success",
      title: "Competitor Wins",
      stats:
        s.roles.unbranded.resolved > 0
          ? [`${s.competitorWins} of ${s.roles.unbranded.resolved} resolved`]
          : ["No resolved answers"],
      heroValue:
        s.roles.unbranded.resolved > 0
          ? {
              value: `${s.competitorWins} of ${s.roles.unbranded.resolved}`,
              label: "competitors led",
            }
          : { value: "No resolved answers", label: "competitors led" },
      meta: "Unbranded discovery",
      subTab: RADAR_TABS.wins,
      tooltip: { ...EMPTY_TOOLTIP },
    },
    satLead: (() => {
      if (weakestEngine) {
        const tally = weakestEngine.roles.unbranded_discovery;
        const engineHero = heroPctFace(
          ratePct(tally.fenderWins, tally.resolved),
          pct(tally.fenderWins, tally.resolved),
          `${engineLabel(weakestEngine.key)} unbranded`,
          UNBRANDED_RATE_BANDS.redBelow,
          UNBRANDED_RATE_BANDS.greenAbove,
        );
        return {
          status: engineHero.status,
          title: "Engine Comparison",
          stats: [`${tally.fenderWins} of ${tally.resolved} Fender leads`],
          heroValue: engineHero.heroValue,
          meta: "Weakest Fender lead first",
          subTab: RADAR_TABS.engines,
          tooltip: { ...EMPTY_TOOLTIP },
        };
      }
      const overall = heroPctFace(
        ratePct(s.roles.unbranded.fenderWins, s.roles.unbranded.resolved),
        pct(s.roles.unbranded.fenderWins, s.roles.unbranded.resolved),
        "Unbranded discovery",
        UNBRANDED_RATE_BANDS.redBelow,
        UNBRANDED_RATE_BANDS.greenAbove,
      );
      return {
        status: overall.status,
        title: "Engine Comparison",
        stats:
          s.roles.unbranded.resolved > 0
            ? [`${s.roles.unbranded.fenderWins} of ${s.roles.unbranded.resolved} resolved`]
            : ["No resolved answers"],
        heroValue:
          s.roles.unbranded.resolved > 0
            ? overall.heroValue
            : { value: "No resolved answers", label: "Unbranded discovery" },
        meta: "Unbranded discovery",
        subTab: RADAR_TABS.engines,
        tooltip: { ...EMPTY_TOOLTIP },
      };
    })(),
  };
}

/** One-line AI Search panel lead. Run facts stay on the pill and on the other tabs' chips. */
export function aiSpokeDesc(read: AiSearchRead): string {
  if (read.phase === "loading") return "Reading the published AI run.";
  if (read.phase === "error" && read.selection) return `${selectionLine(read.selection, false)}.`;
  if (read.phase === "error") return `The published AI run did not load: ${read.message}`;
  if (read.phase === "no-run") return "No AI run has been published yet, so no AI Search figure is shown.";
  return "How AI shopping answers cite the web, and whether Fender-owned pages show up.";
}

export type AiSpokeChip = {
  id: string;
  label: string;
  value: string;
  tone?: "warning" | "neutral";
};

export type AiSpokeHeaderChipsOptions = {
  /** History mode kind. Window modes omit single-run state chips. The pill names the selection. */
  modeKind?: string | null;
};

/** Compact run facts for the AI Search panel header. Keeps every former paragraph fact available. */
export function aiSpokeHeaderChips(read: AiSearchRead, options: AiSpokeHeaderChipsOptions = {}): AiSpokeChip[] {
  if (read.phase !== "ready") return [];
  const s = summarizeRun(read.snapshot);
  const windowed = isWindowHistoryKind(options.modeKind);
  const chips: AiSpokeChip[] = [];
  if (!windowed) {
    if (s.completeness.state !== "historical") {
      chips.push({
        id: "state",
        label: "Run",
        value: runStateLabel(s.completeness.state),
        tone: s.completeness.isPartial ? "warning" : "neutral",
      });
    }
    chips.push(
      { id: "completed", label: "Completed", value: s.completedAt },
      {
        id: "answered",
        label: "Answered",
        value: `${s.completeness.answered ?? "?"} of ${s.completeness.expected ?? "?"}`,
      },
    );
  }
  chips.push(
    { id: "errors", label: "Provider errors", value: errorLine(s), tone: s.errorEngines.length ? "warning" : "neutral" },
    {
      id: "unbranded",
      label: "Unbranded discovery",
      value: resolvedPhrase(s.roles.unbranded),
    },
    {
      id: "branded",
      label: "Branded consideration",
      value: resolvedPhrase(s.roles.branded),
    },
    {
      id: "facts",
      label: "Product fact checks",
      value: factCheckShortLine(s.drift.coverage),
    },
  );
  return chips;
}

/** Full run narrative kept for history banners and tests that need every count in one string. */
export function aiSpokeFullDesc(read: AiSearchRead): string {
  if (read.phase === "loading") return "Reading the published AI run.";
  if (read.phase === "error") return `The published AI run did not load: ${read.message}`;
  if (read.phase === "no-run") return "No AI run has been published yet, so no AI Search figure is shown.";
  const s = summarizeRun(read.snapshot);
  return `${runStateLabel(s.completeness.state)} published run, completed ${s.completedAt}: ${s.completeness.answered} of ${s.completeness.expected} calls answered, ${errorLine(s)}. ${headlineLine(s)} ${factCheckHeadline(s.drift.coverage)}`;
}

/** One sentence for the command center summary. Silent until the run loads. */
export function aiCommandSummary(read: AiSearchRead): string | null {
  if (read.phase === "loading") return null;
  if (read.phase !== "ready") return aiSpokeDesc(read);
  const s = summarizeRun(read.snapshot);
  return `In the published AI run, ${headlineLine(s)} Shopping guidance and product-fact questions are not in either rate.`;
}

/**
 * The Competitive Radar sentence. The N-of-M clause is the figure.
 * The other clauses are the explainer and stay under that figure.
 */
export function competitorsSpokeLead(read: AiSearchRead): { figure: string; explainer: string } {
  if (read.phase !== "ready") return { figure: aiSpokeDesc(read), explainer: "" };
  const s = summarizeRun(read.snapshot);
  return {
    figure: `Competitors led ${s.competitorWins} of ${s.roles.unbranded.resolved} resolved unbranded discovery answers.`,
    explainer:
      "Which brands AI engines name over Fender/Squier on unbranded discovery prompts. Branded consideration, product fact checks, provider errors, and answers with no clear leader are left out.",
  };
}

export function competitorsSpokeDesc(read: AiSearchRead): string {
  const { figure, explainer } = competitorsSpokeLead(read);
  return explainer ? `${figure} ${explainer}` : figure;
}

/** Client priorities this run can prove. Nothing appears while the run is loading or missing. */
export function aiPriorityItems(read: AiSearchRead): PriorityItem[] {
  if (read.phase !== "ready") return [];
  const s = summarizeRun(read.snapshot);
  const items: PriorityItem[] = [];

  if (s.drift.totalConfirmed > 0) {
    items.push({
      id: "ai-confirmed-contradiction",
      title: `${s.drift.totalConfirmed} AI answers contradict a verified Fender fact`,
      why: `In the published run, ${s.drift.totalConfirmed} of ${s.drift.totalChecked} checked answers stated something an official Fender page contradicts. The Product Fact Checks tab shows each question, the verified fact, its Fender source page, and the answer.`,
      impact: "A shopper who reads a wrong spec may buy the wrong product or return it.",
      severity: "critical",
      spokeId: "aeo",
      subTab: AI_TABS.drift,
      defaultOwner: "client",
    });
  }

  const gap = s.largestGap;
  if (gap) {
    const calls = read.snapshot.calls.filter(
      (row) =>
        row.category === gap.category &&
        row.outcome === "competitor_win" &&
        questionRole(row) === "unbranded_discovery",
    );
    const losingIds = new Set(calls.map((row) => row.id));
    const cited = citationEvidence(read.snapshot.calls, read.snapshot.citations, "commercial").rows.filter((row) =>
      losingIds.has(row.simulationId),
    );
    const domains = groupCitations(cited, (row) => row.domain).slice(0, 3).map((group) => group.key);
    const engines = joinBrands([...new Set(calls.map((row) => engineLabel(row.engine)))].sort());
    items.push({
      id: "ai-competitor-gap",
      title: battleSentence(gap),
      why: `In the published run, ${engines} named ${joinBrands(gap.leaders.map((l) => l.brand))} more often than Fender/Squier in ${gap.competitorWins} of ${gap.resolved} resolved unbranded discovery ${gap.category} answers.${domains.length ? ` Those answers cited ${domains.join(", ")}.` : ""} Start with those pages: check how they describe Fender's ${gap.category} line against the brand they favor.`,
      impact: `The Competitor Wins tab lists each of the ${gap.competitorWins} answers with its engine, model, and cited pages.`,
      severity: "high",
      spokeId: "competitors",
      subTab: "Competitor Wins",
      defaultOwner: "client",
    });
  }

  return items;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Action Items cards for the AI priorities, numbered after the three retail and spec cards. */
export function aiActionCardHtml(read: AiSearchRead, firstNumber = 4): string {
  return aiPriorityItems(read)
    .map(
      (item, index) => `
  <div class="action-card${item.severity === "critical" ? " critical" : ""}" style="margin-top:8px;" data-ifai-open="${escapeHtml(item.spokeId ?? "aeo")}" data-ifai-tab="${escapeHtml(item.subTab ?? "")}">
    <div class="action-head">${firstNumber + index}. ${escapeHtml(item.title)}</div>
    <div class="action-details">${escapeHtml(item.why)}</div>
    <div class="action-impact">${escapeHtml(item.impact ?? "")}</div>
  </div>`,
    )
    .join("\n");
}

const pendingMetric = (read: AiSearchRead) =>
  read.phase === "loading"
    ? { value: "Loading", detail: "Reading the published AI run" }
    : read.phase === "error"
      ? { value: "Unavailable", detail: "The published AI run did not load" }
      : { value: "No run", detail: "No AI run has been published" };

export type AiMetricKey =
  | "overallAiWinRate"
  | "beginnerAiWinRate"
  | "resolvedSimulations"
  | "confirmedHallucinations"
  | "beginnerSovGap"
  | "strongestCategorySov";

/** AI Search widget values. Ids stay stable so saved widget choices survive. */
export function aiMetrics(read: AiSearchRead): Record<AiMetricKey, CanvasMetric> {
  const base = {
    overallAiWinRate: { id: "overall-ai-win-rate", spokeId: "aeo", label: "Unbranded discovery", subTab: AI_TABS.summary },
    beginnerAiWinRate: { id: "beginner-ai-win-rate", spokeId: "aeo", label: "Beginner AI Win Rate", subTab: AI_TABS.simulations },
    resolvedSimulations: { id: "resolved-simulations", spokeId: "aeo", label: "Answered AI Calls", subTab: AI_TABS.summary },
    confirmedHallucinations: { id: "confirmed-hallucinations", spokeId: "aeo", label: "Product Fact Checks", subTab: AI_TABS.drift },
    beginnerSovGap: { id: "beginner-sov-gap", spokeId: "competitors", label: "Beginner Category SOV Gap", subTab: RADAR_TABS.battlecards },
    strongestCategorySov: { id: "strongest-category-sov", spokeId: "competitors", label: "Strongest Category SOV", subTab: RADAR_TABS.battlecards },
  } as const;

  if (read.phase !== "ready") {
    const p = pendingMetric(read);
    return Object.fromEntries(
      Object.entries(base).map(([key, m]) => [key, { ...m, ...p, tone: "neutral", provenance: "live" }]),
    ) as Record<AiMetricKey, CanvasMetric>;
  }

  const s = summarizeRun(read.snapshot);
  const beginner = s.categories.find((row) => row.key === "beginner");
  const beginnerBattle = categoryBattles(read.snapshot.calls).find((b) => b.category === "beginner");
  const rival = beginnerBattle?.leaders[0];
  const strongest = strongestCategory(categoryBattles(read.snapshot.calls));
  const live = { provenance: "live" as const };

  return {
    overallAiWinRate: {
      ...base.overallAiWinRate, ...live,
      value: s.roles.unbranded.resolved > 0 ? pct(s.roles.unbranded.fenderWins, s.roles.unbranded.resolved) : "No resolved answers",
      detail: `Unbranded ${resolvedPhrase(s.roles.unbranded)}. Branded consideration ${resolvedPhrase(s.roles.branded)}.`,
      tone: s.roles.unbranded.resolved ? (s.roles.unbranded.fenderWins / s.roles.unbranded.resolved >= 0.75 ? "success" : "warning") : "neutral",
    },
    beginnerAiWinRate: {
      ...base.beginnerAiWinRate, ...live,
      value: beginner ? pct(beginner.fenderWins, beginner.resolved) : "No beginner prompts",
      detail: beginner ? `${beginner.fenderWins} of ${beginner.resolved} resolved beginner answers` : "Not in this run",
      tone: "neutral",
    },
    resolvedSimulations: {
      ...base.resolvedSimulations, ...live,
      value: `${s.completeness.answered} / ${s.completeness.expected}`,
      detail: `${runStateLabel(s.completeness.state)} run · ${errorLine(s)}`,
      tone: s.completeness.isPartial ? "warning" : "success",
    },
    confirmedHallucinations: {
      ...base.confirmedHallucinations, ...live,
      value: factsCheckedLine(s.drift.coverage),
      detail: factCheckShortLine(s.drift.coverage),
      tone: s.drift.totalConfirmed > 0 ? "danger" : "success",
    },
    beginnerSovGap: {
      ...base.beginnerSovGap, ...live,
      value: beginnerBattle && beginnerBattle.resolved
        ? `${(((beginnerBattle.fenderWins - (rival?.wins ?? 0)) * 100) / beginnerBattle.resolved).toFixed(1)} pts`
        : "No beginner prompts",
      detail: beginnerBattle
        ? `Fender/Squier ${beginnerBattle.fenderWins} vs ${rival ? `${rival.brand} ${rival.wins}` : "no rival"} of ${beginnerBattle.resolved} resolved`
        : "Not in this run",
      tone: "neutral",
    },
    strongestCategorySov: {
      ...base.strongestCategorySov, ...live,
      value: strongest ? pct(strongest.fenderWins, strongest.resolved) : "No resolved answers",
      detail: strongest ? `${categoryLabel(strongest.category)} · ${strongest.fenderWins} of ${strongest.resolved} resolved` : "Not in this run",
      tone: "success",
    },
  };
}

export type AiTourLines = { hub: string; aeo: string[]; competitors: string[]; roadmap: string };

export function aiTourLines(read: AiSearchRead): AiTourLines {
  if (read.phase !== "ready") {
    const line = aiSpokeDesc(read);
    return { hub: line, aeo: [line], competitors: [line], roadmap: line };
  }
  const s = summarizeRun(read.snapshot);
  const lead = headlineLine(s);
  return {
    hub: lead,
    aeo: [
      `${runStateLabel(s.completeness.state)} run: ${s.completeness.answered} of ${s.completeness.expected} calls answered, completed ${s.completedAt}`,
      lead,
      `${factsCheckedLine(s.drift.coverage)} against official Fender pages: ${factCheckShortLine(s.drift.coverage).toLowerCase()}`,
    ],
    competitors: [
      s.topCompetitor
        ? `${s.topCompetitor.brand} named most in ${s.topCompetitor.wins} of ${s.topCompetitor.resolved} resolved unbranded discovery answers`
        : "No competitor named most in a resolved unbranded discovery answer",
      s.largestGap ? battleSentence(s.largestGap) : "No category gap in this run",
      "Unbranded discovery answers only",
    ],
    roadmap: lead,
  };
}
