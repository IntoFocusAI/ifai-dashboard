"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { Term } from "@/components/v3/live/ai-search/CategoryLeadPies";
import { RunDetailsLead } from "@/components/v3/live/ai-search/RunDetailsLead";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import { ON_TRACK_DEFINITION, onTrackPie, type CategoryLeadSummary } from "@/lib/ai-search/category-on-track";
import { joinBrands } from "@/lib/ai-search/competitors";
import type { RoleTally } from "@/lib/ai-search/question-role";
import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";

const NO_LEADS_DESC =
  "No unbranded discovery answer had a clear leader in this selection, so no category can be marked on track, tied, or behind.";

const ROLE_NAMES = {
  unbranded_discovery: "Unbranded discovery",
  branded_consideration: "Branded consideration",
} as const;

function OnTrackHero({ summary }: { summary: CategoryLeadSummary }) {
  const pie = onTrackPie(summary);
  return (
    <div data-ai-on-track-hero="">
      <div>
        <Term name="Categories on track" desc={ON_TRACK_DEFINITION}>
          Categories on track
        </Term>
      </div>
      {pie ? (
        <div className="ai-battle-hero-row">
          <span className="ai-lead-figure" data-ai-ontrack-figure="">
            {summary.onTrack} of {summary.measured}
          </span>
          <CitationPieDisc
            pie={pie}
            tip={`${summary.onTrack} on track. ${summary.tied.length} tied. ${summary.behind.length} behind. Total ${summary.measured} categories with resolved unbranded discovery answers.`}
          />
        </div>
      ) : (
        <span className="ai-lead-figure" data-ai-ontrack-figure="">
          <Term name="Not available*" desc={NO_LEADS_DESC}>
            Not available*
          </Term>
        </span>
      )}
    </div>
  );
}

function onTrackCaption(summary: CategoryLeadSummary): string {
  if (summary.measured <= 0) return "";
  const behind = summary.behind.length ? `Behind in ${joinBrands(summary.behind)}.` : "Behind in none.";
  return summary.tied.length ? `${behind} Tied in ${joinBrands(summary.tied)}.` : behind;
}

function RateCaption({
  role,
  tally,
  showCompetitors = false,
}: {
  role: keyof typeof ROLE_NAMES;
  tally: RoleTally;
  showCompetitors?: boolean;
}) {
  if (tally.resolved <= 0) return <p className="ai-battle-hero-caption" data-ai-battle-role-total={role} />;
  const name = ROLE_NAMES[role];
  return (
    <p className="ai-battle-hero-caption" data-ai-battle-role-total={role}>
      <EvidenceLink focus={{ field: "role", value: `${role}/fender_win` }} tab={AI_TABS.simulations} label={`${name}: Fender/Squier leads`}>
        {tally.fenderWins}
      </EvidenceLink>
      {" of "}
      <EvidenceLink focus={{ field: "role", value: `${role}/resolved` }} tab={AI_TABS.simulations} label={`${name}: resolved answers`}>
        {tally.resolved}
      </EvidenceLink>
      {" resolved answers"}
      {showCompetitors ? (
        <span className="ai-battle-hero-caption-line" data-ai-battle-competitor-led="">
          {"Competitors led "}
          {tally.competitorWins > 0 ? (
            <EvidenceLink
              focus={{ field: "role", value: `${role}/competitor_win` }}
              tab={AI_TABS.simulations}
              label={`${name}: competitors lead`}
            >
              {tally.competitorWins}
            </EvidenceLink>
          ) : (
            0
          )}
          {` of ${tally.resolved}`}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Hero row: categories on track, then the two Run Details rates, side by side.
 * RunDetailsLead's own grid is flattened into this one so the three pies share a row.
 */
export function CategoryBattleHeroes({
  snapshot,
  summary,
  scope,
}: {
  snapshot: AiSearchSnapshot;
  summary: CategoryLeadSummary;
  scope: string | null;
}) {
  const roles = summarizeRun(snapshot).roles;
  return (
    <div className="ai-battle-heroes" data-ai-battle-heroes="">
      <OnTrackHero summary={summary} />
      <RunDetailsLead snapshot={snapshot} />
      <p className="ai-battle-hero-caption" data-ai-on-track-caption="">
        {onTrackCaption(summary)}
      </p>
      <RateCaption role="unbranded_discovery" tally={roles.unbranded} showCompetitors />
      <RateCaption role="branded_consideration" tally={roles.branded} />
      {scope ? (
        <p className="ai-battle-rates-scope" data-ai-battle-rates-scope="">
          {scope}
        </p>
      ) : null}
    </div>
  );
}
