"use client";

import { Fragment, useEffect, useState } from "react";
import { DefinedTerm } from "@/components/v3/live/DefinedTerm";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { NewTag, SourceTag, type DataSource } from "@/components/v3/live/SourceTag";
import { StockLossHero } from "@/components/v3/live/StockLossHero";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import { formatInt, formatUsd } from "@/lib/fender-canvas/format";
import {
  amazonHref,
  baselineInput,
  defaultStockLossOrder,
  EPISODE_STATE_LABELS,
  formatDay,
  keepaHref,
  awaitingInputsReason,
  loadStockLossRows,
  lostSales,
  noActiveOffer,
  num,
  REVENUE_SOURCE_LABELS,
  stockEpisodesQuery,
  type StockEpisode,
  type StockLossRow,
} from "@/lib/fender-canvas/stock-loss";
import type { SortInput } from "@/lib/fender-canvas/table-sort";
import { isFenderClient } from "@/lib/brand-copy";
import { TableExportButton } from "@/components/v3/live/TableExportButton";

function sourced(name: string, ...sources: DataSource[]) {
  return (
    <span className="sourced-label">
      {name}
      {sources.map((source) => (
        <SourceTag key={source} source={source} />
      ))}
    </span>
  );
}

const STOCK_LOSS_COLUMNS: RetailColumn[] = [
  { id: "listing", name: "Listing", label: "Listing", width: 260, minWidth: 160, sort: "text" },
  {
    id: "lost",
    name: "Est. lost sales, 12 months",
    label: sourced("Est. lost sales, 12 months", "Estimate"),
    width: 210,
    minWidth: 150,
    className: "money",
    sort: "number",
  },
  {
    id: "lost90",
    name: "Est. lost sales, 90 days",
    label: sourced("Est. lost sales, 90 days", "Estimate"),
    width: 200,
    minWidth: 140,
    className: "money",
    sort: "number",
  },
  {
    id: "lost30",
    name: "Est. lost sales, 30 days",
    label: sourced("Est. lost sales, 30 days", "Estimate"),
    width: 200,
    minWidth: 140,
    className: "money",
    sort: "number",
  },
  {
    id: "oos365",
    name: "Out-of-stock days, 12 months",
    label: sourced("Out-of-stock days, 12 months", "Keepa"),
    width: 210,
    minWidth: 150,
    sort: "number",
  },
  {
    id: "rate",
    name: "Sales per in-stock day",
    label: sourced("Sales per in-stock day", "SmartScout", "Keepa"),
    width: 250,
    minWidth: 170,
    className: "money",
    sort: "number",
  },
  {
    id: "nobb",
    name: "No Buy Box days, 12 months",
    label: sourced("No Buy Box days, 12 months", "Keepa"),
    width: 210,
    minWidth: 150,
    sort: "number",
  },
];

function sortValue(row: StockLossRow, columnId: string): SortInput {
  if (columnId === "listing") return (row.title ?? row.asin).trim() || null;
  if (columnId === "lost") return lostSales(row, 365);
  if (columnId === "lost90") return lostSales(row, 90);
  if (columnId === "lost30") return lostSales(row, 30);
  if (columnId === "oos365") return num(row.oos_days_365);
  if (columnId === "rate") return row.revenue_source ? num(row.baseline_daily_revenue) : null;
  if (columnId === "nobb") return num(row.no_buy_box_days_365);
  return null;
}

function Explanation() {
  return (
    <div
      className="ceo-callout"
      data-stock-loss-cost-callout=""
      style={{ margin: 0, flex: "1 1 240px", minWidth: 200 }}
    >
      <div className="ceo-callout-header">
        <span>What does an out-of-stock day cost?</span>
      </div>
      <div className="ceo-callout-body">
        A listing is out of stock on a day when no seller has a new one for sale on Amazon, so
        shoppers cannot buy it there. The estimate takes the listing&apos;s sales from{" "}
        <DefinedTerm term="SmartScout" />, divides by the days it was in stock according to{" "}
        <DefinedTerm term="Keepa" />, and multiplies by the days it was not, for the last 30 days,
        90 days, and 12 months. Each figure is also what the next period of the same length would
        miss if the sales rate and the out-of-stock pattern hold. It is an analyst estimate, not
        reported sales.{" "}
        {isFenderClient()
          ? "Fender sells through dealers, so the data shows that a listing ran out but not whether Fender or the dealer did."
          : "The data shows that a listing ran out, not which seller ran out."}{" "}
        A listing with no sales source is awaiting inputs,
        not $0.
      </div>
    </div>
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
  return (
    <table className="stock-episodes">
      <thead>
        <tr>
          <th>What happened</th>
          <th>Started</th>
          <th>Ended</th>
          <th>Days</th>
        </tr>
      </thead>
      <tbody>
        {state.map((episode) => (
          <tr key={`${episode.state}-${episode.start_day}`} data-episode-state={episode.state}>
            <td>{EPISODE_STATE_LABELS[episode.state]}</td>
            <td>{formatDay(episode.start_day)}</td>
            <td>{episode.ongoing ? "Still going" : formatDay(episode.end_day)}</td>
            <td>{formatInt(episode.days)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EstimateInputs({ row }: { row: StockLossRow }) {
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
                No Buy Box days, last 12 months: {formatInt(nobb)} <SourceTag source="Keepa" />. Listed for
                reference. They are not part of this estimate.
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

export function StockLossPanel() {
  const [state, setState] = useState<
    "loading" | "unavailable" | { rows: StockLossRow[]; populationCount: number | null }
  >("loading");
  const [openAsin, setOpenAsin] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStockLossRows()
      .then((next) => {
        if (cancelled) return;
        setState(
          next.available
            ? { rows: defaultStockLossOrder(next.rows), populationCount: next.populationCount }
            : "unavailable",
        );
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = typeof state === "object" ? state.rows : null;
  const sorted = useClientTableSort(rows ?? [], STOCK_LOSS_COLUMNS, sortValue);

  return (
    <div className="stock-loss retail-surface">
      {state === "loading" ? <p className="retail-missing">Loading the stock history…</p> : null}
      {state === "unavailable" ? (
        <p className="retail-missing">The stock history could not be loaded.</p>
      ) : null}
      {rows && typeof state === "object" ? (
        <div
          className="stock-loss-lead"
          data-stock-loss-lead=""
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}
        >
          <StockLossHero rows={rows} populationCount={state.populationCount} />
          <Explanation />
        </div>
      ) : null}
      <div className="content-box" style={{ marginTop: 12 }}>
        <div className="content-box-title">
          <span className="stock-loss-title">
            Out of stock and lost sales
            <NewTag />
          </span>
          {rows ? <span className="tag-badge tag-neutral">{formatInt(rows.length)} listings</span> : null}
          {rows ? <TableExportButton table="stock-loss" /> : null}
        </div>
        {rows && typeof state === "object" ? (
          <>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "8px 0" }}>
              Select a listing to see the inputs behind its estimate and the dates it was out of stock.
            </p>
            <ResizableTable
              tableId="stock-loss"
              columns={STOCK_LOSS_COLUMNS}
              freezeHeader
              maxHeight={560}
              sort={sorted.sort}
              onSort={sorted.onSort}
            >
              <tbody>
                {sorted.rows.length === 0 ? (
                  <tr>
                    <td colSpan={STOCK_LOSS_COLUMNS.length}>
                      No listing was out of stock in the last 12 months.
                    </td>
                  </tr>
                ) : (
                  sorted.rows.map((row) => {
                    const open = openAsin === row.asin;
                    const awaiting = <span className="fo-note">Awaiting inputs</span>;
                    const money = (value: number | null) => (value != null ? formatUsd(value) : awaiting);
                    const toggle = () => setOpenAsin(open ? null : row.asin);
                    return (
                      <Fragment key={row.asin}>
                        <tr
                          className="stock-loss-row"
                          data-asin={row.asin}
                          aria-expanded={open}
                          tabIndex={0}
                          onClick={toggle}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            toggle();
                          }}
                        >
                          <td>
                            <strong>{row.title ?? row.asin}</strong>
                            <br />
                            <span className="asin-chip">{row.asin}</span>
                            {noActiveOffer(row) ? (
                              <span
                                className="tag-badge tag-neutral stock-loss-offer-chip"
                                data-no-active-offer=""
                                title="The retail read found no active offer on this listing."
                              >
                                No active offer
                              </span>
                            ) : null}
                          </td>
                          <td className="money">{money(lostSales(row, 365))}</td>
                          <td className="money">{money(lostSales(row, 90))}</td>
                          <td className="money">{money(lostSales(row, 30))}</td>
                          <td>{formatInt(num(row.oos_days_365) ?? 0)}</td>
                          <td className="money">
                            {row.revenue_source ? formatUsd(num(row.baseline_daily_revenue)) : awaiting}
                          </td>
                          <td>{formatInt(num(row.no_buy_box_days_365) ?? 0)}</td>
                        </tr>
                        {open ? (
                          <tr className="stock-loss-detail">
                            <td colSpan={STOCK_LOSS_COLUMNS.length}>
                              <EstimateInputs row={row} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </ResizableTable>
          </>
        ) : null}
      </div>
    </div>
  );
}
