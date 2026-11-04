import { formatInt } from "@/lib/fender-canvas/format";

/** Same job the freshness bar labels MF MAP. */
export const MUSICIANS_FRIEND_FRESHNESS_JOB = "map_parity_musiciansfriend";

/** Matches the freshness bar: a job older than 26 hours is stale. */
export const READING_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

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

/** Last check time, only when the Musician's Friend job is more than 26 hours old. */
export function musiciansFriendCheckNote(
  lastRunAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (!lastRunAt) return null;
  const then = new Date(lastRunAt);
  const at = then.getTime();
  if (!Number.isFinite(at)) return null;
  if (now - at <= READING_STALE_AFTER_MS) return null;
  return `Last checked ${checkedAtFormat.format(then)}.`;
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

export function channelReadingNote(
  name: string,
  input: {
    walmartMissing: number | null;
    musiciansFriendLastRunAt?: string | null;
    now?: number;
  },
): string | null {
  if (name === "Walmart") return walmartMissingPriceNote(input.walmartMissing);
  if (name === "Musician's Friend") {
    return musiciansFriendCheckNote(input.musiciansFriendLastRunAt, input.now);
  }
  return null;
}
