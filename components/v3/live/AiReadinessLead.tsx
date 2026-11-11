"use client";

import { useMemo } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { AmazonSpecsLastChecked } from "@/components/v3/live/AmazonSpecsLastChecked";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import type { AmazonSpecRowsRead } from "@/components/v3/live/FenderSpecPanel";
import {
  amazonSpecsHeroes,
  resolveAmazonFieldTotals,
  sumAmazonFieldTotals,
  type AiReadinessHeroModel,
} from "@/lib/fender-canvas/ai-readiness-lead";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import { requiredAmazonSpecList } from "@/lib/fender-canvas/spec-missing-fields";
import type { CanvasBundle } from "@/lib/fender-canvas/types";
import { amazonSpecsStale, newestAmazonSpecCheckAt } from "@/lib/findability/last-checked";

const PIE_SIZE = "citation-pie-disc citation-pie-disc-amazon-specs";

function ReadinessHero({ hero, stale }: { hero: AiReadinessHeroModel; stale: PartialFigure | null }) {
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
            <PartialFigureMark partial={stale} testId="amazon-specs-stale">
              {hero.percent}
            </PartialFigureMark>
          </span>
          {hero.ratio ? (
            <span className="findability-lead-ratio" data-ai-readiness-hero-ratio="">
              {hero.ratio}
            </span>
          ) : null}
          <RetailStatusMark tone={hero.tone} />
        </div>
        {hero.pie ? (
          <CitationPieDisc pie={hero.pie} sizeClass={PIE_SIZE} tip={hero.tip ?? undefined} />
        ) : null}
      </div>
    </div>
  );
}

/** Names the required-spec list the completeness figures use (D-05). Marked placeholder. */
function RequiredSpecListLine() {
  const list = requiredAmazonSpecList();
  return (
    <p className="findability-last-checked" data-amazon-specs-required-list={list.name}>
      Required fields:{" "}
      <span
        className="ifai-term"
        data-ifai-tooltip-title="Required-spec list"
        data-ifai-tooltip-desc={list.tooltip}
        tabIndex={0}
        aria-label={`Required-spec list: ${list.tooltip}`}
      >
        {list.name}
      </span>{" "}
      ({formatInt(list.fieldCount)} fields, placeholder).
    </p>
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
  const heroes = amazonSpecsHeroes(bundle.m, metricsTotals ?? rowTotals, checkedAt).map((hero) =>
    // While the listing rows load, the field totals are still coming, not unavailable.
    needsRowTotals && specRows.phase === "loading" ? { ...hero, ratio: null } : hero,
  );
  const stale = useMemo(() => (rows ? amazonSpecsStale(rows) : null), [rows]);

  return (
    <div className="ai-readiness-lead" data-ai-readiness-lead="" data-amazon-specs-lead="">
      <div className="findability-leads" data-ai-readiness-heroes="">
        {heroes.map((hero) => (
          <ReadinessHero key={hero.id} hero={hero} stale={stale} />
        ))}
      </div>
      <AmazonSpecsLastChecked read={specRows} />
      <RequiredSpecListLine />
    </div>
  );
}
