"use client";

import "@/components/v3/live/catalog-health.css";
import { useEffect, useMemo, useState } from "react";
import { FigureTip } from "@/components/v3/live/FigureTip";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { SourceTag } from "@/components/v3/live/SourceTag";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { stockEpisodesTableId } from "@/lib/export/tables";
import { formatInt, formatUsd } from "@/lib/fender-canvas/format";
import {
  amazonHref,
  awaitingInputsReason,
  baselineInput,
  EPISODE_COLUMNS,
  EPISODE_STATE_LABELS,
  episodeEndLabel,
  episodeKey,
  formatDay,
  keepaHref,
  lostSales,
  num,
  REVENUE_SOURCE_LABELS,
  stockEpisodesQuery,
  type StockEpisode,
  type StockLossRow,
} from "@/lib/fender-canvas/stock-loss";
import type { SortInput } from "@/lib/fender-canvas/table-sort";

const NO_BUY_BOX_REFERENCE_TIP = "No Buy Box days are not part of this estimate.";

/** One dated stretch as the table reads it. No ASIN, so each row keeps its own key in a download. */
type EpisodeRow = Omit<StockEpisode, "asin">;

const COLUMNS: RetailColumn[] = EPISODE_COLUMNS.map((column) => ({
  ...column,
  label: column.name,
  minWidth: 88,
}));

function episodeSortValue(row: EpisodeRow, columnId: string): SortInput {
  if (columnId === "state") return EPISODE_STATE_LABELS[row.state];
  if (columnId === "started") return row.start_day;
  // A stretch still going has no end date: it sorts as missing, after every dated row.
  if (columnId === "ended") return row.ongoing ? null : row.end_day;
  if (columnId === "days") return row.days;
  return null;
}

/** Dated out-of-stock and no-Buy-Box stretches for one listing, on the shared table chrome (X-33). */
function EpisodeTable({ asin, episodes }: { asin: string; episodes: readonly StockEpisode[] }) {
  const rows = useMemo<EpisodeRow[]>(
    () => episodes.map(({ state, start_day, end_day, days, ongoing }) => ({ state, start_day, end_day, days, ongoing })),
    [episodes],
  );
  const sorted = useClientTableSort(rows, COLUMNS, episodeSortValue);
  return (
    <ResizableTable
      tableId={stockEpisodesTableId(asin)}
      columns={COLUMNS}
      freezeHeader
      maxHeight={320}
      sort={sorted.sort}
      onSort={sorted.onSort}
      tableClassName="table-no-row-hover"
    >
      <tbody>
        {sorted.rows.map((episode) => (
          <tr key={episodeKey(episode)} data-episode-state={episode.state}>
            <td>{EPISODE_STATE_LABELS[episode.state]}</td>
            <td>{formatDay(episode.start_day)}</td>
            <td>{episodeEndLabel(episode)}</td>
            <td>{formatInt(episode.days)}</td>
          </tr>
        ))}
      </tbody>
    </ResizableTable>
  );
}

function EpisodeList({ asin }: { asin: string }) {
  const [state, setState] = useState<"loading" | "unavailable" | StockEpisode[]>("loading");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(stockEpisodesQuery(asin))
      .then(({ data, error }) => {
        if (cancelled) return;
        setState(error ? "unavailable" : ((data ?? []) as StockEpisode[]));
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [asin]);

  if (state === "loading") return <p className="retail-missing">Loading the dated stretches…</p>;
  if (state === "unavailable") {
    return <p className="retail-missing">The dated stretches could not be loaded.</p>;
  }
  if (state.length === 0) {
    return <p className="retail-missing">No out-of-stock or no-Buy-Box stretch in the last 12 months.</p>;
  }
  return <EpisodeTable asin={asin} episodes={state} />;
}

/** The row drawer on Out of Stock: the inputs and the math, then the dated stretches. */
export function StockLossDetail({ row }: { row: StockLossRow }) {
  const input = baselineInput(row);
  const rate = num(row.baseline_daily_revenue);
  const windows = [
    { label: "last 30 days", days: num(row.oos_days_30), lost: lostSales(row, 30) },
    { label: "last 90 days", days: num(row.oos_days_90), lost: lostSales(row, 90) },
    { label: "last 12 months", days: num(row.oos_days_365), lost: lostSales(row, 365) },
  ];
  const nobb = num(row.no_buy_box_days_365);
  const keepa = keepaHref(row.asin);
  const amazon = amazonHref(row.asin);

  return (
    <div className="stock-loss-drawer" data-stock-loss-drawer={row.asin}>
      <div className="stock-loss-inputs">
        <h4>How this estimate is built</h4>
        {row.revenue_source ? (
          <ol>
            <li>
              Sales source: <strong>{REVENUE_SOURCE_LABELS[row.revenue_source]}</strong>
            </li>
            <li>
              {input.label}: <strong>{formatUsd(input.value)}</strong> <SourceTag source="SmartScout" />
            </li>
            <li>
              Days in stock in that window: <strong>{formatInt(input.days)}</strong> <SourceTag source="Keepa" />
            </li>
            <li>
              Sales per in-stock day: {formatUsd(input.value)} ÷ {formatInt(input.days)} ={" "}
              <strong>{formatUsd(rate)}</strong>
            </li>
            {windows.map((w) => (
              <li key={w.label}>
                Estimated lost sales, {w.label}: {formatUsd(rate)} × {formatInt(w.days)} out-of-stock days{" "}
                <SourceTag source="Keepa" /> = <strong>{formatUsd(w.lost)}</strong> <SourceTag source="Estimate" />
              </li>
            ))}
            {nobb ? (
              <li>
                No Buy Box days, last 12 months: {formatInt(nobb)} <SourceTag source="Keepa" />.{" "}
                <FigureTip title="No Buy Box days" desc={NO_BUY_BOX_REFERENCE_TIP} testId="no-buy-box-reference">
                  Listed for reference
                </FigureTip>
                .
              </li>
            ) : null}
          </ol>
        ) : (
          <p className="retail-missing">
            Awaiting inputs. {awaitingInputsReason(row)} The out-of-stock days below are still from Keepa.
          </p>
        )}
        <p className="stock-loss-sources">
          Keepa history through {formatDay(row.history_through) ?? "an unknown date"}
          {row.smartscout_snapshot_date
            ? `. SmartScout read ${formatDay(row.smartscout_snapshot_date)}.`
            : "."}{" "}
          {keepa ? (
            <a href={keepa} target="_blank" rel="noopener noreferrer">
              Open the Keepa chart
            </a>
          ) : null}
          {keepa && amazon ? " · " : null}
          {amazon ? (
            <a href={amazon} target="_blank" rel="noopener noreferrer">
              Open the Amazon listing
            </a>
          ) : null}
        </p>
      </div>
      <div className="stock-loss-episodes">
        <h4>
          Dated stretches, last 12 months <SourceTag source="Keepa" />
        </h4>
        <EpisodeList asin={row.asin} />
      </div>
    </div>
  );
}
