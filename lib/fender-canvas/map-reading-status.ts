import { isPastCheckSchedule, partialFigureTip, type PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";
import type { MapSourceRow } from "@/lib/fender-canvas/map-channels";
import { RECHECK_DAYS, retailerRecheckDays, rowsStale } from "@/lib/fender-canvas/row-stale";

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

/** One retailer's carried listings (a match, page or price) and how many of them have no price read. */
export type ChannelCarry = { carried: number; missing: number };

/** Carried listings per channel name. A channel the read could not count is absent. */
export type ChannelCarryMap = Partial<Record<string, ChannelCarry | null>>;

/**
 * Carried listings with no price in this read are missing from the below-MAP count, and a missing
 * price is not a price of zero. Listings the retailer does not carry are not missing.
 */
export function missingPriceNote(retailer: string, missing: number | null | undefined): string | null {
  if (missing == null || missing <= 0) return null;
  if (missing === 1) {
    return `1 listing carried by ${retailer} has no price in this read, so it is missing from this count and is not counted as zero.`;
  }
  return `${formatInt(missing)} listings carried by ${retailer} have no price in this read, so they are missing from this count and are not counted as zero.`;
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
 * One channel line: "{below} of {carried} listings below MAP". A partial channel count carries an
 * asterisk; its note (carried listings with no price, a stale check) goes in that figure's tooltip.
 * When the carried count could not be read, the line keeps the count alone.
 */
export function channelSummaryText(count: number, carried: number | null | undefined, note: string | null): string {
  const noun = (carried ?? count) === 1 ? "listing" : "listings";
  const lead =
    carried == null
      ? `${formatInt(count)} ${noun} below MAP`
      : `${formatInt(count)} of ${formatInt(carried)} ${noun} below MAP`;
  return note ? `${lead}*` : lead;
}

/** The stale reading per channel line (X-25), keyed by channel name. */
export type ChannelStale = Partial<Record<string, PartialFigure | null>>;

/**
 * Each channel's own listings against its recheck interval (Watson, 11 Nov): Amazon prices carry
 * featured_offer_checked_at (1 day); Walmart wmt_checked_at and Musician's Friend mf_checked_at at the
 * recheck days in the client's retailers setting. A retailer the client does not check reads no
 * stale line. A channel counts the listings with a stored price.
 */
export function mapChannelStale(rows: readonly MapSourceRow[], now: number = Date.now()): ChannelStale {
  const rule = (check: string, intervalDays: number) => ({
    intervalDays,
    check: `${check} price check`,
    source: "canvas_retail_listings",
    figure: "channel counts",
  });
  const retailer = (
    key: string,
    check: string,
    priced: (row: MapSourceRow) => boolean,
    at: (row: MapSourceRow) => string | null | undefined,
  ): PartialFigure | null => {
    const days = retailerRecheckDays(key);
    return days == null ? null : rowsStale(rows.filter(priced), at, rule(check, days), now);
  };
  return {
    Amazon: rowsStale(
      rows.filter((row) => row.offer_price != null),
      (row) => row.featured_offer_checked_at,
      rule("Amazon", RECHECK_DAYS.buyBox),
      now,
    ),
    Walmart: retailer("walmart", "Walmart", (row) => (row.wmt_price ?? 0) > 0, (row) => row.wmt_checked_at),
    "Musician's Friend": retailer(
      "musiciansfriend",
      "Musician's Friend",
      (row) => (row.mf_price ?? 0) > 0,
      (row) => row.mf_checked_at,
    ),
  };
}

export function channelReadingNote(
  name: string,
  input: {
    /** Carried listings with no price read, per channel name. */
    carry?: ChannelCarryMap;
    musiciansFriendLastRunAt?: string | null;
    /** Per-channel stale readings. When given, they replace the job-time check. */
    channelStale?: ChannelStale;
    now?: number;
  },
): string | null {
  const stale = input.channelStale?.[name];
  const staleTip = stale ? partialFigureTip(stale) : null;
  const missing = missingPriceNote(name, input.carry?.[name]?.missing);
  if (name === "Musician's Friend" && !input.channelStale) {
    return [missing, musiciansFriendCheckNote(input.musiciansFriendLastRunAt, input.now)].filter(Boolean).join(" ") || null;
  }
  return [missing, staleTip].filter(Boolean).join(" ") || null;
}
