"use client";

import { useMemo } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { AmazonSpecsLastChecked } from "@/components/v3/live/AmazonSpecsLastChecked";
import type { AmazonSpecRowsRead } from "@/components/v3/live/FenderSpecPanel";
import {
  amazonSpecsHeroes,
  resolveAmazonFieldTotals,
  sumAmazonFieldTotals,
  type AiReadinessHeroModel,
} from "@/lib/fender-canvas/ai-readiness-lead";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import { newestAmazonSpecCheckAt } from "@/lib/findability/last-checked";

const PIE_SIZE = "citation-pie-disc citation-pie-disc-amazon-specs";

function ReadinessHero({ hero }: { hero: AiReadinessHeroModel }) {
  return (
    <div
      className="content-box findability-lead-card"
      data-ai-readiness-hero={hero.id}
      data-amazon-specs-hero={hero.id}
    >
      <div>
        {hero.definition ? (
          <span
            className="ifai-term"
            data-ifai-tooltip-title={hero.label}
            data-ifai-tooltip-desc={hero.definition}
            tabIndex={0}
            aria-label={`${hero.label}: ${hero.definition}`}
          >
            {hero.label}
          </span>
        ) : (
          <span>{hero.label}</span>
        )}
      </div>
      <div className="findability-lead-row" data-ai-readiness-hero-row="">
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            style={hero.color ? { color: hero.color } : undefined}
            data-ai-readiness-hero-percent=""
          >
            {hero.percent}
          </span>
          {hero.ratio ? (
            <span className="findability-lead-ratio" data-ai-readiness-hero-ratio="">
              {hero.ratio}
            </span>
          ) : null}
        </div>
        {hero.pie ? (
          <CitationPieDisc pie={hero.pie} sizeClass={PIE_SIZE} tip={hero.tip ?? undefined} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Amazon Specs lead: Amazon attribute completeness only, with Last checked under it.
 * Page-found and brand-site figures live on the bubble / Brand-Site Specs.
 * Field totals come from the metrics row when stored; otherwise from the listing rows.
 * The hero's definition names the same check time as Last checked.
 */
export function AiReadinessLead({ bundle, specRows }: { bundle: CanvasBundle; specRows: AmazonSpecRowsRead }) {
  const metricsTotals = resolveAmazonFieldTotals(bundle.m, null);
  const needsRowTotals = metricsTotals == null;
  const rows = specRows.phase === "ready" ? specRows.rows : null;
  const rowTotals = useMemo(
    () => (needsRowTotals && rows ? sumAmazonFieldTotals(rows) : null),
    [needsRowTotals, rows],
  );

  const checkedAt = useMemo(() => (rows ? newestAmazonSpecCheckAt(rows) : null), [rows]);
  const heroes = amazonSpecsHeroes(bundle.m, metricsTotals ?? rowTotals, checkedAt);

  return (
    <div className="ai-readiness-lead" data-ai-readiness-lead="" data-amazon-specs-lead="">
      <div className="findability-leads" data-ai-readiness-heroes="">
        {heroes.map((hero) => (
          <ReadinessHero key={hero.id} hero={hero} />
        ))}
      </div>
      <AmazonSpecsLastChecked read={specRows} />
    </div>
  );
}
