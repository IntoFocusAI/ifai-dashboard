"use client";

import { useState, useSyncExternalStore } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { briefingFindingsLead, type BriefingFinding } from "@/lib/fender-canvas/briefing-retail-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import {
  buildRoadmapPlan,
  ROADMAP_OWNER_SENTENCE,
  type RoadmapPhasePlan,
} from "@/lib/fender-canvas/roadmap-plan";

const BRIEFING_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

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

function ExploreChevron() {
  return (
    <svg
      className="retail-explore-chevron"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path
        d="M2.2 4.2 6 8l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RoadmapPlanRow({ finding }: { finding: BriefingFinding }) {
  const [open, setOpen] = useState(false);
  const detailId = `roadmap-finding-${finding.id}`;
  const figureName = finding.ratio ? `${finding.percent}. ${finding.ratio}` : finding.percent;

  return (
    <div
      className="retail-finding retail-overview-hero"
      data-briefing-finding={finding.id}
      data-roadmap-finding={finding.id}
      style={{ cursor: "default" }}
    >
      <div className="retail-overview-hero-row" data-briefing-finding-row="" style={{ width: "100%" }}>
        <span
          className="metric-card-label ifai-term"
          data-briefing-finding-label=""
          data-ifai-tooltip-title={finding.label}
          data-ifai-tooltip-desc={finding.explainer}
          tabIndex={0}
          aria-label={`${finding.label}: ${finding.explainer}`}
          style={{ flex: "0 1 auto", width: "fit-content" }}
        >
          {finding.label}
        </span>
        <button
          type="button"
          className="retail-finding-hit retail-explore"
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={`${finding.label}. ${figureName}`}
          onClick={() => setOpen((value) => !value)}
          style={{
            flex: "1 1 auto",
            width: "auto",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <span className="retail-overview-hero-figures" style={{ alignItems: "flex-end" }}>
            <span
              className="ai-lead-figure"
              data-briefing-finding-percent=""
              data-briefing-finding-tone={finding.tone}
              data-briefing-finding-numerator={finding.numerator ?? ""}
              data-briefing-finding-denominator={finding.denominator ?? ""}
              style={{ color: finding.color }}
            >
              {finding.percent}
            </span>
            {finding.ratio ? (
              <span className="retail-overview-hero-ratio" data-briefing-finding-ratio="">
                {finding.ratio}
              </span>
            ) : null}
          </span>
          <ExploreChevron />
        </button>
        {finding.pie ? (
          <CitationPieDisc
            pie={finding.pie}
            sizeClass={BRIEFING_PIE_SIZE}
            tip={finding.tip ?? undefined}
          />
        ) : null}
      </div>
      <p
        id={detailId}
        className="metric-card-sub"
        data-roadmap-finding-explainer=""
        hidden={!open}
        style={{ margin: 0 }}
      >
        <DefinedCopy text={finding.explainer} />
      </p>
    </div>
  );
}

function RoadmapPhase({ phase, showRange }: { phase: RoadmapPhasePlan; showRange: boolean }) {
  return (
    <section className="content-box" data-roadmap-phase={phase.id}>
      <div className="content-box-title">
        <span data-roadmap-phase-label="">{phase.label}</span>
        <span
          className="metric-card-sub"
          data-roadmap-phase-range=""
          style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none" }}
        >
          {showRange ? phase.rangeLabel : ""}
        </span>
      </div>
      <div className="retail-finding-grid">
        {phase.findings.map((finding) => (
          <RoadmapPlanRow key={finding.id} finding={finding} />
        ))}
      </div>
    </section>
  );
}

/**
 * Strategy Roadmap: a dated plan built from the five Summary Briefing findings.
 * A detail opens on this plan. It does not leave for another bubble or tab.
 */
export function RoadmapFindingsPanel({ read }: { read: RetailCanvasRead }) {
  const findability = useFindability();
  const ai = useAiSearch();
  const { findings } = briefingFindingsLead(read, findability, ai);
  const openedOn = usePageOpenedOn();
  const plan = buildRoadmapPlan(findings, openedOn ?? new Date());

  return (
    <div className="retail-health" data-roadmap-findings-panel="">
      <p
        className="metric-card-sub"
        data-roadmap-owner=""
        style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.45, color: "var(--text-main)" }}
      >
        {ROADMAP_OWNER_SENTENCE}
      </p>
      <div data-roadmap-plan="" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {plan.map((phase) => (
          <RoadmapPhase key={phase.id} phase={phase} showRange={openedOn != null} />
        ))}
      </div>
    </div>
  );
}
