"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { EngineMark, Term } from "@/components/v3/live/ai-search/CategoryLeadPies";
import { RunDetailsLead } from "@/components/v3/live/ai-search/RunDetailsLead";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import {
  HERO_RATES_NOTE,
  ON_TRACK_DEFINITION,
  onTrackPie,
  type CategoryLeadSummary,
} from "@/lib/ai-search/category-on-track";
import { joinBrands } from "@/lib/ai-search/competitors";
import { AI_DEFINITIONS } from "@/lib/ai-search/definitions";
import { scopeEvidence, type EvidenceScope } from "@/lib/ai-search/evidence-focus";
import type { RoleTally } from "@/lib/ai-search/question-role";
import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";

const NO_LEADS_DESC =
  "No unbranded discovery answer had a clear leader in this selection, so no category can be marked on track, tied, or behind.";

const RESOLVED_DESC = `${AI_DEFINITIONS.resolved} ${HERO_RATES_NOTE}`;

const ROLE_NAMES = {
  unbranded_discovery: "Unbranded discovery",
  branded_consideration: "Branded consideration",
} as const;

type EngineView = { engineScope?: EvidenceScope; engineName: string | null };

function OnTrackHero({ summary, engineName }: { summary: CategoryLeadSummary; engineName: string | null }) {
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
            {formatInt(summary.onTrack)} of {formatInt(summary.measured)}
            <EngineMark engineName={engineName} />
          </span>
          <CitationPieDisc
            pie={pie}
            tip={`${formatInt(summary.onTrack)} on track. ${formatInt(summary.tied.length)} tied. ${formatInt(summary.behind.length)} behind. Total ${formatInt(summary.measured)} categories with resolved unbranded discovery answers.`}
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
  engineScope,
  engineName,
}: {
  role: keyof typeof ROLE_NAMES;
  tally: RoleTally;
  showCompetitors?: boolean;
} & EngineView) {
  if (tally.resolved <= 0) return <p className="ai-battle-hero-caption" data-ai-battle-role-total={role} />;
  const name = ROLE_NAMES[role];
  const focus = (outcome: string) => scopeEvidence({ field: "role", value: `${role}/${outcome}` }, engineScope);
  return (
    <p className="ai-battle-hero-caption" data-ai-battle-role-total={role}>
      <EvidenceLink focus={focus("fender_win")} tab={AI_TABS.simulations} label={`${name}: Fender/Squier leads`}>
        {formatInt(tally.fenderWins)}
      </EvidenceLink>
      {" of "}
      <EvidenceLink focus={focus("resolved")} tab={AI_TABS.simulations} label={`${name}: resolved answers`}>
        {formatInt(tally.resolved)}
      </EvidenceLink>
      <EngineMark engineName={engineName} />{" "}
      <Term name="Resolved answers" desc={RESOLVED_DESC}>
        resolved answers
      </Term>
      {showCompetitors ? (
        <span className="ai-battle-hero-caption-line" data-ai-battle-competitor-led="">
          {"Competitors led "}
          {tally.competitorWins > 0 ? (
            <EvidenceLink focus={focus("competitor_win")} tab={AI_TABS.simulations} label={`${name}: competitors lead`}>
              {formatInt(tally.competitorWins)}
            </EvidenceLink>
          ) : (
            0
          )}
          {` of ${formatInt(tally.resolved)}`}
          <EngineMark engineName={engineName} />
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
  engineScope,
  engineName,
}: {
  snapshot: AiSearchSnapshot;
  summary: CategoryLeadSummary;
} & EngineView) {
  const roles = summarizeRun(snapshot).roles;
  return (
    <div className="ai-battle-heroes" data-ai-battle-heroes="">
      <OnTrackHero summary={summary} engineName={engineName} />
      <RunDetailsLead snapshot={snapshot} />
      <p className="ai-battle-hero-caption" data-ai-on-track-caption="">
        {onTrackCaption(summary)}
      </p>
      <RateCaption
        role="unbranded_discovery"
        tally={roles.unbranded}
        showCompetitors
        engineScope={engineScope}
        engineName={engineName}
      />
      <RateCaption role="branded_consideration" tally={roles.branded} engineScope={engineScope} engineName={engineName} />
    </div>
  );
}
