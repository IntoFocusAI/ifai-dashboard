"use client";

import type { ReactNode } from "react";
import { CircleCheck, CircleMinus, Equal, TriangleAlert, type LucideIcon } from "lucide-react";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import {
  LEAD_STATUS_LABELS,
  leadSentence,
  leadStatusDefinition,
  ON_TRACK_DEFINITION,
  type CategoryLead,
  type CategoryLeadStatus,
  type CategoryLeadSummary,
} from "@/lib/ai-search/category-on-track";
import { joinBrands } from "@/lib/ai-search/competitors";
import { isSmallSample } from "@/lib/ai-search/run-metrics";
import { SMALL_SAMPLE_LABEL } from "@/lib/ai-search/summary";

/** The icon and the word carry the status. Color only repeats it. */
export const LEAD_STATUS_ICONS: Record<CategoryLeadStatus, LucideIcon> = {
  on_track: CircleCheck,
  tied: Equal,
  behind: TriangleAlert,
  not_available: CircleMinus,
};

const BADGE_TAG: Record<CategoryLeadStatus, string> = {
  on_track: "tag-success",
  tied: "tag-warning",
  behind: "tag-danger",
  not_available: "tag-neutral",
};

const NO_LEADS_DESC =
  "No unbranded discovery answer had a clear leader in this selection, so no category can be marked on track or behind.";

function Term({ name, desc, children }: { name: string; desc: string; children: ReactNode }) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={name}
      data-ifai-tooltip-desc={desc}
      tabIndex={0}
      aria-label={`${name}: ${desc}`}
    >
      {children}
    </span>
  );
}

export function LeadStatusBadge({ lead }: { lead: Pick<CategoryLead, "status" | "asked"> }) {
  const Icon = LEAD_STATUS_ICONS[lead.status];
  const label = LEAD_STATUS_LABELS[lead.status];
  return (
    <span className={`tag-badge ${BADGE_TAG[lead.status]} ai-ontrack-badge`} data-ai-ontrack-badge={lead.status}>
      <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
      <Term name={label} desc={leadStatusDefinition(lead)}>
        {label}
      </Term>
    </span>
  );
}

function LeadBar({ lead }: { lead: CategoryLead }) {
  if (lead.resolved <= 0) return null;
  const share = (count: number) => `${(100 * count) / lead.resolved}%`;
  return (
    <div
      className="ai-ontrack-bar"
      role="img"
      aria-label={`${lead.label}: Fender/Squier leads ${lead.fenderLeads}, other brands lead ${lead.otherLeads}, of ${lead.resolved} resolved answers.`}
    >
      {lead.fenderLeads > 0 ? (
        <span className="ai-ontrack-seg ai-ontrack-seg-fender" data-ai-ontrack-seg="fender" style={{ width: share(lead.fenderLeads) }}>
          <span aria-hidden="true">{lead.fenderLeads}</span>
        </span>
      ) : null}
      {lead.disqualified > 0 ? (
        <span
          className="ai-ontrack-seg ai-ontrack-seg-disqualified"
          data-ai-ontrack-seg="disqualified"
          style={{ width: share(lead.disqualified) }}
        />
      ) : null}
      {lead.otherLeads > 0 ? (
        <span className="ai-ontrack-seg ai-ontrack-seg-other" data-ai-ontrack-seg="other" style={{ width: share(lead.otherLeads) }}>
          <span aria-hidden="true">{lead.otherLeads}</span>
        </span>
      ) : null}
    </div>
  );
}

function Headline({ summary, engineName }: { summary: CategoryLeadSummary; engineName: string | null }) {
  if (summary.measured <= 0) {
    return (
      <div className="ai-ontrack-hero" data-ai-ontrack-summary="">
        <span className="ai-ontrack-hero-figure">
          <Term name="Not available*" desc={NO_LEADS_DESC}>
            Not available*
          </Term>
        </span>
      </div>
    );
  }
  const scope = engineName ? ` in ${engineName} answers` : "";
  const rest = [
    summary.behind.length ? `Behind in ${joinBrands(summary.behind)}.` : "Behind in none.",
    summary.tied.length ? `Tied in ${joinBrands(summary.tied)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="ai-ontrack-hero" data-ai-ontrack-summary="">
      <span className="ai-ontrack-hero-figure" data-ai-ontrack-figure="">
        {summary.onTrack} of {summary.measured}
      </span>
      <span className="ai-ontrack-hero-label">
        categories{" "}
        <Term name="On track" desc={ON_TRACK_DEFINITION}>
          on track
        </Term>
        , where Fender/Squier leads{scope}.
      </span>
      <span className="ai-ontrack-hero-rest">{rest}</span>
    </div>
  );
}

/**
 * Category Battlecards lead: each category marked on track or behind on unbranded discovery,
 * with N of M resolved answers. `chips` render between the headline and the list.
 */
export function CategoryOnTrackVisual({
  leads,
  summary,
  engineName,
  largestResolved,
  showSmallSample,
  chips,
  onClear,
}: {
  leads: readonly CategoryLead[];
  summary: CategoryLeadSummary;
  engineName: string | null;
  largestResolved: number;
  showSmallSample: boolean;
  chips: ReactNode;
  onClear: () => void;
}) {
  return (
    <div className="ai-ontrack" data-ai-battle-lead-graph="" data-ai-on-track="">
      <div className="content-box-title">
        <span>
          Who leads each category on <AiTerm term="unbranded discovery">unbranded discovery</AiTerm>
        </span>
      </div>
      <Headline summary={summary} engineName={engineName} />
      {chips}
      {leads.length === 0 ? (
        <p className="ai-ontrack-empty" data-ai-ontrack-empty="">
          No category matches these filters.{" "}
          <button type="button" className="ai-battle-clear" onClick={onClear}>
            Clear filters
          </button>
        </p>
      ) : (
        <ul className="ai-ontrack-list">
          {leads.map((lead) => {
            const small = showSmallSample && lead.resolved > 0 && isSmallSample(lead.resolved, largestResolved);
            return (
              <li
                key={lead.key}
                className="ai-ontrack-row"
                data-ai-on-track-category={lead.key}
                data-ai-on-track-status={lead.status}
                data-small-sample={small ? "true" : undefined}
              >
                <LeadStatusBadge lead={lead} />
                <div className="ai-ontrack-body">
                  <div className="ai-ontrack-line">
                    <span className="ai-ontrack-category">
                      <EvidenceLink focus={{ field: "category", value: lead.key }} tab={AI_TABS.simulations}>
                        {lead.label}
                      </EvidenceLink>
                    </span>
                    <span data-ai-on-track-sentence="">{leadSentence(lead)}</span>
                    {small ? (
                      <>
                        {" "}
                        <AiTerm term="small sample">{SMALL_SAMPLE_LABEL}</AiTerm>
                      </>
                    ) : null}
                  </div>
                  <LeadBar lead={lead} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
