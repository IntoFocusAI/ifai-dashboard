import { listingChannelPricesQuery, listingsQuery } from "@/lib/canvasData";
import { loadDashboardAsOf } from "@/lib/export/as-of";
import type { SourceRead } from "@/lib/export/types";
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
  withoutApprovedExceptions,
  type MapSetAsideFields,
} from "@/lib/fender-canvas/map-approved-exceptions";
import {
  ANALYST_ESTIMATE_LABEL,
  AWAITING_INPUTS_LABEL,
  MAP_EXPOSURE_LABEL,
  MAP_EXPOSURE_ORDER,
  MAP_UNITS_LABEL,
  MAP_UNITS_SOURCE,
  awaitingReasonSentence,
  loadMapUnits,
  mapAwaitingSentence,
  mapExposure,
  mapExposureCoverage,
  mapExposureOrder,
  mapExposureSummary,
  mapUnitsLookup,
  type MapExposure,
} from "@/lib/fender-canvas/map-exposure";
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

/** The exposure cell as the screen reads it: the dollars, or Awaiting inputs with its reason. */
function exposureText(exposure: MapExposure): string {
  if (exposure.status === "estimated") return formatUsd(exposure.value);
  return `${AWAITING_INPUTS_LABEL}. ${awaitingReasonSentence(exposure.reason)}`;
}

/** MAP listings in the same order and columns the tab shows before a column header is clicked. */
export async function loadMapSource(): Promise<SourceRead> {
  try {
    const snapshot = await loadPortfolioRetailSnapshot();
    const pricesNotStored = snapshot.mapLeakage.missingMessage === MAP_PRICES_NOT_STORED;
    const [readRows, prices, exceptions, asOf] = await Promise.all([
      loadRows(!pricesNotStored),
      loadPrices(),
      loadExceptions(),
      loadDashboardAsOf(),
    ]);
    // R-09: the same unit read the tab makes. A failed read adds no exposure column.
    const unitRows = pricesNotStored ? null : await loadMapUnits(readRows.map((row) => row.asin));
    const units = unitRows ? mapUnitsLookup(unitRows) : null;
    const rows = units ? mapExposureOrder(readRows, units) : readRows;
    const counted = withMapApprovedExceptions(snapshot, exceptions.asins, { failed: exceptions.failed });
    const hero = mapHero(counted);
    const model = mapTabModel(rows, prices);
    const lookup = channelPriceLookup(prices);
    const header = ["Listing", "ASIN", "MAP"];
    if (model.showAmazon) header.push("Amazon");
    if (units) {
      header.push(
        `${MAP_UNITS_LABEL} (${MAP_UNITS_SOURCE})`,
        `${MAP_EXPOSURE_LABEL} a month (${ANALYST_ESTIMATE_LABEL})`,
      );
    }
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
      if (units) {
        const exposure = mapExposure(row, units);
        line.push(exposure.units != null ? String(exposure.units) : "", exposureText(exposure));
      }
      if (model.showWalmart) push("walmart", storedHttpUrl(row.wmt_url), true);
      if (model.showMusiciansFriend) push("musicians-friend", musiciansFriendCheckedPageUrl(lookup, row.asin), true);
      for (const channel of model.extraChannels) {
        const extra = lookup.get(row.asin.trim())?.get(channel.channel);
        push(channel.channel, extra ? storedHttpUrl(extra.url) : null, true);
      }
      return { key: row.asin, cells: line };
    });

    const violations =
      mapLeakageTip(counted) ??
      (hero.ratio ? `${hero.label}: ${hero.ratio}.` : hero.explainer);
    const summary = units ? mapExposureSummary(withoutApprovedExceptions(rows, exceptions.asins), units) : null;
    const exposureSentence = summary
      ? [
          summary.totalValue != null
            ? `${MAP_EXPOSURE_LABEL} (${ANALYST_ESTIMATE_LABEL}, ${MAP_UNITS_SOURCE} units): ${formatUsd(summary.totalValue)} a month.`
            : null,
          `${mapExposureCoverage(summary)}.`,
          mapAwaitingSentence(summary),
        ]
          .filter(Boolean)
          .join(" ")
      : null;
    const population = [violations, exposureSentence].filter(Boolean).join(" ");
    return {
      ok: true,
      source: {
        table: "map-listings",
        header,
        rows: body,
        filter: pricesNotStored ? null : "Priced below MAP.",
        sort: units ? `${MAP_EXPOSURE_ORDER}.` : "Worst leakage, lowest first.",
        population,
        asOf: asOf.asOf,
        setAsideCheck: SET_ASIDE_CHECKS.mapPricing,
      },
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}
