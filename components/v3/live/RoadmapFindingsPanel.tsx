"use client";

import "@/components/v3/live/roadmap-plan.css";
import { useState } from "react";
import { FigureTip, PartialFigureMark } from "@/components/v3/live/FigureTip";
import { RoadmapPhase } from "@/components/v3/live/RoadmapPhase";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { useRoadmapPlan } from "@/components/v3/live/RoadmapPlanData";
import { brandName } from "@/lib/brand-copy";
import { BRIEFING_COUNT_MISSING, BRIEFING_LOADING } from "@/lib/fender-canvas/briefing-retail-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { phaseWindow } from "@/lib/fender-canvas/roadmap-dates";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import {
  PLAN_FIGURE_LABEL,
  PLAN_PHASES,
  emptyPlanLine,
  phaseItems,
  planFindingsFigure,
  planFindingsPie,
  type PlanFindingsFigure,
  type PlanItem,
} from "@/lib/fender-canvas/roadmap-plan";
import { joinList } from "@/lib/fender-canvas/roadmap-sources";

/** Decision 22 (S-04). */
export function roadmapOwnerSentence(): string {
  return `IntoFocus's recommended plan for ${brandName()}`;
}

function LeadFigure({ figure }: { figure: PlanFindingsFigure }) {
  if (figure.phase === "loading") return <>{BRIEFING_LOADING}</>;
  if (figure.phase === "missing") {
    return (
      <FigureTip title={BRIEFING_COUNT_MISSING} desc="No current finding has a stored reading." testId="roadmap-lead">
        {BRIEFING_COUNT_MISSING}
      </FigureTip>
    );
  }
  return (
    <PartialFigureMark partial={figure.partial} testId="roadmap-lead">
      {figure.value}
    </PartialFigureMark>
  );
}

/** S-04: the positions the plan works to win, from the figures it is built on. */
function positionsLine(plan: readonly PlanItem[]): string | null {
  const unbranded = plan.find((item) => item.id === "finding:unbranded_discovery");
  const rivals = plan.filter((item) => item.id.startsWith("signal:rival:")).map((item) => item.label);
  const parts: string[] = [];
  if (unbranded?.ratio) parts.push(`unbranded discovery, now ${unbranded.percent} (${unbranded.ratio})`);
  if (rivals.length) parts.push(`the categories another brand leads: ${joinList(rivals)}`);
  return parts.length ? `Positions this plan works to win: ${parts.join("; ")}.` : null;
}

/**
 * Roadmap · 30-60-90 Days (S-02, S-03, S-04): the plan Action Items ranks, laid out in the three
 * phases of decision 21 g. It rolls: each refresh dates the phases from today and rebuilds the
 * plan from the latest published run and retail read.
 */
export function RoadmapFindingsPanel({ read, bundle }: { read: RetailCanvasRead; bundle: CanvasBundle | null }) {
  const { plan, findings, sources, held, ownPagesReason } = useRoadmapPlan(read, bundle);
  const [today] = useState(() => new Date());
  const figure = planFindingsFigure(findings);
  const pie = planFindingsPie(figure);
  const pending = sources.phase === "loading";
  const empty = pending ? null : emptyPlanLine(plan);
  const positions = positionsLine(plan);

  return (
    <div
      data-roadmap-plan=""
      data-roadmap-sources={sources.phase}
      data-roadmap-held={JSON.stringify(held)}
      data-roadmap-own-pages={ownPagesReason}
    >
      <div className="content-box">
        <p className="roadmap-owner" data-roadmap-owner="">
          {roadmapOwnerSentence()}
        </p>
        <div className="roadmap-lead" data-roadmap-lead="">
          <span className="roadmap-lead-figure" data-roadmap-lead-figure="">
            <LeadFigure figure={figure} />
          </span>
          <span className="roadmap-lead-label">current {PLAN_FIGURE_LABEL}</span>
          {pie ? (
            <CitationPieDisc
              pie={pie}
              tip={`${pie.slices[0]?.key === "measured" ? pie.slices[0].count : 0} of ${pie.total} current findings with a stored reading need action.`}
            />
          ) : null}
        </div>
        {positions ? (
          <p className="roadmap-positions" data-roadmap-positions="">
            {positions}
          </p>
        ) : null}
        {empty ? (
          <p className="plan-empty" data-roadmap-empty="">
            {empty}
          </p>
        ) : null}
      </div>
      <div className="roadmap-phases">
        {PLAN_PHASES.map((phase) => (
          <RoadmapPhase
            key={phase.id}
            phase={phase}
            dates={phaseWindow(phase.id, today).label}
            items={phaseItems(plan, phase.id)}
            pending={pending}
          />
        ))}
      </div>
    </div>
  );
}
