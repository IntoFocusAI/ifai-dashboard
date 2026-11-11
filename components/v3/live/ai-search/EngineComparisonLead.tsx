"use client";

import { StatusMark } from "@/components/v3/live/StatusMark";
import { AiStaleMark } from "@/components/v3/live/ai-search/AiStaleMark";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationPieDisc, type PieDiscInput } from "@/components/v3/live/ai-search/CitationPieDisc";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { MixedScoringTip } from "@/components/v3/live/ai-search/MixedScoringTip";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import type { AiTermKey } from "@/lib/ai-search/definitions";
import {
  HEADLINE_ROLES,
  ROLE_LABELS,
  sumRoleTallies,
  type HeadlineRole,
  type RoleGroupTally,
} from "@/lib/ai-search/question-role";
import {
  BRANDED_RATE_BANDS,
  leadRateTip,
  roleRateLead,
  UNBRANDED_RATE_BANDS,
} from "@/lib/ai-search/summary";
import type { OutcomeTally } from "@/lib/ai-search/run-metrics";
import { formatInt } from "@/lib/fender-canvas/format";
import { leadBrand } from "@/lib/brand-copy";

const SIM = AI_TABS.simulations;

const ROLE_TERMS: Record<HeadlineRole, AiTermKey> = {
  unbranded_discovery: "unbranded discovery",
  branded_consideration: "branded consideration",
};

const ROLE_BANDS: Record<HeadlineRole, { redBelow: number; greenAbove: number }> = {
  unbranded_discovery: UNBRANDED_RATE_BANDS,
  branded_consideration: BRANDED_RATE_BANDS,
};

const ROLE_TITLES: Record<HeadlineRole, string> = {
  unbranded_discovery: "Unbranded Discovery",
  branded_consideration: "Branded Consideration",
};

function ratePie(id: string, title: string, tally: Pick<OutcomeTally, "fenderWins" | "resolved">): PieDiscInput {
  const rest = tally.resolved - tally.fenderWins;
  return {
    id,
    title,
    total: tally.resolved,
    totalLabel: "resolved answers",
    slices: [
      { key: "fender", label: `${leadBrand()} leads`, count: tally.fenderWins },
      { key: "other", label: "Rest of resolved answers", count: rest },
    ].filter((slice) => slice.count > 0),
  };
}

function RateSide({ role, tally, mixed }: { role: HeadlineRole; tally: OutcomeTally; mixed: boolean }) {
  const lead = roleRateLead(tally, ROLE_BANDS[role]);
  const title = ROLE_TITLES[role];
  const name = ROLE_LABELS[role];
  return (
    <div data-ai-role={role}>
      <div>
        <AiTerm term={ROLE_TERMS[role]}>{title}</AiTerm>
      </div>
      {lead.rate != null && lead.color != null ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <span
              className="ai-lead-figure"
              style={{ color: lead.color }}
              data-ai-win-rate={role}
              data-ai-lead-figure={role}
            >
              <MixedScoringTip mixed={mixed} basis={{ label: `${title} rate`, note: leadRateTip(tally) }}>
                {lead.rate}
              </MixedScoringTip>
            </span>
            <AiStaleMark />
            <CitationPieDisc
              pie={ratePie(`engine-${role}`, title, tally)}
              tip={`${formatInt(tally.fenderWins)} ${leadBrand()} leads. ${formatInt(tally.resolved - tally.fenderWins)} rest of resolved answers. Total ${formatInt(tally.resolved)} resolved answers.`}
            />
          </div>
          {lead.status ? <StatusMark status={lead.status} /> : null}
          <p className="ai-role-footnote" style={{ margin: "6px 0 0" }} data-ai-role-total={role}>
            <EvidenceLink focus={{ field: "role", value: `${role}/fender_win` }} tab={SIM} label={`${name}: ${leadBrand()} leads`}>
              {formatInt(tally.fenderWins)}
            </EvidenceLink>
            {" of "}
            <EvidenceLink focus={{ field: "role", value: `${role}/resolved` }} tab={SIM} label={`${name}: resolved answers`}>
              {formatInt(tally.resolved)}
            </EvidenceLink>
            {" resolved answers"}
          </p>
        </>
      ) : (
        <span className="ai-lead-figure" data-ai-lead-figure={role}>
          No resolved answers
        </span>
      )}
    </div>
  );
}

/** Selection totals for the two rates, same numbers the engine table rows add up to. */
export function EngineComparisonLead({ engines, mixed }: { engines: readonly RoleGroupTally[]; mixed: boolean }) {
  return (
    <div className="metric-grid-2" data-ai-engine-comparison-lead="">
      {HEADLINE_ROLES.map((role) => (
        <RateSide key={role} role={role} tally={sumRoleTallies(engines, role)} mixed={mixed} />
      ))}
    </div>
  );
}
