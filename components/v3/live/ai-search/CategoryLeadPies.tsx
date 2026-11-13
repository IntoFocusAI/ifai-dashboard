"use client";

import type { ReactNode } from "react";
import { CircleCheck, CircleMinus, Equal, TriangleAlert, type LucideIcon } from "lucide-react";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { sliceColor } from "@/components/v3/live/ai-search/CitationPieDisc";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { scopeEvidence, type EvidenceScope } from "@/lib/ai-search/evidence-focus";
import {
  categoryLeadPie,
  ENGINE_MARK_TITLE,
  engineOnlyNote,
  LEAD_STATUS_LABELS,
  categoryLeaderLabel,
  leadSentence,
  leadStatusDefinition,
  type CategoryLead,
  type CategoryLeadStatus,
  type LeadPie,
} from "@/lib/ai-search/category-on-track";
import { isSmallSample } from "@/lib/ai-search/run-metrics";
import { SMALL_SAMPLE_LABEL } from "@/lib/ai-search/summary";
import type { DataStatus } from "@/lib/canvas-sdk/data-status";
import { PARTIAL_MARK } from "@/lib/fender-canvas/canvas-reads";
import { leadBrand } from "@/lib/brand-copy";

/** Icons for the who-leads filter chips. The chips carry no status color. */
export const LEAD_STATUS_ICONS: Record<CategoryLeadStatus, LucideIcon> = {
  on_track: CircleCheck,
  tied: Equal,
  behind: TriangleAlert,
  not_available: CircleMinus,
};

/** The brand book status behind each FDD word: Pine check On track, Champagne dash Tied, Oxblood x Behind. */
const LEAD_DATA_STATUS: Record<CategoryLeadStatus, DataStatus | null> = {
  on_track: "good",
  tied: "okay",
  behind: "bad",
  not_available: null,
};

const LEGEND = [
  { key: "fender", label: leadBrand() },
  { key: "competitor_brand", label: "Top rival" },
  { key: "other", label: "Other brands" },
];

const ERROR_LEGEND = { key: "none", label: `${leadBrand()} with a product error` };

export function Term({
  name,
  desc,
  children,
  className,
}: {
  name: string;
  desc: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={className ? `ifai-term ${className}` : "ifai-term"}
      data-ifai-tooltip-title={name}
      data-ifai-tooltip-desc={desc}
      tabIndex={0}
      aria-label={`${name}: ${desc}`}
    >
      {children}
    </span>
  );
}

/** The asterisk on a figure the engine chip narrows (X-25). Nothing shows with all engines. */
export function EngineMark({ engineName }: { engineName: string | null }) {
  if (!engineName) return null;
  return (
    <Term name={ENGINE_MARK_TITLE} desc={engineOnlyNote(engineName)} className="partial-figure-mark ai-battle-engine-mark">
      {PARTIAL_MARK}
    </Term>
  );
}

/** Mark, word, and color for On track, Tied, or Behind. Not available* stays plain. */
export function LeadStatusBadge({ lead }: { lead: Pick<CategoryLead, "status" | "asked"> }) {
  const label = LEAD_STATUS_LABELS[lead.status];
  const status = LEAD_DATA_STATUS[lead.status];
  return (
    <span className="ai-ontrack-badge" data-ai-ontrack-badge={lead.status}>
      <Term name={label} desc={leadStatusDefinition(lead)}>
        {status ? <StatusMark status={status} word={label} /> : label}
      </Term>
    </span>
  );
}

function conicGradient(pie: LeadPie): string {
  let angle = 0;
  const stops = pie.slices.map((slice) => {
    const start = angle;
    angle += (slice.count / pie.total) * 360;
    return `${sliceColor(slice.key)} ${start}deg ${angle}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

/**
 * One small pie per category. The pie sits inside the evidence button, so it is
 * drawn here rather than with CitationPieDisc, which is itself focusable.
 */
function CategoryPie({
  lead,
  small,
  scope,
  engineName,
}: {
  lead: CategoryLead;
  small: boolean;
  scope?: EvidenceScope;
  engineName: string | null;
}) {
  const pie = categoryLeadPie(lead);
  // "Taylor leads Acoustics": the map bubble's wording, for every category (decisions 5 and 40).
  const leader = categoryLeaderLabel(lead);
  const focus = scopeEvidence({ field: "category", value: lead.key }, scope);
  const sentence = leadSentence(lead);
  const opens = engineName ? `Opens these ${engineName} answers in Run Details.` : "Opens these answers in Run Details.";
  return (
    <li
      className="ai-battle-pie"
      data-ai-on-track-category={lead.key}
      data-ai-on-track-status={lead.status}
      data-small-sample={small ? "true" : undefined}
    >
      {pie ? (
        <span
          className="ifai-term citation-chart-tip ai-battle-pie-tip"
          data-ifai-tooltip-title={lead.label}
          data-ifai-tooltip-desc={`${sentence} ${opens}`}
        >
          <EvidenceLink focus={focus} tab={AI_TABS.simulations} label={`${lead.label}. ${sentence} ${opens}`}>
            <span
              className="citation-pie-disc ai-battle-pie-disc"
              style={{ background: conicGradient(pie) }}
              data-ai-battle-pie-disc={lead.key}
            />
          </EvidenceLink>
        </span>
      ) : (
        <span className="citation-pie-disc ai-battle-pie-empty" aria-hidden="true" data-ai-battle-pie-empty="" />
      )}
      <div className="ai-battle-pie-meta">
        <span className="ai-battle-pie-name">
          <EvidenceLink focus={focus} tab={AI_TABS.simulations}>
            {lead.label}
          </EvidenceLink>
          <EngineMark engineName={engineName} />
        </span>
        <LeadStatusBadge lead={lead} />
        {leader ? (
          <span className="ai-battle-pie-rival" data-ai-battle-leader={leader} data-ai-battle-rival={lead.topRival?.brand}>
            {leader}
          </span>
        ) : null}
        {small ? (
          <span className="ai-battle-pie-rival">
            <AiTerm term="small sample">{SMALL_SAMPLE_LABEL}</AiTerm>
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Category Battlecards: a compact grid of small pies, one per category, under the hero row. */
export function CategoryLeadPies({
  leads,
  largestResolved,
  showSmallSample,
  onClear,
  scope,
  engineName,
}: {
  leads: readonly CategoryLead[];
  largestResolved: number;
  showSmallSample: boolean;
  onClear: () => void;
  /** The engine chip's narrowing, carried into every pie's link. */
  scope?: EvidenceScope;
  engineName: string | null;
}) {
  const legend = leads.some((lead) => lead.disqualified > 0) ? [...LEGEND, ERROR_LEGEND] : LEGEND;
  return (
    <div className="ai-battle-pies-block" data-ai-battle-lead-graph="" data-ai-on-track="">
      <div className="content-box-title ai-battle-pies-head">
        <span>
          Who leads each category on <AiTerm term="unbranded discovery">unbranded discovery</AiTerm>
        </span>
        <ul className="ai-battle-legend" aria-label="Pie colors">
          {legend.map((item) => (
            <li key={item.key} data-ai-battle-legend={item.key}>
              <span className="ai-battle-swatch" style={{ background: sliceColor(item.key) }} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      {leads.length === 0 ? (
        <p className="ai-ontrack-empty" data-ai-ontrack-empty="">
          No category matches these filters.{" "}
          <button type="button" className="ai-battle-clear" onClick={onClear}>
            Clear filters
          </button>
        </p>
      ) : (
        <ul className="ai-battle-pies">
          {leads.map((lead) => (
            <CategoryPie
              key={lead.key}
              lead={lead}
              small={showSmallSample && lead.resolved > 0 && isSmallSample(lead.resolved, largestResolved)}
              scope={scope}
              engineName={engineName}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
