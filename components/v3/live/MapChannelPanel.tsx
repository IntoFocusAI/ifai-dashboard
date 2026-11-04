"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CitationPieDisc } from "@/components/v3/live/ai-search/CitationPieDisc";
import { DefinedCopy } from "@/components/v3/live/DefinedTerm";
import { FigureTip } from "@/components/v3/live/FigureTip";
import { MapListingsTable } from "@/components/v3/live/MapListingsTable";
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
  withoutApprovedExceptions,
} from "@/lib/fender-canvas/map-approved-exceptions";
import { MAP_PRICES_NOT_STORED } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { averageGapTip, mapHero } from "@/lib/fender-canvas/retail-overview-lead";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";
import { FMIC_CLIENT_KEY, SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { useSetAsides } from "@/lib/set-aside/set-aside";

const PAGE_SIZE = 1000;
const RETAIL_PIE_SIZE = "citation-pie-disc citation-pie-disc-retail";

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

function RetailSurface({ children }: { children: ReactNode }) {
  return <div className="retail-surface">{children}</div>;
}

function mapPricesNotStored(read: RetailCanvasRead): boolean {
  return read.phase === "ready" && read.snapshot.mapLeakage.missingMessage === MAP_PRICES_NOT_STORED;
}

/**
 * MAP share plus the average price gap under the pie.
 * The gap is copy inside this box, not a second card. Width fits the figure.
 * Static block; Retail Overview remains the click path into this tab.
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
      <div data-map-lead-label="">{hero.label}</div>
      <div className="findability-lead-row" data-map-lead-row="">
        <div className="findability-lead-figures">
          <span
            className="ai-lead-figure"
            style={{ color: hero.color }}
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
        </div>
        {hero.pie ? (
          <CitationPieDisc pie={hero.pie} sizeClass={RETAIL_PIE_SIZE} tip={hero.tip ?? undefined} />
        ) : null}
      </div>
      <div data-map-lead-gap="">
        <span className="metric-card-label">Average price gap</span>
        <div className="metric-card-val" style={{ color: "var(--danger-red)" }} data-map-lead-gap-value="">
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
        <DefinedCopy text={MAP_PRICES_NOT_STORED} />
      </p>
    );
  }

  if (!channels.length) return null;

  return (
    <ul className="tour-card-list" style={{ margin: 0 }} data-map-notes-channels="">
      {channels.map((channel) => (
        <li key={channel.key}>
          <strong>{channel.name}</strong>
          {" · "}
          <DefinedCopy
            text={channelSummaryText(
              channel.count,
              channelReadingNote(channel.name, {
                walmartMissing,
                musiciansFriendLastRunAt,
              }),
            )}
          />
        </li>
      ))}
    </ul>
  );
}

function MapTopRow({
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
      <div
        className="content-box"
        data-map-notes=""
        style={{ flex: "1 1 220px", alignSelf: "stretch", minWidth: 180, marginTop: 0 }}
      >
        <MapNotes
          read={read}
          channels={channels}
          walmartMissing={walmartMissing}
          musiciansFriendLastRunAt={musiciansFriendLastRunAt}
        />
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

  const pricesNotStored = mapPricesNotStored(read);
  const musiciansFriendLastRunAt = musiciansFriendFreshness?.last_run_at;
  const mapSetAsides = useSetAsides(FMIC_CLIENT_KEY, SET_ASIDE_CHECKS.mapPricing);
  const exceptions = useMemo(() => approvedExceptionAsins(mapSetAsides.rows), [mapSetAsides.rows]);

  useEffect(() => {
    if (read.phase === "loading") return;
    let cancelled = false;
    Promise.all([loadMapRows(!pricesNotStored), loadChannelPrices(), loadListingsWithoutWalmartPrice()])
      .then(([nextRows, nextPrices, missing]) => {
        if (!cancelled) {
          setRows(nextRows);
          setChannelPrices(nextPrices);
          setWalmartMissing(missing);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pricesNotStored, read.phase]);

  if (failed) {
    return (
      <RetailSurface>
        <MapTopRow
          read={read}
          channels={[]}
          walmartMissing={walmartMissing}
          musiciansFriendLastRunAt={musiciansFriendLastRunAt}
        />
        <div className="content-box" style={{ marginTop: 12 }} data-map-listings="">
          <p className="retail-missing">Below-MAP rows are not available.</p>
        </div>
      </RetailSurface>
    );
  }

  if (!rows) {
    return (
      <RetailSurface>
        <MapTopRow
          read={read}
          channels={[]}
          walmartMissing={walmartMissing}
          musiciansFriendLastRunAt={musiciansFriendLastRunAt}
        />
        <div className="content-box" style={{ marginTop: 12 }} data-map-listings="">
          <p className="retail-missing">Loading MAP rows…</p>
        </div>
      </RetailSurface>
    );
  }

  const model = mapTabModel(rows, channelPrices);
  // The table keeps approved exceptions (with their chip); the channel counts leave them out.
  const counted = mapTabModel(withoutApprovedExceptions(rows, exceptions), channelPrices);
  const summaryChannels: MapChannelLine[] = pricesNotStored
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
      />
      <div className="content-box" style={{ marginTop: 12 }} data-map-listings="">
        <MapListingsTable
          rows={rows}
          model={model}
          channelPrices={channelPrices}
          pricesNotStored={pricesNotStored}
        />
      </div>
    </RetailSurface>
  );
}
