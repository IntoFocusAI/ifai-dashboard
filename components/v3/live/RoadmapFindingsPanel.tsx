"use client";

import { useState, useSyncExternalStore } from "react";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { briefingFindingsLead } from "@/lib/fender-canvas/briefing-retail-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import {
  buildRoadmapPlan,
  ROADMAP_OWNER_SENTENCE,
  type RoadmapPhasePlan,
  type RoadmapPlanStep,
} from "@/lib/fender-canvas/roadmap-plan";

let pageOpenedOn: Date | null = null;

function subscribeToOpenedOn(): () => void {
  return () => {};
}

function readPageOpenedOn(): Date {
  pageOpenedOn ??= new Date();
  return pageOpenedOn;
}

/** Local calendar day the page opened. Null during server render so the range does not mismatch. */
function usePageOpenedOn(): Date | null {
  return useSyncExternalStore(subscribeToOpenedOn, readPageOpenedOn, () => null);
}

function RoadmapStep({ step }: { step: RoadmapPlanStep }) {
  const { finding, action } = step;
  const [open, setOpen] = useState(false);
  const detailId = `roadmap-finding-${finding.id}`;

  return (
    <div data-briefing-finding={finding.id} data-roadmap-finding={finding.id} data-roadmap-step={finding.id}>
      <div className="roadmap-step-head">
        <span
          className="ifai-term"
          data-briefing-finding-label=""
          data-ifai-tooltip-title={finding.label}
          data-ifai-tooltip-desc={finding.explainer}
          tabIndex={0}
          aria-label={`${finding.label}: ${finding.explainer}`}
        >
          {finding.label}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={finding.ratio ? `${finding.label}. ${finding.percent}. ${finding.ratio}` : `${finding.label}. ${finding.percent}`}
          onClick={() => setOpen((value) => !value)}
        >
          <span
            data-briefing-finding-percent=""
            data-briefing-finding-tone={finding.tone}
            data-briefing-finding-numerator={finding.numerator ?? ""}
            data-briefing-finding-denominator={finding.denominator ?? ""}
            style={{ color: finding.color }}
          >
            {finding.percent}
          </span>
          {finding.ratio ? <span data-briefing-finding-ratio="">{finding.ratio}</span> : null}
        </button>
      </div>
      <p data-roadmap-action="">{action}</p>
      <p id={detailId} data-roadmap-finding-explainer="" hidden={!open}>
        <DefinedCopy text={finding.explainer} />
      </p>
    </div>
  );
}

function RoadmapPhase({ phase, showRange }: { phase: RoadmapPhasePlan; showRange: boolean }) {
  return (
    <section className="content-box roadmap-plan-phase" data-roadmap-phase={phase.id}>
      <div className="content-box-title">
        <span data-roadmap-phase-label="">{phase.heading}</span>
      </div>
      <p className="metric-card-sub" data-roadmap-phase-range="" data-roadmap-phase-focus={phase.focus}>
        {showRange ? phase.rangeLabel : ""}
      </p>
      <div className="roadmap-step-list">
        {phase.steps.map((step) => (
          <RoadmapStep key={step.finding.id} step={step} />
        ))}
      </div>
    </section>
  );
}

/**
 * Strategy Roadmap: three phases across the panel. Each step names the finding,
 * its current figure, and what to do. A detail opens here.
 */
export function RoadmapFindingsPanel({ read }: { read: RetailCanvasRead }) {
  const findability = useFindability();
  const ai = useAiSearch();
  const { findings } = briefingFindingsLead(read, findability, ai);
  const openedOn = usePageOpenedOn();
  const plan = buildRoadmapPlan(findings, openedOn ?? new Date());

  return (
    <div className="retail-health" data-roadmap-findings-panel="">
      <style>{`
        .roadmap-plan-columns {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 12px;
          container-type: inline-size;
        }
        .roadmap-plan-phase {
          flex: 1 1 0;
          min-width: 0;
          align-self: flex-start;
          gap: 8px;
          padding: 12px;
        }
        .roadmap-plan-phase .content-box-title {
          align-items: flex-start;
          line-height: 1.3;
        }
        .roadmap-plan-phase [data-roadmap-phase-range] {
          margin: 0;
        }
        .roadmap-step-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .roadmap-step-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 4px 10px;
        }
        .roadmap-step-head .ifai-term {
          width: fit-content;
          max-width: 100%;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.3;
          color: var(--text-main);
        }
        .roadmap-step-head button {
          appearance: none;
          display: inline-flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: flex-end;
          gap: 2px 8px;
          margin-left: auto;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: right;
          cursor: pointer;
        }
        .roadmap-step-head [data-briefing-finding-percent] {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 750;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .roadmap-step-head [data-briefing-finding-ratio] {
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.3;
        }
        .roadmap-step-list [data-roadmap-action],
        .roadmap-step-list [data-roadmap-finding-explainer] {
          margin: 4px 0 0;
          color: var(--text-main);
          font-size: 13px;
          line-height: 1.4;
        }
        .roadmap-step-list [data-roadmap-finding-explainer] {
          color: var(--text-muted);
        }
        [data-roadmap-owner] {
          margin: 12px 0 0;
          color: var(--text-main);
          font-size: 13px;
          line-height: 1.45;
        }
        @container (max-width: 520px) {
          .roadmap-plan-phase {
            flex: 1 1 100%;
          }
        }
      `}</style>
      <div className="roadmap-plan-columns" data-roadmap-plan="">
        {plan.map((phase) => (
          <RoadmapPhase key={phase.id} phase={phase} showRange={openedOn != null} />
        ))}
      </div>
      <p data-roadmap-owner="">{ROADMAP_OWNER_SENTENCE}</p>
    </div>
  );
}
