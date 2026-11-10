import { loadDashboardAsOf } from "@/lib/export/as-of";
import { stockEpisodesTableId } from "@/lib/export/tables";
import type { SourceRead } from "@/lib/export/types";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  EPISODE_COLUMNS,
  EPISODE_STATE_LABELS,
  episodeEndLabel,
  episodeKey,
  formatDay,
  stockEpisodesQuery,
  type StockEpisode,
} from "@/lib/fender-canvas/stock-loss";

const FAILED = "The dated stretches could not be loaded.";

/** The dated out-of-stock and no-Buy-Box stretches for one listing, newest first, as the drawer shows them. */
export async function loadStockEpisodesSource(asin: string): Promise<SourceRead> {
  try {
    const [{ data, error }, asOf] = await Promise.all([stockEpisodesQuery(asin), loadDashboardAsOf()]);
    if (error) return { ok: false, message: FAILED };
    const episodes = (data ?? []) as StockEpisode[];
    return {
      ok: true,
      source: {
        table: stockEpisodesTableId(asin),
        header: EPISODE_COLUMNS.map((column) => column.name),
        rows: episodes.map((episode) => ({
          key: episodeKey(episode),
          cells: [
            EPISODE_STATE_LABELS[episode.state],
            formatDay(episode.start_day) ?? "",
            episodeEndLabel(episode),
            String(episode.days),
          ],
        })),
        filter: `Listing ${asin}.`,
        sort: "Started, newest first.",
        population: `${formatInt(episodes.length)} dated ${episodes.length === 1 ? "stretch" : "stretches"} in the last 12 months when listing ${asin} was out of stock or had no Buy Box. Source: Keepa.`,
        asOf: asOf.asOf,
      },
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}
