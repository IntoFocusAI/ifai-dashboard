"use client";

import { CitationPieDisc, sliceColor } from "@/components/v3/live/ai-search/CitationPieDisc";
import { MixedScoringTip } from "@/components/v3/live/ai-search/MixedScoringTip";
import { competitorTallies } from "@/lib/ai-search/competitors";
import {
  competitorLeadPie,
  competitorWinsCount,
  competitorWinsFigure,
} from "@/lib/ai-search/competitor-wins-lead";
import { headlineCompetitorWins } from "@/lib/ai-search/question-role";
import { summarizeRun } from "@/lib/ai-search/summary";
import type { AiSearchSnapshot } from "@/lib/ai-search/types";
import { formatInt } from "@/lib/fender-canvas/format";
import { leadBrand } from "@/lib/brand-copy";

function brandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "other";
}

function HeroFigure({ snapshot, mixed }: { snapshot: AiSearchSnapshot; mixed: boolean }) {
  const summary = summarizeRun(snapshot);
  const competitorWins = summary.competitorWins;
  const resolved = summary.roles.unbranded.resolved;
  const figure = competitorWinsFigure(competitorWins, resolved);
  const count = competitorWinsCount(competitorWins, resolved);
  const at = figure.indexOf(count);
  const pie = competitorLeadPie(competitorWins, resolved);
  const tip = pie
    ? `${formatInt(competitorWins)} competitor led. ${formatInt(resolved - competitorWins)} ${leadBrand()} led. Total ${formatInt(resolved)} resolved unbranded discovery answers.`
    : undefined;

  return (
    <div className="content-box ai-competitor-hero" data-ai-competitor-hero="">
      <div
        data-ai-competitor-hero-row
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          maxWidth: "100%",
        }}
      >
        <span className="ai-lead-figure" data-ai-competitor-lead-figure="">
          {at < 0 ? (
            <MixedScoringTip mixed={mixed}>{figure}</MixedScoringTip>
          ) : (
            <>
              {figure.slice(0, at)}
              <MixedScoringTip mixed={mixed}>{count}</MixedScoringTip>
              {figure.slice(at + count.length)}
            </>
          )}
        </span>
        {pie ? (
          <CitationPieDisc
            pie={pie}
            sizeClass="citation-pie-disc citation-pie-disc-accuracy"
            tip={tip}
          />
        ) : null}
      </div>
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
    <div className="content-box ai-competitor-graph" data-ai-competitor-graph="" style={{ marginTop: 12 }}>
      <ul className="ai-competitor-win-bars">
        {marks.map((mark) => (
          <li key={mark.brand} data-competitor-mark={mark.brand} data-competitor-wins={mark.wins}>
            <div className="ai-competitor-win-meta">
              <strong>{mark.brand}</strong>
              <span>
                {formatInt(mark.wins)} {mark.wins === 1 ? "win" : "wins"}
              </span>
            </div>
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
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bold N-of-M hero and, when any competitor led, the brand graph under it. */
export function CompetitorWinsHero({
  snapshot,
  mixed,
}: {
  snapshot: AiSearchSnapshot;
  mixed: boolean;
}) {
  const summary = summarizeRun(snapshot);
  return (
    <>
      <HeroFigure snapshot={snapshot} mixed={mixed} />
      {summary.competitorWins > 0 ? <WinsGraph snapshot={snapshot} /> : null}
    </>
  );
}
