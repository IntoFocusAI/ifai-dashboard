"use client";

import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import {
  findabilityLeadBuckets,
  outcomeLeadPie,
  outcomeLeadTip,
  outcomeRatioFigure,
  outcomeShareFigure,
  outcomeShareTone,
} from "@/lib/findability/lead";
import {
  findabilityLastCheckedSentence,
  findabilityStale,
  LAST_CHECKED_UNAVAILABLE_DESC,
  LAST_CHECKED_UNAVAILABLE_LABEL,
  LAST_CHECKED_UNAVAILABLE_TITLE,
  newestCheckedAttemptAt,
} from "@/lib/findability/last-checked";
import { toneColor } from "@/lib/fender-canvas/ai-readiness-lead";
import { OUTCOME_DEFINITION, OUTCOME_LABEL, bucketLabel } from "@/lib/findability/copy";
import type {
  FindabilityBucket,
  FindabilityRow,
  OutcomeCounts,
} from "@/lib/findability/outcomes";

const FINDABILITY_PIE_SIZE = "citation-pie-disc citation-pie-disc-findability";

/** One freshness line for the whole official-page read (X-12). Visible with the heroes. */
function LastCheckedLine({ rows }: { rows: readonly FindabilityRow[] }) {
  const iso = newestCheckedAttemptAt(rows);
  const sentence = findabilityLastCheckedSentence(iso);
  return (
    <p
      className="findability-last-checked"
      data-findability-last-checked={iso ?? ""}
    >
      {sentence ? (
        sentence
      ) : (
        <>
          Last checked{" "}
          <span
            className="ifai-term"
            data-ifai-tooltip-title={LAST_CHECKED_UNAVAILABLE_TITLE}
            data-ifai-tooltip-desc={LAST_CHECKED_UNAVAILABLE_DESC}
            tabIndex={0}
            aria-label={`${LAST_CHECKED_UNAVAILABLE_TITLE}: ${LAST_CHECKED_UNAVAILABLE_DESC}`}
          >
            {LAST_CHECKED_UNAVAILABLE_LABEL}
          </span>
        </>
      )}
    </p>
  );
}

function outcomeLabel(bucket: FindabilityBucket): string {
  return bucket === "other" ? bucketLabel("other") : OUTCOME_LABEL[bucket];
}

function outcomeDefinition(bucket: FindabilityBucket): string | null {
  return bucket === "other" ? null : OUTCOME_DEFINITION[bucket];
}

/**
 * One Findability outcome hero: label, share percentage, N of M, and a disc of
 * that outcome versus the rest of this read.
 */
function OutcomeHero({
  counts,
  bucket,
  stale,
}: {
  counts: OutcomeCounts;
  bucket: FindabilityBucket;
  stale: PartialFigure | null;
}) {
  const label = outcomeLabel(bucket);
  const definition = outcomeDefinition(bucket);
  const pct = outcomeShareFigure(counts, bucket);
  const ratio = outcomeRatioFigure(counts, bucket);
  const pie = outcomeLeadPie(counts, bucket);
  const tone = outcomeShareTone(counts, bucket);

  return (
    <div
      className="content-box findability-lead-card"
      data-findability-lead-outcome={bucket}
    >
      <div>
        {definition ? (
          <span
            className="ifai-term"
            data-ifai-tooltip-title={label}
            data-ifai-tooltip-desc={definition}
            tabIndex={0}
            aria-label={`${label}: ${definition}`}
          >
            {label}
          </span>
        ) : (
          <span>{label}</span>
        )}
      </div>
      <div
        data-findability-lead-row=""
        className="findability-lead-row"
      >
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            style={tone ? { color: toneColor(tone) ?? undefined } : undefined}
            data-findability-lead-figure=""
            data-findability-lead-pct=""
            data-findability-lead-count={counts[bucket]}
            data-findability-lead-total={counts.total}
            {...(bucket === "exact_official_product"
              ? { "data-findability-exact": counts.exact_official_product }
              : {})}
          >
            <PartialFigureMark partial={stale} testId="findability-stale">
              {pct}
            </PartialFigureMark>
          </span>
          <span className="findability-lead-ratio" data-findability-lead-ratio="">
            {ratio}
          </span>
          <RetailStatusMark tone={tone} />
        </div>
        {pie ? (
          <CitationPieDisc
            pie={pie}
            sizeClass={FINDABILITY_PIE_SIZE}
            tip={outcomeLeadTip(counts, bucket)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Findability tab heroes: one bubble per outcome (and Other when present).
 * Each shows share of this read, N of M, and a disc. Freshness sits under the
 * hero row so five heroes stay in one band. Prose and count cards stay below.
 */
export function FindabilityLead({
  counts,
  rows,
}: {
  counts: OutcomeCounts;
  rows: readonly FindabilityRow[];
}) {
  if (counts.total <= 0) {
    return (
      <div data-findability-lead="">
        <div className="content-box">
          <span
            className="ai-lead-figure"
            data-findability-lead-figure=""
            data-findability-empty=""
          >
            This official-page read has no listings.
          </span>
        </div>
        <LastCheckedLine rows={rows} />
      </div>
    );
  }

  const buckets = findabilityLeadBuckets(counts);
  const stale = findabilityStale(rows);

  return (
    <div data-findability-lead="">
      <div className="findability-leads">
        {buckets.map((bucket) => (
          <OutcomeHero key={bucket} counts={counts} bucket={bucket} stale={stale} />
        ))}
      </div>
      <LastCheckedLine rows={rows} />
    </div>
  );
}
