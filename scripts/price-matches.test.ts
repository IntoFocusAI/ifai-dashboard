// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/price-matches.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { channelPriceLookup } from "../lib/fender-canvas/map-channels.ts";
import {
  PRICE_MATCH_DESC,
  PRICE_MATCH_LABEL,
  PRICE_MATCH_MISSING_DESC,
  PRICE_MATCH_MISSING_LABEL,
  priceMatchHrefs,
} from "../lib/fender-canvas/price-matches.ts";
import type { ChannelPriceRow } from "../lib/fender-canvas/map-channels.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const ASIN = "B0D2LP2PRQ";

function row(overrides: Partial<ChannelPriceRow> & Pick<ChannelPriceRow, "channel" | "url">): ChannelPriceRow {
  return {
    asin: ASIN,
    price: 100,
    checked_at: "2026-10-07T00:00:00Z",
    ...overrides,
  };
}

function hrefs(prices: ChannelPriceRow[], walmartUrl?: string | null, asin = ASIN): string[] {
  return priceMatchHrefs(asin, channelPriceLookup(prices), walmartUrl);
}

test("a stored Walmart page and a stored Musician's Friend page are both price matches", () => {
  const walmart = "https://www.walmart.com/ip/19311667655";
  const musiciansFriend =
    "https://www.musiciansfriend.com/guitars/fender-player-ii-jazzmaster/m11513000002000";
  const found = hrefs(
    [row({ channel: "musicians-friend", url: musiciansFriend, price: 714.99 })],
    walmart,
  );
  assert.deepEqual(found, [walmart, musiciansFriend]);
  assert.equal(PRICE_MATCH_LABEL, "Price match");
  assert.equal(
    PRICE_MATCH_DESC,
    "A page the read already stored for this product. It is not an Amazon-confirmed cause of the suppression.",
  );
});

test("extra stored pages follow the MAP channel order and stay http(s) only", () => {
  const sweetwater = "https://www.sweetwater.com/store/detail/example";
  const reverb = "http://reverb.com/item/1";
  const other = "https://www.example.com/other";
  const found = hrefs([
    row({ channel: "other-shop", url: other }),
    row({ channel: "reverb", url: `  ${reverb}  ` }),
    row({ channel: "sweetwater", url: sweetwater }),
    row({ channel: "amazon", url: "https://www.amazon.com/dp/B0D2LP2PRQ" }),
    row({ channel: "musicians-friend", url: "ftp://files.example/mf" }),
  ]);
  assert.deepEqual(found, [sweetwater, "http://reverb.com/item/1", other]);
});

test("the same stored page is shown once, from the channel cell or the listing field", () => {
  const walmart = "https://www.walmart.com/ip/18378571196";
  const found = hrefs([row({ channel: "walmart", url: walmart })], ` ${walmart} `);
  assert.deepEqual(found, [walmart]);
});

test("a different channel URL and listing URL are both shown", () => {
  const cell = "https://www.walmart.com/ip/1";
  const listing = "https://www.walmart.com/ip/2";
  assert.deepEqual(hrefs([row({ channel: "walmart", url: cell })], listing), [cell, listing]);
});

test("no stored http(s) page is an empty list, and a page is never invented", () => {
  const asin = "B0002KZYBS";
  const found = hrefs(
    [
      row({ asin, channel: "musicians-friend", url: null }),
      row({ asin, channel: "sweetwater", url: "not-a-url" }),
      row({ asin, channel: "reverb", url: "javascript:alert(1)" }),
      row({ asin, channel: "other-shop", url: "https://www.example.com/priced-out", price: 0 }),
    ],
    "  ",
    asin,
  );
  assert.deepEqual(found, []);
  assert.equal(PRICE_MATCH_MISSING_LABEL, "Not available*");
  assert.equal(PRICE_MATCH_MISSING_DESC, "No checked page was stored for this product.");
  const joined = found.join(" ");
  assert.doesNotMatch(joined, /amazon\.com|search|musiciansfriend/i);
});

test("an ASIN alone never becomes a retailer search or an Amazon listing link", () => {
  const found = priceMatchHrefs("B0HJDFP2XS", channelPriceLookup([]), null);
  assert.deepEqual(found, []);
  assert.doesNotMatch(JSON.stringify(found), /search|amazon\.com\/dp|walmart\.com/i);
});

test("Suppressed Listings labels every stored page Price match and says Not available* otherwise", () => {
  const panel = read("components/v3/live/SuppressedListingsPanel.tsx");
  const cell = read("components/v3/live/PriceMatchCell.tsx");
  const model = read("lib/fender-canvas/price-matches.ts");

  assert.match(panel, /PRICE_MATCH_COLUMN/);
  assert.match(panel, /PriceMatchCell/);
  assert.match(panel, /loadPriceMatchSources/);
  assert.match(panel, /priceMatchHrefs/);
  assert.match(cell, /PRICE_MATCH_LABEL/);
  assert.match(cell, /PRICE_MATCH_MISSING_LABEL/);
  assert.match(cell, /data-price-match="stored"/);
  assert.match(cell, /data-price-match="missing"/);
  assert.match(cell, /ifai-term listing-link/);
  assert.match(cell, /ifai-term fo-note/);
  assert.match(cell, /data-ifai-tooltip-title/);
  assert.match(cell, /data-ifai-tooltip-desc/);
  assert.match(cell, /tabIndex: 0/);
  assert.match(cell, /aria-label/);
  assert.match(cell, /headerTooltip/);
  assert.match(model, /checkedPageUrl/);
  assert.match(model, /musiciansFriendCheckedPageUrl/);
  assert.match(model, /channelPriceLookup/);
  assert.doesNotMatch(model, /https?:\/\//);
  assert.doesNotMatch(`${panel}\n${cell}\n${model}`, /\u2014/);
  assert.doesNotMatch(`${panel}\n${cell}`, /(?<![\w-])title=\{|(?<![\w-])title="/);

  for (const file of [
    "components/v3/live/SuppressedListingsPanel.tsx",
    "components/v3/live/PriceMatchCell.tsx",
  ]) {
    const lines = read(file).split("\n").length;
    assert.ok(lines <= 400, `${file} is ${lines} lines`);
  }
});
