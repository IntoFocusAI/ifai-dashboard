import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MAP_PRICE_CHECK_SCHEDULE_MS,
  channelReadingNote,
  channelSummaryText,
  musiciansFriendCheckNote,
  walmartMissingPriceNote,
} from "../lib/fender-canvas/map-reading-status.ts";

const CHECKED = "2026-10-06T16:36:37.630Z";

test("Walmart missing prices are not counted as zero", () => {
  assert.equal(walmartMissingPriceNote(null), null);
  assert.equal(walmartMissingPriceNote(0), null);
  assert.equal(
    walmartMissingPriceNote(1),
    "1 listing in this read has no stored Walmart price, so it is missing from this count and is not counted as zero.",
  );
  assert.match(walmartMissingPriceNote(919) ?? "", /919 listings in this read have no stored Walmart price/);
  assert.match(walmartMissingPriceNote(919) ?? "", /not counted as zero/);
  assert.doesNotMatch(walmartMissingPriceNote(919) ?? "", /\b(40|84|532|920)\b/);
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

test("channel lines keep the below-MAP count and add only the Walmart and Musician's Friend notes", () => {
  const walmart = channelReadingNote("Walmart", { walmartMissing: 3 });
  const friend = channelReadingNote("Musician's Friend", {
    walmartMissing: 3,
    musiciansFriendLastRunAt: CHECKED,
    now: new Date(CHECKED).getTime() + STALE_AFTER_MS + 60_000,
  });
  const fresh = channelReadingNote("Musician's Friend", {
    walmartMissing: 3,
    musiciansFriendLastRunAt: CHECKED,
    now: new Date(CHECKED).getTime(),
  });
  // R-08: the caveat moves to the figure's tooltip; the visible count keeps an asterisk.
  assert.equal(channelSummaryText(2, walmart), "2 listings below MAP*");
  assert.equal(
    walmart,
    "3 listings in this read have no stored Walmart price, so they are missing from this count and are not counted as zero.",
  );
  assert.equal(channelSummaryText(1, friend), "1 listing below MAP*");
  assert.match(friend ?? "", /^Last checked /);
  assert.equal(channelSummaryText(4, fresh), "4 listings below MAP");
  assert.equal(channelReadingNote("Amazon", { walmartMissing: 3 }), null);
  assert.equal(channelReadingNote("Sweetwater", { walmartMissing: 3 }), null);
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
