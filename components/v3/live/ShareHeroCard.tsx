"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import type { PieDiscData } from "@/lib/ai-search/citation-pies";

const RETAIL_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

export type ShareHeroModel = {
  id: string;
  label: string;
  definition: string;
  percent: string;
  ratio: string | null;
  color: string;
  pie: PieDiscData | null;
  tip: string | null;
  explainer: string;
  numerator: number | null;
  denominator: number | null;
  /** Tooltip on the figure itself, e.g. why it is Not available*. */
  figureTip?: string | null;
};

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

function HeroFigure({ hero }: { hero: ShareHeroModel }) {
  const tip = hero.figureTip ?? null;
  return (
    <span
      className={tip ? "ai-lead-figure ifai-term" : "ai-lead-figure"}
      style={{ color: hero.color }}
      data-hero-percent=""
      data-hero-numerator={hero.numerator ?? ""}
      data-hero-denominator={hero.denominator ?? ""}
      {...(tip
        ? {
            "data-ifai-tooltip-title": hero.label,
            "data-ifai-tooltip-desc": tip,
            tabIndex: 0,
            "aria-label": `${hero.label}: ${hero.percent}. ${tip}`,
          }
        : {})}
    >
      {hero.percent}
    </span>
  );
}

/**
 * Same card as the Catalog Governance heroes: defined label, share, N of M, disc,
 * and a chevron that toggles the table named by `controls`. No chevron without a population.
 */
export function ShareHeroCard({
  hero,
  dataAttr,
  open,
  onToggle,
  controls,
  anchorId,
}: {
  hero: ShareHeroModel;
  /** data-* attribute that names this hero for tests, e.g. "data-machine-hero". */
  dataAttr: string;
  open: boolean;
  /** Without a toggle the card has no chevron. */
  onToggle?: () => void;
  controls: string;
  anchorId?: string;
}) {
  return (
    <div
      className="content-box findability-lead-card"
      id={anchorId}
      {...{ [dataAttr]: hero.id }}
      style={{ flex: "0 0 auto", width: "fit-content", maxWidth: "100%" }}
    >
      <div>
        <span
          className="ifai-term"
          data-ifai-tooltip-title={hero.label}
          data-ifai-tooltip-desc={hero.definition}
          tabIndex={0}
          aria-label={`${hero.label}: ${hero.definition}`}
        >
          {hero.label}
        </span>
      </div>
      <div className="findability-lead-row">
        <div className="findability-lead-figures">
          <HeroFigure hero={hero} />
          {hero.ratio ? (
            <span className="findability-lead-ratio" data-hero-ratio="">
              {hero.ratio}
            </span>
          ) : null}
        </div>
        {hero.pie ? (
          <CitationPieDisc pie={hero.pie} sizeClass={RETAIL_PIE_SIZE} tip={hero.tip ?? undefined} />
        ) : null}
      </div>
      <span className="metric-card-sub">{hero.explainer}</span>
      {hero.denominator && onToggle ? (
        <button
          type="button"
          className="retail-explore"
          aria-label={hero.label}
          aria-expanded={open}
          aria-controls={controls}
          onClick={onToggle}
          style={{ marginTop: "auto", alignSelf: "center" }}
        >
          <ExploreChevron />
        </button>
      ) : null}
    </div>
  );
}
