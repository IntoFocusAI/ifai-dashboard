// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/listing-content.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bulletCounts,
  contentGapRows,
  listingContentHeroes,
  summarizeListingContent,
  type ListingContentRow,
} from "../lib/fender-canvas/listing-content.ts";

function row(asin: string, bullets: number | null, aplus: string, video = "none_reported", source: string | null = "keepa"): ListingContentRow {
  return {
    asin,
    title: asin,
    bullet_count: bullets,
    image_count: 7,
    aplus_state: aplus,
    aplus_module_count: aplus === "present" ? 4 : 0,
    video_state: video,
    video_count: video === "present" ? 1 : 0,
    checked_at: "2026-10-28T00:00:00Z",
    aplus_source: source,
    video_source: source,
  };
}

test("five bullets share counts only listings with a bullet read", () => {
  const summary = summarizeListingContent([row("A", 5, "present"), row("B", 3, "none_reported"), row("C", null, "not_collected")]);
  const [bullets] = listingContentHeroes(summary);
  assert.equal(bullets.percent, "50.0%");
  assert.equal(bullets.ratio, "1 of 2");
  assert.deepEqual(contentGapRows(summary, "bullets").map((r) => r.asin), ["B"]);
  assert.deepEqual(bulletCounts(summary), { listings: 2, fullBullets: 1, short: 1, pct: 50 });
});

test("an unconfirmed A+ or video state is never counted as absent", () => {
  const summary = summarizeListingContent([row("A", 5, "present", "present"), row("B", 5, "none_reported"), row("C", 5, "not_collected")]);
  const [, aplus, video] = listingContentHeroes(summary);
  assert.equal(aplus.percent, "Not available*");
  assert.equal(aplus.denominator, null);
  assert.match(aplus.explainer, /Confirmed on 1 live listings/);
  assert.equal(video.percent, "Not available*");
  assert.deepEqual(contentGapRows(summary, "aplus"), []);
});

test("the A+ share counts live-page reads only, never Keepa's present", () => {
  const rows = [
    ...Array.from({ length: 30 }, (_, i) => row(`K${i}`, 5, "present")),
    row("L1", 5, "present", "present", "live_page"),
    row("L2", 5, "absent", "absent", "live_page"),
    row("L3", 5, "absent", "absent", "live_page"),
  ];
  const summary = summarizeListingContent(rows);
  const [, aplus, video] = listingContentHeroes(summary);
  assert.equal(aplus.ratio, "1 of 3");
  assert.equal(aplus.percent, "33.3%");
  assert.equal(video.ratio, "1 of 3");
  assert.deepEqual(contentGapRows(summary, "aplus").map((r) => r.asin), ["L2", "L3"]);
  assert.equal(listingContentHeroes(null)[0].percent, "Not available*");
});
