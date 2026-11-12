import { isPastCheckSchedule, partialFigureTip, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import type { MapSourceRow } from "@/lib/fender-canvas/map-channels";
import { RECHECK_DAYS, rowsStale } from "@/lib/fender-canvas/row-stale";
import { isFenderClient } from "@/lib/brand-copy";

/** Same job the freshness bar labels MF MAP. */
export const MUSICIANS_FRIEND_FRESHNESS_JOB = "map_parity_musiciansfriend";

/** Matches the freshness bar: a job older than 26 hours is stale. Buy Box readings use it. */
export const READING_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

/**
 * MAP prices are checked daily (decision 4, 9 Nov 2026). A channel count gets its asterisk
 * when the check is older than twice that schedule (X-25).
 */
export const MAP_PRICE_CHECK_SCHEDULE_MS = 24 * 60 * 60 * 1000;

const checkedAtFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/**
 * Listings with no stored Walmart price are missing from the below-MAP count.
 * A missing price is not a price of zero.
 */
export function walmartMissingPriceNote(missing: number | null): string | null {
  if (missing == null || missing <= 0) return null;
  if (missing === 1) {
    return "1 listing in this read has no stored Walmart price, so it is missing from this count and is not counted as zero.";
  }
  return `${formatInt(missing)} listings in this read have no stored Walmart price, so they are missing from this count and are not counted as zero.`;
}

/** Last check time, only when the Musician's Friend job is older than twice the daily MAP check schedule. */
export function musiciansFriendCheckNote(
  lastRunAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!lastRunAt) return null;
  const then = new Date(lastRunAt);
  const at = then.getTime();
  if (!Number.isFinite(at)) return null;
  if (!isPastCheckSchedule(lastRunAt, MAP_PRICE_CHECK_SCHEDULE_MS, now)) return null;
  return `Last checked ${checkedAtFormat.format(then)}. MAP prices are checked daily, and this check is older than twice that schedule, so these prices may have changed.`;
}

/**
 * One channel line. A partial channel count carries an asterisk; its note (missing
 * Walmart prices, a stale Musician's Friend check) goes in that figure's tooltip.
 */
export function channelSummaryText(count: number, note: string | null): string {
  const noun = count === 1 ? "listing" : "listings";
  const lead = `${formatInt(count)} ${noun} below MAP`;
  return note ? `${lead}*` : lead;
}

/** The stale reading per channel line (X-25), keyed by channel name. */
export type ChannelStale = Partial<Record<string, PartialFigure | null>>;

/**
 * Each channel's own listings against its recheck interval (Watson, 11 Nov): Amazon prices carry
 * featured_offer_checked_at (1 day), Walmart wmt_checked_at (1 day Fender, 2 days Ledlenser),
 * Musician's Friend mf_checked_at (3 days, Fender only). A channel counts the listings with a stored price.
 */
export function mapChannelStale(rows: readonly MapSourceRow[], now: number = Date.now()): ChannelStale {
  const rule = (check: string, intervalDays: number) => ({
    intervalDays,
    check: `${check} price check`,
    source: "canvas_retail_listings",
    figure: "channel counts",
  });
  return {
    Amazon: rowsStale(
      rows.filter((row) => row.offer_price != null),
      (row) => row.featured_offer_checked_at,
      rule("Amazon", RECHECK_DAYS.buyBox),
      now,
    ),
    Walmart: rowsStale(
      rows.filter((row) => (row.wmt_price ?? 0) > 0),
      (row) => row.wmt_checked_at,
      rule("Walmart", isFenderClient() ? RECHECK_DAYS.walmartFender : RECHECK_DAYS.walmartLedlenser),
      now,
    ),
    "Musician's Friend": rowsStale(
      rows.filter((row) => (row.mf_price ?? 0) > 0),
      (row) => row.mf_checked_at,
      rule("Musician's Friend", RECHECK_DAYS.musiciansFriend),
      now,
    ),
  };
}

export function channelReadingNote(
  name: string,
  input: {
    walmartMissing: number | null;
    musiciansFriendLastRunAt?: string | null;
    /** Per-channel stale readings. When given, they replace the job-time check. */
    channelStale?: ChannelStale;
    now?: number;
  },
): string | null {
  const stale = input.channelStale?.[name];
  const staleTip = stale ? partialFigureTip(stale) : null;
  if (name === "Walmart") {
    return [walmartMissingPriceNote(input.walmartMissing), staleTip].filter(Boolean).join(" ") || null;
  }
  if (name === "Musician's Friend") {
    if (input.channelStale) return staleTip;
    return musiciansFriendCheckNote(input.musiciansFriendLastRunAt, input.now);
  }
  return staleTip;
}
