"use client";

import { PlanAction, PlanEvidence, PlanFigure, PlanStatus } from "@/components/v3/live/RoadmapPlanParts";
import type { PlanItem, PLAN_PHASES } from "@/lib/fender-canvas/roadmap-plan";

type Phase = (typeof PLAN_PHASES)[number];

/** One plan action: what it is, its figure and status, the fact and the action, and its evidence. */
function RoadmapItem({ item }: { item: PlanItem }) {
  return (
    <li className="roadmap-item" data-roadmap-item={item.id} data-roadmap-kind={item.kind}>
      <div className="roadmap-item-head">
        <span className="roadmap-item-label" data-roadmap-item-label="">
          {item.rank}. {item.label}
        </span>
        <PlanFigure item={item} />
      </div>
      {item.siteType ? <div className="plan-cell-sub">{item.siteType}</div> : null}
      <PlanAction item={item} />
      <div className="roadmap-item-foot">
        <PlanStatus item={item} />
        <PlanEvidence item={item} />
      </div>
    </li>
  );
}

/** One of the three dated phases (21g), with an explicit line when it holds no action. */
export function RoadmapPhase({ phase, items, pending }: { phase: Phase; items: PlanItem[]; pending: boolean }) {
  return (
    <section className="content-box roadmap-phase" data-roadmap-phase={phase.id} aria-label={phase.label}>
      <div className="roadmap-phase-title">
        <span className="roadmap-phase-days">{phase.label}</span>
        <span className="roadmap-phase-focus">{phase.focus}</span>
      </div>
      {items.length ? (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <RoadmapItem key={item.id} item={item} />
          ))}
        </ol>
      ) : (
        <p className="plan-note" data-roadmap-phase-empty="">
          {pending ? "Loading the actions for this phase." : "No action in this phase in this reading."}
        </p>
      )}
    </section>
  );
}
