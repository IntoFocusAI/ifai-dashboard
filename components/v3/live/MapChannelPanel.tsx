"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { FigureTip } from "@/components/v3/live/FigureTip";
import { MapExposureCard, type MapExposureState } from "@/components/v3/live/MapExposureCard";
import { MapListingsTable } from "@/components/v3/live/MapListingsTable";
import { RetailShareDisc, RetailStatusMark } from "@/components/v3/live/RetailOverviewFigure";
import {
  listingChannelPricesQuery,
  listingsQuery,
  retailListingHeadCountQuery,
} from "@/lib/canvasData";
import { formatUsd } from "@/lib/fender-canvas/format";
import {
  mapTabModel,
  type ChannelPriceRow,
  type MapSourceRow,
} from "@/lib/fender-canvas/map-channels";
import {
  channelReadingNote,
  channelSummaryText,
} from "@/lib/fender-canvas/map-reading-status";
import {
  approvedExceptionAsins,
  approvedExceptionsSentence,
  withoutApprovedExceptions,
} from "@/lib/fender-canvas/map-approved-exceptions";
import {
  loadMapUnits,
  mapExposureOrder,
  mapExposureSummary,
  mapUnitsLookup,
  type MapUnitsLookup,
} from "@/lib/fender-canvas/map-exposure";
import { MAP_PRICES_NOT_STORED } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { averageGapTip, heroFigureColor, heroFigureTone, mapHero } from "@/lib/fender-canvas/retail-overview-lead";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";
import { SET_ASIDE_CHECKS, activeSetAsideClientKey } from "@/lib/set-aside/keys";
import { useSetAsides } from "@/lib/set-aside/set-aside";

const PAGE_SIZE = 1000;

type MapChannelLine = { key: string; name: string; count: number };

async function loadMapRows(violationsOnly: boolean): Promise<MapSourceRow[]> {
  const rows: MapSourceRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await listingsQuery(
      page,
      PAGE_SIZE,
      violationsOnly ? { violationsOnly: true } : undefined,
    );
    if (error) throw error;
    const batch = (data ?? []) as MapSourceRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error("Below-MAP rows are not available.");
}

/** Listings in the retail read with no Walmart price above zero. Null when the count cannot be read. */
async function loadListingsWithoutWalmartPrice(): Promise<number | null> {
  try {
    const [all, priced] = await Promise.all([
      retailListingHeadCountQuery(),
      retailListingHeadCountQuery({ storedWalmartPrice: true }),
    ]);
    if (all.error || priced.error || all.count == null || priced.count == null) return null;
    return all.count - priced.count;
  } catch {
    return null;
  }
}

async function loadChannelPrices(): Promise<ChannelPriceRow[]> {
  try {
    const rows: ChannelPriceRow[] = [];
    for (let page = 0; page < 20; page += 1) {
      const { data, error } = await listingChannelPricesQuery(page, PAGE_SIZE);
      if (error) return page === 0 ? [] : rows;
      const batch = (data ?? []) as ChannelPriceRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) return rows;
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * `retail-health` keeps the panel's automatic glossary marking out of this React-rendered
 * tab (as on Retail Overview), so MAP is defined once, on the lead label.
 */
function RetailSurface({ children }: { children: ReactNode }) {
  return <div className="retail-health retail-surface">{children}</div>;
}

function mapPricesNotStored(read: RetailCanvasRead): boolean {
  return read.phase === "ready" && read.snapshot.mapLeakage.missingMessage === MAP_PRICES_NOT_STORED;
}

/**
 * MAP share plus the average price gap under the pie.
 * The gap is copy inside this box, not a second card. Width fits the figure.
 * Static block; Retail Overview remains the click path into this tab.
 * The one MAP explainer path (R-08): the label defines MAP, and the N of M tooltip says
 * which listings were counted. Nothing else on the tab repeats either.
 */
function MapLeakageLead({ read }: { read: RetailCanvasRead }) {
  if (read.phase !== "ready") return null;
  const hero = mapHero(read.snapshot);
  const detail = read.snapshot.mapLeakage.detail;
  const gap = detail?.averageLeakage ?? null;
  const gapMark = (detail?.approvedExceptions ?? 0) > 0 ? "*" : "";
  return (
    <div
      className="content-box findability-lead-card"
      data-map-lead=""
      style={{
        flex: "0 0 auto",
        alignSelf: "flex-start",
        width: "fit-content",
        maxWidth: "100%",
        marginTop: 0,
      }}
    >
      <div data-map-lead-label="">
        <DefinedCopy text={hero.label} />
      </div>
      <div className="findability-lead-row" data-map-lead-row="">
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            style={{ color: heroFigureColor(hero) }}
            data-map-lead-percent=""
            data-map-lead-tone={hero.tone}
            data-map-lead-numerator={hero.numerator ?? ""}
            data-map-lead-denominator={hero.denominator ?? ""}
          >
            {hero.percent}
          </span>
          {hero.ratio ? (
            <span className="findability-lead-ratio" data-map-lead-ratio="">
              <FigureTip title={hero.label} desc={hero.tip} testId="map-ratio">
                {hero.ratio}
              </FigureTip>
            </span>
          ) : null}
          <RetailStatusMark tone={heroFigureTone(hero)} />
        </div>
        {hero.pie ? <RetailShareDisc pie={hero.pie} measuredKey="contradicted" tip={hero.tip} /> : null}
      </div>
      <div data-map-lead-gap="">
        <span className="metric-card-label">Average price gap</span>
        <div className="metric-card-val" data-map-lead-gap-value="">
          {gap == null ? (
            "Not stored"
          ) : (
            <FigureTip title="Average price gap" desc={averageGapTip(read.snapshot)} testId="map-gap">
              {formatUsd(gap, { signed: true })}
              {gapMark}
            </FigureTip>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Right bubble: channel lines, or the not-stored sentence. The price gap stays in the hero.
 */
function MapNotes({
  read,
  channels,
  walmartMissing,
  musiciansFriendLastRunAt,
}: {
  read: RetailCanvasRead;
  channels: MapChannelLine[];
  walmartMissing: number | null;
  musiciansFriendLastRunAt?: string | null;
}) {
  if (read.phase === "loading") {
    return <p className="retail-missing">Loading the retail reading…</p>;
  }
  if (read.phase === "error") {
    return <p className="retail-missing">The retail read could not be loaded.</p>;
  }
  if (mapPricesNotStored(read)) {
    return (
      <p className="retail-missing" data-map-notes-not-stored="">
        {MAP_PRICES_NOT_STORED}
      </p>
    );
  }

  if (!channels.length) return null;

  return (
    <ul className="tour-card-list" style={{ margin: 0 }} data-map-notes-channels="">
      {channels.map((channel) => {
        const note = channelReadingNote(channel.name, { walmartMissing, musiciansFriendLastRunAt });
        return (
          <li key={channel.key} data-map-channel={channel.name}>
            <strong>{channel.name}</strong>
            {" · "}
            <FigureTip title={channel.name} desc={note} testId="map-channel">
              {channelSummaryText(channel.count, note)}
            </FigureTip>
          </li>
        );
      })}
    </ul>
  );
}

function MapTopRow({
  read,
  channels,
  walmartMissing,
  musiciansFriendLastRunAt,
  exposure,
  exceptionsSentence,
}: {
  read: RetailCanvasRead;
  channels: MapChannelLine[];
  walmartMissing: number | null;
  musiciansFriendLastRunAt?: string | null;
  /** Null hides the exposure card: MAP prices are not stored, or the rows did not load. */
  exposure: MapExposureState | null;
  exceptionsSentence: string | null;
}) {
  return (
    <div
      data-map-top=""
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "stretch",
        marginTop: 12,
      }}
    >
      <MapLeakageLead read={read} />
      <div className="map-top-side" data-map-top-side="">
        {exposure ? <MapExposureCard state={exposure} exceptionsSentence={exceptionsSentence} /> : null}
        <div className="content-box" data-map-notes="">
          <MapNotes
            read={read}
            channels={channels}
            walmartMissing={walmartMissing}
            musiciansFriendLastRunAt={musiciansFriendLastRunAt}
          />
        </div>
      </div>
    </div>
  );
}

export function MapChannelPanel({
  read,
  musiciansFriendFreshness = null,
}: {
  read: RetailCanvasRead;
  musiciansFriendFreshness?: CanvasFreshnessRow | null;
}) {
  const [rows, setRows] = useState<MapSourceRow[] | null>(null);
  const [channelPrices, setChannelPrices] = useState<ChannelPriceRow[]>([]);
  const [walmartMissing, setWalmartMissing] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  /** Undefined while loading, null when the unit read failed. */
  const [units, setUnits] = useState<MapUnitsLookup | null | undefined>(undefined);

  const pricesNotStored = mapPricesNotStored(read);
  const musiciansFriendLastRunAt = musiciansFriendFreshness?.last_run_at;
  const mapSetAsides = useSetAsides(activeSetAsideClientKey(), SET_ASIDE_CHECKS.mapPricing);
  const exceptions = useMemo(() => approvedExceptionAsins(mapSetAsides.rows), [mapSetAsides.rows]);

  useEffect(() => {
    if (read.phase === "loading") return;
    let cancelled = false;
    Promise.all([loadMapRows(!pricesNotStored), loadChannelPrices(), loadListingsWithoutWalmartPrice()])
      .then(([nextRows, nextPrices, missing]) => {
        if (cancelled) return;
        setRows(nextRows);
        setChannelPrices(nextPrices);
        setWalmartMissing(missing);
        if (pricesNotStored) return;
        // R-09: the unit estimates behind discounted retail value, for the listings below MAP only.
        void loadMapUnits(nextRows.map((row) => row.asin)).then((unitRows) => {
          if (!cancelled) setUnits(unitRows ? mapUnitsLookup(unitRows) : null);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pricesNotStored, read.phase]);

  // The table keeps approved exceptions (with their chip); every figure leaves them out (R-12).
  const countedRows = useMemo(
    () => (rows ? withoutApprovedExceptions(rows, exceptions) : []),
    [rows, exceptions],
  );
  const exposure: MapExposureState | null =
    !rows || pricesNotStored
      ? null
      : units === undefined
        ? { phase: "loading" }
        : units === null
          ? { phase: "failed" }
          : { phase: "ready", summary: mapExposureSummary(countedRows, units) };
  const excluded = rows ? rows.length - countedRows.length : 0;
  const exceptionsSentence =
    excluded > 0 || mapSetAsides.error ? approvedExceptionsSentence(excluded, Boolean(mapSetAsides.error)) : null;

  // The table waits for the unit read, so its rows do not reorder once the estimates arrive.
  const unitsSettled = pricesNotStored || units !== undefined;
  const tableRows = useMemo(() => (rows && units ? mapExposureOrder(rows, units) : rows), [rows, units]);
  const model = rows ? mapTabModel(rows, channelPrices) : null;
  const counted = rows ? mapTabModel(countedRows, channelPrices) : null;
  const summaryChannels: MapChannelLine[] =
    !counted || pricesNotStored
      ? []
      : [
          ...counted.channels.map((channel) => ({
            key: channel.name,
            name: channel.name,
            count: channel.count,
          })),
          ...counted.extraChannels
            .filter((channel) => channel.count > 0)
            .map((channel) => ({
              key: channel.channel,
              name: channel.name,
              count: channel.count,
            })),
        ];

  return (
    <RetailSurface>
      <MapTopRow
        read={read}
        channels={summaryChannels}
        walmartMissing={walmartMissing}
        musiciansFriendLastRunAt={musiciansFriendLastRunAt}
        exposure={failed ? null : exposure}
        exceptionsSentence={exceptionsSentence}
      />
      <div className="content-box" style={{ marginTop: 12 }} data-map-listings="">
        {failed ? <p className="retail-missing">Below-MAP rows are not available.</p> : null}
        {!failed && (!rows || !unitsSettled) ? <p className="retail-missing">Loading MAP rows…</p> : null}
        {!failed && tableRows && model && unitsSettled ? (
          <MapListingsTable
            rows={tableRows}
            model={model}
            channelPrices={channelPrices}
            pricesNotStored={pricesNotStored}
            units={units}
          />
        ) : null}
      </div>
    </RetailSurface>
  );
}
