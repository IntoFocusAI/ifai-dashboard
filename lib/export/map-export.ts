import { listingChannelPricesQuery, listingsQuery } from "@/lib/canvasData";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import { exportFailed, exportFile } from "@/lib/export/file";
import type { BuiltExport } from "@/lib/export/types";
import { formatUsd, pendingLabel } from "@/lib/fender-canvas/format";
import {
  channelPriceLookup,
  listingChannelFacts,
  listingLabel,
  missingCheckedPageLabel,
  musiciansFriendCheckedPageUrl,
  storedHttpUrl,
  type ChannelPriceRow,
  type MapSourceRow,
  mapTabModel,
} from "@/lib/fender-canvas/map-channels";
import {
  approvedExceptionAsins,
  withMapApprovedExceptions,
  type MapSetAsideFields,
} from "@/lib/fender-canvas/map-approved-exceptions";
import { MAP_PRICES_NOT_STORED } from "@/lib/fender-canvas/portfolio-retail";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { mapHero, mapLeakageTip } from "@/lib/fender-canvas/retail-overview-lead";
import { activeSetAsideClientKey, SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

const PAGE_SIZE = 1000;
const FAILED = "Below-MAP rows are not available.";

async function loadRows(violationsOnly: boolean): Promise<MapSourceRow[]> {
  const rows: MapSourceRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await listingsQuery(page, PAGE_SIZE, violationsOnly ? { violationsOnly: true } : undefined);
    if (error) throw error;
    const batch = (data ?? []) as MapSourceRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error(FAILED);
}

async function loadPrices(): Promise<ChannelPriceRow[]> {
  const rows: ChannelPriceRow[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await listingChannelPricesQuery(page, PAGE_SIZE);
    if (error) return page === 0 ? [] : rows;
    const batch = (data ?? []) as ChannelPriceRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  return rows;
}

async function loadExceptions(): Promise<{ asins: Set<string>; failed: boolean }> {
  try {
    const { data, error } = await getPublicCanvasSupabase()
      .from("canvas_issue_set_asides")
      .select("entity_key,status,outcome,reason_code")
      .eq("client_key", activeSetAsideClientKey())
      .eq("check_key", SET_ASIDE_CHECKS.mapPricing);
    if (error) return { asins: new Set(), failed: true };
    return { asins: approvedExceptionAsins((data ?? []) as MapSetAsideFields[]), failed: false };
  } catch {
    return { asins: new Set(), failed: true };
  }
}

function cellText(price: number | null, gap: number | null, note: string | null): string {
  if (price == null && gap == null) return "";
  return [price != null ? formatUsd(price) : null, gap != null ? formatUsd(gap, { signed: true }) : null, note]
    .filter(Boolean)
    .join(" ");
}

/** MAP listings in the same order and columns the tab shows before a column header is clicked. */
export async function loadMapExport(): Promise<BuiltExport> {
  try {
    const snapshot = await loadPortfolioRetailSnapshot();
    const pricesNotStored = snapshot.mapLeakage.missingMessage === MAP_PRICES_NOT_STORED;
    const [rows, prices, exceptions, asOf] = await Promise.all([
      loadRows(!pricesNotStored),
      loadPrices(),
      loadExceptions(),
      loadDashboardAsOf(),
    ]);
    const counted = withMapApprovedExceptions(snapshot, exceptions.asins, { failed: exceptions.failed });
    const hero = mapHero(counted);
    const model = mapTabModel(rows, prices);
    const lookup = channelPriceLookup(prices);
    const header = ["Listing", "ASIN", "MAP"];
    if (model.showAmazon) header.push("Amazon");
    if (model.showWalmart) header.push("Walmart");
    if (model.showMusiciansFriend) header.push("Musician's Friend");
    for (const channel of model.extraChannels) header.push(channel.name);

    const body = rows.map((row) => {
      const facts = new Map(listingChannelFacts(row, lookup.get(row.asin.trim())).map((fact) => [fact.key, fact]));
      const line = [
        listingLabel(row),
        row.asin,
        row.map_price != null ? formatUsd(row.map_price) : pendingLabel(),
      ];
      const push = (key: string, href: string | null, requirePage: boolean) => {
        const fact = facts.get(key);
        const note = missingCheckedPageLabel(requirePage, href, fact?.price);
        line.push(cellText(fact?.price ?? null, fact?.gap ?? null, note));
      };
      if (model.showAmazon) push("amazon", null, false);
      if (model.showWalmart) push("walmart", storedHttpUrl(row.wmt_url), true);
      if (model.showMusiciansFriend) push("musicians-friend", musiciansFriendCheckedPageUrl(lookup, row.asin), true);
      for (const channel of model.extraChannels) {
        const extra = lookup.get(row.asin.trim())?.get(channel.channel);
        push(channel.channel, extra ? storedHttpUrl(extra.url) : null, true);
      }
      return line;
    });

    const population =
      mapLeakageTip(counted) ??
      (hero.ratio ? `${hero.label}: ${hero.ratio}.` : hero.explainer);
    return exportFile(
      "map",
      {
        filter: pricesNotStored ? "No filter." : "Priced below MAP.",
        sort: "Worst leakage, lowest first.",
        asOf: asOf.asOf,
        population,
      },
      header,
      body,
    );
  } catch {
    return exportFailed(FAILED);
  }
}
