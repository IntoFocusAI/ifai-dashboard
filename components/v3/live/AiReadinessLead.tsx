"use client";

import { useEffect, useState } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { specRowsQuery } from "@/lib/canvasData";
import {
  amazonSpecsHeroes,
  resolveAmazonFieldTotals,
  sumAmazonFieldTotals,
  type AiReadinessHeroModel,
  type AmazonFieldTotals,
} from "@/lib/fender-canvas/ai-readiness-lead";
import { loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import type { CanvasBundle, CanvasSpecReadinessRow } from "@/lib/fender-canvas/types";

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
 * Amazon Specs lead: Amazon attribute completeness only.
 * Page-found and brand-site figures live on the bubble / Brand-Site Specs.
 * Field totals come from the metrics row when stored; otherwise from the spec read.
 */
export function AiReadinessLead({ bundle }: { bundle: CanvasBundle }) {
  const metricsTotals = resolveAmazonFieldTotals(bundle.m, null);
  const hasMetricsTotals = metricsTotals != null;
  const [rowTotals, setRowTotals] = useState<AmazonFieldTotals | null>(null);
  const metricsFound = bundle.m.spec_amazon_fields_found;
  const metricsExpected = bundle.m.spec_amazon_fields_expected;

  useEffect(() => {
    if (hasMetricsTotals) {
      setRowTotals(null);
      return;
    }
    let cancelled = false;
    void loadFilteredPages(async (page, size) => {
      const result = await specRowsQuery(page, size);
      return {
        data: (result.data ?? []) as CanvasSpecReadinessRow[],
        error: result.error,
        count: result.count,
      };
    }).then(
      (result) => {
        if (cancelled) return;
        if (result.error) {
          setRowTotals(null);
          return;
        }
        setRowTotals(sumAmazonFieldTotals(result.rows));
      },
      () => {
        if (!cancelled) setRowTotals(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hasMetricsTotals, metricsFound, metricsExpected]);

  const heroes = amazonSpecsHeroes(bundle.m, metricsTotals ?? rowTotals);

  return (
    <div className="ai-readiness-lead" data-ai-readiness-lead="" data-amazon-specs-lead="">
      <div className="findability-leads" data-ai-readiness-heroes="">
        {heroes.map((hero) => (
          <ReadinessHero key={hero.id} hero={hero} />
        ))}
      </div>
    </div>
  );
}
