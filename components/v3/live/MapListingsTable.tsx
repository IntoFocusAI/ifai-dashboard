"use client";

import { Fragment } from "react";
import { ChannelPriceCell } from "@/components/v3/live/ChannelPriceCell";
import { ResizableTable, type RetailColumn } from "@/components/v3/live/ResizableTable";
import { useClientTableSort } from "@/components/v3/live/useClientTableSort";
import {
  SET_ASIDE_COLUMN,
  SetAsideCell,
  SetAsideFormRow,
  SetAsideHistory,
  useCheckSetAsides,
} from "@/components/v3/live/SetAsideTable";
import { SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { formatUsd, pendingLabel } from "@/lib/fender-canvas/format";
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
import { MAP_LISTING_COLUMN_WIDTH } from "@/lib/fender-canvas/retail-column-layout";

function amazonHref(asin: string): string | null {
  return /^[A-Z0-9]{10}$/.test(asin) ? `https://www.amazon.com/dp/${asin}` : null;
}

function mapColumns(model: MapTabModel): RetailColumn[] {
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
      minWidth: 96,
      className: "listing-col",
      sort: "text",
    },
    { id: "asin", name: "ASIN", label: "ASIN", width: 118, minWidth: 108, className: "asin-col", sort: "text" },
    { id: "map", name: "MAP", label: "MAP", width: 104, minWidth: 88, className: "money", sort: "number" },
  ];
  if (model.showAmazon) columns.push(money("amazon", "Amazon"));
  if (model.showWalmart) columns.push(money("walmart", "Walmart"));
  if (model.showMusiciansFriend) columns.push(money("musicians-friend", "Musician's Friend", 176));
  for (const channel of model.extraChannels) columns.push(money(channel.channel, channel.name));
  columns.push(SET_ASIDE_COLUMN);
  return columns;
}

export function MapListingsTable({
  rows,
  model,
  channelPrices,
  pricesNotStored,
}: {
  rows: MapSourceRow[];
  model: MapTabModel;
  channelPrices: ChannelPriceRow[];
  pricesNotStored: boolean;
}) {
  const prices = channelPriceLookup(channelPrices);
  const columns = mapColumns(model);
  // R-12: approved MAP promotions are recorded here as "Approved exception".
  const setAsides = useCheckSetAsides(SET_ASIDE_CHECKS.mapPricing, "MAP");
  const sorted = useClientTableSort(rows, columns, (row, columnId) =>
    mapListingSortValue(row, columnId, (id) => {
      const facts = listingChannelFacts(row, prices.get(row.asin.trim()));
      return facts.find((fact) => fact.key === id)?.price;
    }),
  );

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
