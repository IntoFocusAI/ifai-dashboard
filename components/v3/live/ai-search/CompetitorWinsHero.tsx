"use client";

import { StatusMark } from "@/components/v3/live/StatusMark";
import { AiStaleMark } from "@/components/v3/live/ai-search/AiStaleMark";
import { CitationPieDisc, sliceColor } from "@/components/v3/live/ai-search/CitationPieDisc";
import { useAiSearch } from "@/components/v3/live/ai-search/AiSearchContext";
import { MixedScoringTip } from "@/components/v3/live/ai-search/MixedScoringTip";
import { competitorTallies } from "@/lib/ai-search/competitors";
import {
  competitorLeadPie,
  competitorWinsCount,
  competitorWinsStatus,
} from "@/lib/ai-search/competitor-wins-lead";
import { headlineCompetitorWins } from "@/lib/ai-search/question-role";
import { pct, STATUS_COLOR, summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { hasMixedScoringMethods } from "@/lib/ai-search/window-display";
import { leadBrand } from "@/lib/brand-copy";

function brandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "other";
}

/** Compact hero: colored percentage, N of M, and the pie. It sits on the Engines switch row. */
function HeroFigure({ snapshot, mixed }: { snapshot: AiSearchSnapshot; mixed: boolean }) {
  const summary = summarizeRun(snapshot);
  const competitorWins = summary.competitorWins;
  const resolved = summary.roles.unbranded.resolved;
  const pie = competitorLeadPie(competitorWins, resolved);
  if (resolved <= 0) return null;
  const status = competitorWinsStatus(competitorWins, resolved);
  const tip = pie
    ? `${formatInt(competitorWins)} competitor led. ${formatInt(resolved - competitorWins)} ${leadBrand()} led. Total ${formatInt(resolved)} resolved unbranded discovery answers.`
    : undefined;

  return (
    <div className="ai-competitor-hero" data-ai-competitor-hero="">
      <span className="ai-competitor-hero-row" data-ai-competitor-hero-row="">
        <span className="ai-competitor-hero-figures">
          <span
            className="ai-lead-figure"
            style={{ color: status ? STATUS_COLOR[status] : undefined }}
            data-ai-competitor-lead-figure=""
          >
            <MixedScoringTip mixed={mixed}>{pct(competitorWins, resolved)}</MixedScoringTip>
          </span>
          <AiStaleMark />
        </span>
        <span className="ai-competitor-hero-detail">
          <span className="retail-overview-hero-ratio" data-ai-competitor-ratio="">
            {competitorWinsCount(competitorWins, resolved)}
          </span>
          {status ? <StatusMark status={status} /> : null}
        </span>
        {pie ? (
          <CitationPieDisc
            pie={pie}
            sizeClass="citation-pie-disc citation-pie-disc-accuracy"
            tip={tip}
          />
        ) : null}
      </span>
    </div>
  );
}

/** One mark per competitor that led on unbranded losses, largest win count first. */
function WinsGraph({ snapshot }: { snapshot: AiSearchSnapshot }) {
  const brands = headlineCompetitorWins(snapshot.calls);
  const tallies = competitorTallies(snapshot.calls);
  const marks =
    brands.length > 0 ? brands : tallies.map((t) => ({ brand: t.brand, wins: t.wins }));
  if (marks.length === 0) return null;
  const maxWins = Math.max(1, ...marks.map((mark) => mark.wins));

  return (
    <div className="content-box ai-competitor-graph" data-ai-competitor-graph="" style={{ marginTop: 0 }}>
      <ul className="ai-competitor-win-bars">
        {marks.map((mark) => (
          <li key={mark.brand} data-competitor-mark={mark.brand} data-competitor-wins={mark.wins}>
            <strong className="ai-competitor-win-name">{mark.brand}</strong>
            <span
              className="ai-competitor-win-track"
              role="img"
              aria-label={`${mark.brand}: ${formatInt(mark.wins)} wins`}
            >
              <span
                className="ai-competitor-win-fill"
                style={{
                  width: `${(100 * mark.wins) / maxWins}%`,
                  background: sliceColor(brandKey(mark.brand)),
                }}
              />
            </span>
            <span className="ai-competitor-win-count">
              {formatInt(mark.wins)} {mark.wins === 1 ? "win" : "wins"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The compact hero for the Engines switch row. Nothing renders until a run has loaded. */
export function CompetitorWinsHero() {
  const read = useAiSearch();
  if (read.phase !== "ready") return null;
  return <HeroFigure snapshot={read.snapshot} mixed={hasMixedScoringMethods(read.snapshot)} />;
}

/** One bar per competitor that led, when any competitor led. */
export function CompetitorWinsBars({ snapshot }: { snapshot: AiSearchSnapshot }) {
  return summarizeRun(snapshot).competitorWins > 0 ? <WinsGraph snapshot={snapshot} /> : null;
}
