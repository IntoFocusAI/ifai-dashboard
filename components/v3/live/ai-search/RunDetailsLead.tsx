"use client";

import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationPieDisc, type PieDiscInput } from "@/components/v3/live/ai-search/CitationPieDisc";
import { MixedScoringTip } from "@/components/v3/live/ai-search/MixedScoringTip";
import type { AiTermKey } from "@/lib/ai-search/definitions";
import {
  BRANDED_RATE_BANDS,
  roleRateLead,
  summarizeRun,
  UNBRANDED_RATE_BANDS,
} from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import type { RoleTally } from "@/lib/ai-search/question-role";
import { hasMixedScoringMethods } from "@/lib/ai-search/window-display";

function ratePie(
  id: string,
  title: string,
  tally: Pick<RoleTally, "fenderWins" | "resolved">,
): PieDiscInput {
  const rest = tally.resolved - tally.fenderWins;
  return {
    id,
    title,
    total: tally.resolved,
    totalLabel: "resolved answers",
    slices: [
      { key: "fender", label: "Fender/Squier leads", count: tally.fenderWins },
      { key: "other", label: "Rest of resolved answers", count: rest },
    ].filter((slice) => slice.count > 0),
  };
}

function RateSide({
  role,
  term,
  label,
  tally,
  bands,
  pieId,
  mixed,
}: {
  role: "unbranded_discovery" | "branded_consideration";
  term: AiTermKey;
  label: string;
  tally: RoleTally;
  bands: { redBelow: number; greenAbove: number };
  pieId: string;
  mixed: boolean;
}) {
  const lead = roleRateLead(tally, bands);
  return (
    <div data-ai-role={role}>
      <div>
        <AiTerm term={term}>{label}</AiTerm>
      </div>
      {lead.rate != null && lead.color != null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <span
            className="ai-lead-figure"
            style={{ color: lead.color }}
            data-ai-win-rate={role}
            data-ai-lead-figure={role}
          >
            <MixedScoringTip mixed={mixed}>{lead.rate}</MixedScoringTip>
          </span>
          <CitationPieDisc
            pie={ratePie(pieId, label, tally)}
            tip={`${tally.fenderWins} Fender/Squier leads. ${tally.resolved - tally.fenderWins} rest of resolved answers. Total ${tally.resolved} resolved answers.`}
          />
        </div>
      ) : (
        <span className="ai-lead-figure" data-ai-lead-figure={role}>
          No resolved answers
        </span>
      )}
    </div>
  );
}

/** Two lead rates for the tab snapshot: Unbranded Discovery and Branded Consideration. */
export function RunDetailsLead({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const roles = summarizeRun(snapshot).roles;
  const mixed = hasMixedScoringMethods(snapshot);
  return (
    <div className="metric-grid-2" data-ai-run-details-lead="">
      <RateSide
        role="unbranded_discovery"
        term="unbranded discovery"
        label="Unbranded Discovery"
        tally={roles.unbranded}
        bands={UNBRANDED_RATE_BANDS}
        pieId="role-unbranded"
        mixed={mixed}
      />
      <RateSide
        role="branded_consideration"
        term="branded consideration"
        label="Branded Consideration"
        tally={roles.branded}
        bands={BRANDED_RATE_BANDS}
        pieId="role-branded"
        mixed={mixed}
      />
    </div>
  );
}
