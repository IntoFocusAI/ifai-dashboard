"use client";

import { Fragment, useEffect, useState } from "react";
import { DefinedTerm } from "@/components/v3/live/DefinedTerm";
import { RetailShareDisc, RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import { ResizableTable } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  SET_ASIDE_COLUMN_ID,
  SET_ASIDE_SORT_COLUMN,
  SetAsideCell,
  SetAsideFormRow,
  SetAsideHistory,
  setAsideSortValue,
  useCheckSetAsides,
} from "@/components/v3/live/SetAsideTable";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import {
  SUPPRESSED_LISTINGS_TABLE_COLUMNS,
  FeaturedOfferTableRow,
} from "@/components/v3/live/FeaturedOfferRow";
import {
  featuredOfferColumnProbe,
  featuredOfferReadingCountQuery,
  suppressedListingsQuery,
} from "@/lib/canvasData";
import {
  aboveBenchmarkDollars,
  benchmarkDollars,
  listingLabel,
  observedOfferDollars,
  withheldListings,
  type FeaturedOfferRow,
} from "@/lib/fender-canvas/featured-offer";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import {
  benchmarkCoverageSentence,
  confirmedSuppressionSentence,
  featuredOfferFreshnessSentence,
  featuredOfferJob,
} from "@/lib/fender-canvas/featured-offer-copy";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { buyBoxHero, heroFigureColor, heroFigureTone } from "@/lib/fender-canvas/retail-overview-lead";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";

const PAGE_SIZE = 1000;

const TABLE_COLUMNS = [...SUPPRESSED_LISTINGS_TABLE_COLUMNS, SET_ASIDE_SORT_COLUMN];

const TOP_ROW_STYLE = {
  display: "flex",
  flexWrap: "wrap" as const,
  alignItems: "flex-start" as const,
  gap: 12,
};

/** Keep the share card tight around the figure; do not stretch to the panel edge. */
const HERO_CARD_STYLE = {
  flex: "0 0 auto",
  width: "fit-content",
  maxWidth: "100%",
  alignSelf: "flex-start" as const,
};

/** Notes column fills the rest of the row; one ceo-callout, not a nested content-box. */
const NOTES_BOX_STYLE = {
  flex: "1 1 280px",
  minWidth: 0,
  margin: 0,
};

const TABLE_BLOCK_STYLE = {
  marginTop: 12,
};

const OBSERVED_OFFER_NOTE =
  "The observed offer and the Competitive External Price come from the same Amazon listing read, so the gap compares one moment. A blank gap means this reading has no comparable pair yet, not a gap of zero.";

function suppressedSortValue(row: FeaturedOfferRow, columnId: string): SortInput {
  if (columnId === "listing") return listingLabel(row).trim() || null;
  if (columnId === "offer") return observedOfferDollars(row);
  if (columnId === "benchmark") return benchmarkDollars(row);
  if (columnId === "gap") return aboveBenchmarkDollars(row);
  return row.featured_offer_checked_at ?? null;
}

async function loadWithheldListings(): Promise<
  { available: false } | { available: true; rows: FeaturedOfferRow[] }
> {
  const probe = await featuredOfferColumnProbe();
  if (probe.error || !probe.present) return { available: false };

  const reading = await featuredOfferReadingCountQuery();
  if (reading.error || !reading.count) return { available: false };

  const rows: FeaturedOfferRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error, count } = await suppressedListingsQuery(page, PAGE_SIZE);
    if (error) return { available: false };
    rows.push(...((data ?? []) as FeaturedOfferRow[]));
    const loaded = rows.length;
    const total = count ?? loaded;
    if (loaded >= total || (data ?? []).length < PAGE_SIZE) {
      return { available: true, rows: withheldListings(rows) };
    }
  }
  return { available: false };
}

/** Reading passages for the notes callout body (one paragraph, space-separated). */
function readingNotesText(
  read: RetailCanvasRead,
  freshness?: CanvasFreshnessRow[] | null,
): string {
  if (read.phase === "loading") return "Loading the Buy Box reading…";
  if (read.phase === "error") return "The retail read could not be loaded.";
  const counts = read.snapshot.suppressedListings.detail?.counts;
  if (!counts) {
    return (
      read.snapshot.suppressedListings.missingMessage ??
      "The Buy Box reading has not been stored."
    );
  }
  return [
    confirmedSuppressionSentence(counts),
    benchmarkCoverageSentence(counts),
    featuredOfferFreshnessSentence(counts, featuredOfferJob(freshness)),
  ].join(" ");
}

/**
 * Same Buy Box withheld share as Retail Overview: percentage, N of M, and disc.
 * Static in-tab lead (not a navigation control). Card width follows the figure.
 */
function SuppressedListingsLead({ read }: { read: RetailCanvasRead }) {
  if (read.phase === "loading") {
    return (
      <div
        className="content-box"
        data-suppressed-listings-lead=""
        style={HERO_CARD_STYLE}
      >
        <span className="ai-lead-figure">Loading the Buy Box reading…</span>
      </div>
    );
  }
  if (read.phase === "error") {
    return (
      <div
        className="content-box"
        data-suppressed-listings-lead=""
        style={HERO_CARD_STYLE}
      >
        <span className="ai-lead-figure">The retail read could not be loaded.</span>
      </div>
    );
  }

  const hero = buyBoxHero(read.snapshot);

  return (
    <div
      className="content-box findability-lead-card"
      data-suppressed-listings-lead=""
      style={HERO_CARD_STYLE}
    >
      <div>
        <span data-suppressed-listings-lead-label="">{hero.label}</span>
      </div>
      <div className="findability-lead-row" data-suppressed-listings-lead-row="">
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            style={{ color: heroFigureColor(hero) }}
            data-suppressed-listings-lead-percent=""
            data-suppressed-listings-lead-tone={hero.tone}
            data-suppressed-listings-lead-numerator={hero.numerator ?? ""}
            data-suppressed-listings-lead-denominator={hero.denominator ?? ""}
          >
            {hero.percent}
          </span>
          {hero.ratio ? (
            <span
              className="findability-lead-ratio"
              data-suppressed-listings-lead-ratio=""
            >
              {hero.ratio}
            </span>
          ) : null}
          <RetailStatusMark tone={heroFigureTone(hero)} />
        </div>
        {hero.pie ? <RetailShareDisc pie={hero.pie} measuredKey="contradicted" tip={hero.tip} /> : null}
      </div>
      <span className="metric-card-sub" data-suppressed-listings-lead-explainer="">
        {hero.explainer}
      </span>
    </div>
  );
}

/**
 * One Hide-able callout beside the share: why explanation plus reading sentences
 * in a single paragraph inside `.ceo-callout-body`.
 */
function SuppressedListingsNotes({
  read,
  freshness,
}: {
  read: RetailCanvasRead;
  freshness?: CanvasFreshnessRow[] | null;
}) {
  const reading = readingNotesText(read, freshness);

  return (
    <div
      className="ceo-callout"
      data-suppressed-listings-notes=""
      style={NOTES_BOX_STYLE}
    >
      <div className="ceo-callout-header">
        <span>Why can a listing lose the Buy Box?</span>
      </div>
      <div className="ceo-callout-body">
        Amazon withholds the <DefinedTerm term="Buy Box" /> when the offer it observed,
        including shipping, is above the Competitive External Price: the lowest price it
        recently found outside Amazon. Amazon does not name that retailer, and a listing can
        be withheld for other reasons too, so a withheld listing with no published benchmark
        is not a confirmed price problem. {reading} {OBSERVED_OFFER_NOTE}
      </div>
    </div>
  );
}

export function SuppressedListingsPanel({
  read,
  freshness = null,
}: {
  read: RetailCanvasRead;
  freshness?: CanvasFreshnessRow[] | null;
}) {
  const [state, setState] = useState<"loading" | "unavailable" | { rows: FeaturedOfferRow[] }>(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    loadWithheldListings()
      .then((next) => {
        if (cancelled) return;
        setState(next.available ? { rows: next.rows } : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = typeof state === "object" ? state.rows : null;
  const setAsides = useCheckSetAsides(SET_ASIDE_CHECKS.buyboxSuppression, "Suppressed Listings");
  const sorted = useClientTableSort(rows ?? [], TABLE_COLUMNS, (row, columnId) =>
    columnId === SET_ASIDE_COLUMN_ID
      ? setAsideSortValue(setAsides, typeof row.asin === "string" ? row.asin : "")
      : suppressedSortValue(row, columnId),
  );

  return (
    <div className="suppressed-listings retail-surface">
      <div data-suppressed-listings-top="" style={TOP_ROW_STYLE}>
        <SuppressedListingsLead read={read} />
        <SuppressedListingsNotes read={read} freshness={freshness} />
      </div>
      <div data-suppressed-listings-table="" style={TABLE_BLOCK_STYLE}>
        {state === "loading" ? (
          <p className="retail-missing">Loading withheld listings…</p>
        ) : null}
        {state === "unavailable" ? (
          <p className="retail-missing">The withheld listings could not be loaded.</p>
        ) : null}
        {rows ? (
          <ResizableTable
            tableId="suppressed-listings"
            columns={TABLE_COLUMNS}
            freezeHeader
            maxHeight={520}
            sort={sorted.sort}
            onSort={sorted.onSort}
          >
            <tbody>
              {sorted.rows.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length}>
                    No monitored listing has a withheld Buy Box in the current reading.
                  </td>
                </tr>
              ) : (
                sorted.rows.map((row) => {
                  const asin = typeof row.asin === "string" ? row.asin : "";
                  const valid = /^[A-Z0-9]{10}$/.test(asin);
                  return (
                    <Fragment key={asin}>
                      <FeaturedOfferTableRow
                        row={row}
                        trailing={<SetAsideCell ctl={setAsides} entityKey={asin} canSetAside={valid} />}
                      />
                      <SetAsideFormRow
                        ctl={setAsides}
                        entityKey={asin}
                        entityLabel={listingLabel(row) || null}
                        colSpan={TABLE_COLUMNS.length}
                      />
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </ResizableTable>
        ) : null}
        <SetAsideHistory ctl={setAsides} />
      </div>
    </div>
  );
}
