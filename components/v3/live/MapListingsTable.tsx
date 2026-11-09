"use client";

import { Fragment } from "react";
import "@/components/v3/live/catalog-health.css";
import { ChannelPriceCell } from "@/components/v3/live/ChannelPriceCell";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  SET_ASIDE_SORT_COLUMN,
  SET_ASIDE_COLUMN_ID,
  SetAsideCell,
  SetAsideFormRow,
  SetAsideHistory,
  setAsideSortValue,
  useCheckSetAsides,
} from "@/components/v3/live/SetAsideTable";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { formatInt, formatUsd, pendingLabel } from "@/lib/fender-canvas/format";
import { mapListingSortValue } from "@/lib/fender-canvas/listing-table-sort";
import {
  channelPriceLookup,
  listingChannelFacts,
  listingLabel,
  musiciansFriendCheckedPageUrl,
  storedHttpUrl,
  type ChannelPriceRow,
  type MapSourceRow,
  type MapTabModel,
  type PricedChannelCell,
} from "@/lib/fender-canvas/map-channels";
import {
  ANALYST_ESTIMATE_LABEL,
  AWAITING_INPUTS_LABEL,
  MAP_EXPOSURE_LABEL,
  MAP_UNITS_LABEL,
  MAP_UNITS_SOURCE,
  mapExposure,
  mapExposureTip,
  type MapExposure,
  type MapUnitsLookup,
} from "@/lib/fender-canvas/map-exposure";
import { MAP_LISTING_COLUMN_WIDTH } from "@/lib/fender-canvas/retail-column-layout";
import { RETAIL_FINDING_LABELS } from "@/lib/fender-canvas/portfolio-retail";

export const MAP_UNITS_COLUMN_ID = "units";
export const MAP_EXPOSURE_COLUMN_ID = "exposure";

/** A column name with its source or estimate tag, as on the Out of Stock table. */
function tagged(name: string, tag: string, estimate = false) {
  return (
    <span className="sourced-label">
      {name}
      <span className={`source-tag ${estimate ? "source-tag-estimate" : "source-tag-smartscout"}`} data-source={tag}>
        {tag}
      </span>
    </span>
  );
}

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function mapColumns(model: MapTabModel, withExposure: boolean): RetailColumn[] {
  const money = (id: string, name: string, width = 164): RetailColumn => ({
    id,
    name,
    label: name,
    width,
    minWidth: 148,
    className: "money",
    sort: "number",
  });
  const columns: RetailColumn[] = [
    {
      id: "listing",
      name: "Listing",
      label: "Listing",
      width: MAP_LISTING_COLUMN_WIDTH,
      minWidth: withExposure ? 180 : 96,
      className: "listing-col",
      sort: "text",
    },
    { id: "asin", name: "ASIN", label: "ASIN", width: 118, minWidth: 108, className: "asin-col", sort: "text" },
    { id: "map", name: "MAP", label: "MAP", width: 104, minWidth: 88, className: "money", sort: "number" },
  ];
  if (model.showAmazon) columns.push(money("amazon", "Amazon"));
  // R-09: Amazon gap x SmartScout units = discounted retail value, read left to right.
  if (withExposure) {
    columns.push({
      id: MAP_UNITS_COLUMN_ID,
      name: `${MAP_UNITS_LABEL} (${MAP_UNITS_SOURCE})`,
      label: tagged(MAP_UNITS_LABEL, MAP_UNITS_SOURCE),
      width: 150,
      minWidth: 120,
      className: "money",
      sort: "number",
    });
    columns.push({
      id: MAP_EXPOSURE_COLUMN_ID,
      name: `${MAP_EXPOSURE_LABEL} a month (${ANALYST_ESTIMATE_LABEL})`,
      label: tagged(`${MAP_EXPOSURE_LABEL} a month`, ANALYST_ESTIMATE_LABEL, true),
      width: 190,
      minWidth: 150,
      className: "money",
      sort: "number",
    });
  }
  if (model.showWalmart) columns.push(money("walmart", "Walmart"));
  if (model.showMusiciansFriend) columns.push(money("musicians-friend", "Musician's Friend", 176));
  for (const channel of model.extraChannels) columns.push(money(channel.channel, channel.name));
  columns.push(SET_ASIDE_SORT_COLUMN);
  return columns;
}

function ExposureCells({ exposure }: { exposure: MapExposure }) {
  const tip = mapExposureTip(exposure);
  return (
    <>
      <td className="money" data-map-units={exposure.units ?? ""}>
        {exposure.units != null ? formatInt(exposure.units) : null}
      </td>
      <td className="money" data-map-exposure-cell={exposure.status}>
        {exposure.status === "estimated" ? (
          <span {...figureTipAttrs(MAP_EXPOSURE_LABEL, tip, "map-exposure-row")}>{formatUsd(exposure.value)}</span>
        ) : (
          <span {...figureTipAttrs(AWAITING_INPUTS_LABEL, tip, "map-exposure-row")} className="ifai-term fo-note">
            {AWAITING_INPUTS_LABEL}
          </span>
        )}
      </td>
    </>
  );
}

export function MapListingsTable({
  rows,
  model,
  channelPrices,
  pricesNotStored,
  units,
}: {
  rows: MapSourceRow[];
  model: MapTabModel;
  channelPrices: ChannelPriceRow[];
  pricesNotStored: boolean;
  /** SmartScout unit estimates by ASIN. Undefined while loading, null when the read failed. */
  units?: MapUnitsLookup | null;
}) {
  const prices = channelPriceLookup(channelPrices);
  // The two exposure columns appear once the unit read answers. A failed read adds no column.
  const lookup = !pricesNotStored && units ? units : null;
  const columns = mapColumns(model, lookup != null);
  // R-12: approved MAP promotions are recorded here as "Approved exception".
  const setAsides = useCheckSetAsides(SET_ASIDE_CHECKS.mapPricing, RETAIL_FINDING_LABELS.map_leakage);
  const sorted = useClientTableSort(rows, columns, (row, columnId) => {
    if (columnId === SET_ASIDE_COLUMN_ID) return setAsideSortValue(setAsides, row.asin);
    if (lookup && (columnId === MAP_UNITS_COLUMN_ID || columnId === MAP_EXPOSURE_COLUMN_ID)) {
      const exposure = mapExposure(row, lookup);
      if (columnId === MAP_UNITS_COLUMN_ID) return exposure.units;
      return exposure.status === "estimated" ? exposure.value : null;
    }
    return mapListingSortValue(row, columnId, (id) => {
      const facts = listingChannelFacts(row, prices.get(row.asin.trim()));
      return facts.find((fact) => fact.key === id)?.price;
    });
  });

  return (
    <>
    <ResizableTable
      tableId="map-listings"
      columns={columns}
      freezeHeader
      maxHeight={520}
      sort={sorted.sort}
      onSort={sorted.onSort}
      tableClassName="table-no-row-hover"
    >
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>
              {pricesNotStored
                ? "No stored channel prices were returned."
                : "No active offers are under MAP."}
            </td>
          </tr>
        ) : (
          sorted.rows.map((row) => {
            const href = amazonHref(row.asin);
            const facts = new Map(
              listingChannelFacts(row, prices.get(row.asin.trim())).map((fact) => [fact.key, fact]),
            );
            const walmartUrl = storedHttpUrl(row.wmt_url);
            const musiciansFriendUrl = musiciansFriendCheckedPageUrl(prices, row.asin);
            return (
              <Fragment key={row.asin}>
              <tr>
                <td className="listing-col">
                  <span className="listing-title-scroll">
                    <strong>{listingLabel(row)}</strong>
                  </span>
                </td>
                <td className="asin-col">
                  {href ? (
                    <a className="listing-link" href={href} target="_blank" rel="noopener noreferrer">
                      <span className="asin-chip">{row.asin}</span>
                    </a>
                  ) : (
                    <span className="asin-chip">{row.asin}</span>
                  )}
                </td>
                <td className="money">{row.map_price != null ? formatUsd(row.map_price) : pendingLabel()}</td>
                {model.showAmazon ? <ChannelPriceCell fact={facts.get("amazon")} /> : null}
                {lookup ? <ExposureCells exposure={mapExposure(row, lookup)} /> : null}
                {model.showWalmart ? (
                  <ChannelPriceCell fact={facts.get("walmart")} href={walmartUrl} requireCheckedPage />
                ) : null}
                {model.showMusiciansFriend ? (
                  <ChannelPriceCell
                    fact={facts.get("musicians-friend")}
                    href={musiciansFriendUrl}
                    requireCheckedPage
                  />
                ) : null}
                {model.extraChannels.map((channel) => {
                  const cell: PricedChannelCell | undefined = prices.get(row.asin.trim())?.get(channel.channel);
                  return (
                    <ChannelPriceCell
                      key={channel.channel}
                      fact={facts.get(channel.channel)}
                      href={cell ? storedHttpUrl(cell.url) : null}
                      requireCheckedPage
                    />
                  );
                })}
                <SetAsideCell ctl={setAsides} entityKey={row.asin} canSetAside={Boolean(href)} />
              </tr>
              <SetAsideFormRow
                ctl={setAsides}
                entityKey={row.asin}
                entityLabel={listingLabel(row)}
                colSpan={columns.length}
              />
              </Fragment>
            );
          })
        )}
      </tbody>
    </ResizableTable>
    <SetAsideHistory ctl={setAsides} />
    </>
  );
}
