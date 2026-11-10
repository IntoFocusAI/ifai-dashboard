"use client";

import type { ReactNode } from "react";
import { RetailShareDisc, RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import {
  heroFigureColor,
  heroFigureTone,
  retailOverviewHeroes,
  type RetailOverviewHeroModel,
} from "@/lib/fender-canvas/retail-overview-lead";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";

/**
 * One compact Retail Overview hero: label, share %, N of M, pie, short explainer.
 * Click opens that finding's tab (same data-ifai-open path as the old finding cards).
 */
function RetailHeroCard({ hero }: { hero: RetailOverviewHeroModel }) {
  return (
    <div
      className="retail-finding retail-overview-hero"
      data-ifai-open="ecommerce"
      data-ifai-tab={hero.tab}
      data-retail-overview-hero={hero.id}
    >
      <button type="button" className="retail-finding-hit">
        <span className="metric-card-label" data-retail-hero-label="">
          {hero.label}
        </span>
        <span className="retail-overview-hero-row" data-retail-hero-row="">
          <span className="retail-overview-hero-figures">
            <span
              className="ai-lead-figure"
              data-retail-hero-percent=""
              data-retail-hero-tone={hero.tone}
              data-retail-hero-numerator={hero.numerator ?? ""}
              data-retail-hero-denominator={hero.denominator ?? ""}
              style={{ color: heroFigureColor(hero) }}
            >
              {hero.percent}
            </span>
            {hero.ratio ? (
              <span className="retail-overview-hero-ratio" data-retail-hero-ratio="">
                {hero.ratio}
              </span>
            ) : null}
            <RetailStatusMark tone={heroFigureTone(hero)} />
          </span>
          {hero.pie ? <RetailShareDisc pie={hero.pie} measuredKey="contradicted" tip={hero.tip} /> : null}
        </span>
        <span className="metric-card-sub" data-retail-hero-explainer="">
          {hero.explainer}
        </span>
      </button>
    </div>
  );
}

/**
 * Retail Overview share heroes in one row. Optional leading slot (AI Commerce)
 * sits in the same band as Buy Box withheld, MAP leakage, and Catalog Governance.
 */
export function RetailOverviewLead({
  read,
  leading = null,
}: {
  read: RetailCanvasRead;
  leading?: ReactNode;
}) {
  if (read.phase === "loading") {
    return <p className="retail-missing">Loading the retail reading…</p>;
  }
  if (read.phase === "error") {
    return <p className="retail-missing">The retail read could not be loaded.</p>;
  }

  const heroes = retailOverviewHeroes(read.snapshot);

  return (
    <div className="retail-overview-heroes" data-retail-overview-lead="">
      {leading}
      {heroes.map((hero) => (
        <RetailHeroCard key={hero.id} hero={hero} />
      ))}
    </div>
  );
}
