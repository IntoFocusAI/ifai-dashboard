import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MAP_PRICE_CHECK_SCHEDULE_MS,
  channelReadingNote,
  channelSummaryText,
  musiciansFriendCheckNote,
  missingPriceNote,
} from "../lib/fender-canvas/map-reading-status.ts";

const CHECKED = "2026-10-06T16:36:37.630Z";

test("only carried listings with no price are missing, and never counted as zero", () => {
  assert.equal(missingPriceNote("Walmart", null), null);
  assert.equal(missingPriceNote("Walmart", 0), null);
  assert.equal(
    missingPriceNote("Walmart", 1),
    "1 listing carried by Walmart has no price in this read, so it is missing from this count and is not counted as zero.",
  );
  assert.equal(
    missingPriceNote("Musician's Friend", 1034),
    "1,034 listings carried by Musician's Friend have no price in this read, so they are missing from this count and are not counted as zero.",
  );
  assert.doesNotMatch(missingPriceNote("Walmart", 12) ?? "", /stored Walmart price|in this read have/);
});

// X-25, decision 4: MAP prices are checked daily; the asterisk appears past twice that schedule.
const STALE_AFTER_MS = 2 * MAP_PRICE_CHECK_SCHEDULE_MS;

test("Musician's Friend states the last check only past twice the daily MAP schedule", () => {
  const at = new Date(CHECKED).getTime();
  assert.equal(MAP_PRICE_CHECK_SCHEDULE_MS, 24 * 60 * 60 * 1000);
  assert.equal(musiciansFriendCheckNote(null, at), null);
  assert.equal(musiciansFriendCheckNote("not-a-time", at), null);
  assert.equal(musiciansFriendCheckNote(CHECKED, at + STALE_AFTER_MS), null);
  assert.equal(
    musiciansFriendCheckNote(CHECKED, at + STALE_AFTER_MS + 1),
    "Last checked Oct 6, 2026, 4:36 PM UTC. MAP prices are checked daily, and this check is older than twice that schedule, so these prices may have changed.",
  );
});

test("channel lines read N of carried listings below MAP", () => {
  // Fender shape: 136 carried on Walmart and all priced; 365 carried on Musician's Friend.
  assert.equal(channelSummaryText(12, 136, null), "12 of 136 listings below MAP");
  assert.equal(channelSummaryText(72, 365, null), "72 of 365 listings below MAP");
  assert.equal(channelSummaryText(40, 1170, null), "40 of 1,170 listings below MAP");
  assert.equal(channelSummaryText(1, 1, null), "1 of 1 listing below MAP");
  // The carried count could not be read: the count stands alone.
  assert.equal(channelSummaryText(2, null, null), "2 listings below MAP");
});

test("not carried is not missing; matched without a price is, with an asterisk and a tooltip", () => {
  // Walmart: 1,034 listings are not on Walmart, so only matched-without-price listings count as missing.
  const allPriced = { Walmart: { carried: 136, missing: 0 } };
  assert.equal(channelReadingNote("Walmart", { carry: allPriced }), null);
  assert.equal(channelSummaryText(12, 136, channelReadingNote("Walmart", { carry: allPriced })), "12 of 136 listings below MAP");
  const matchedNoPrice = { Walmart: { carried: 136, missing: 3 } };
  const note = channelReadingNote("Walmart", { carry: matchedNoPrice });
  assert.equal(
    note,
    "3 listings carried by Walmart have no price in this read, so they are missing from this count and are not counted as zero.",
  );
  assert.equal(channelSummaryText(12, 136, note), "12 of 136 listings below MAP*");
  // Musician's Friend with no price on 805 uncarried listings carries no asterisk.
  const friendCarry = { "Musician's Friend": { carried: 365, missing: 0 } };
  const fresh = channelReadingNote("Musician's Friend", {
    carry: friendCarry,
    musiciansFriendLastRunAt: CHECKED,
    now: new Date(CHECKED).getTime(),
  });
  assert.equal(fresh, null);
  assert.equal(channelSummaryText(72, 365, fresh), "72 of 365 listings below MAP");
  // A stale Musician's Friend check still asterisks the line.
  const stale = channelReadingNote("Musician's Friend", {
    carry: friendCarry,
    musiciansFriendLastRunAt: CHECKED,
    now: new Date(CHECKED).getTime() + STALE_AFTER_MS + 60_000,
  });
  assert.match(stale ?? "", /^Last checked /);
  assert.equal(channelSummaryText(72, 365, stale), "72 of 365 listings below MAP*");
  // The note names the retailer on the line, for any retailer in the client's settings.
  assert.match(channelReadingNote("Amazon", { carry: { Amazon: { carried: 1170, missing: 2 } } }) ?? "", /^2 listings carried by Amazon /);
  assert.equal(channelReadingNote("Sweetwater", { carry: allPriced }), null);
});

test("a channel cell prints the signed gap and does not name it Amazon gap", () => {
  const source = readFileSync(
    new URL("../components/v3/live/ChannelPriceCell.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /Amazon gap/);
  assert.match(source, /<StatusMark status="bad"/);
  assert.match(source, /below MAP/);
  assert.match(source, /gap < 0/);
});

test("a channel cell marks a missing checked page without inventing a retailer URL", () => {
  const source = readFileSync(
    new URL("../components/v3/live/ChannelPriceCell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /MISSING_CHECKED_PAGE_LABEL/);
  assert.match(source, /requireCheckedPage/);
  assert.match(source, /data-ifai-tooltip-desc/);
  assert.match(source, /ifai-term/);
  assert.doesNotMatch(source, /(?<![\w-])title=/);
  assert.doesNotMatch(source, /musiciansfriend\.com\/search/i);
  assert.doesNotMatch(source, /google\.com\/search/i);
});
