// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/retail-bands.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  RETAIL_POOR_SHARE,
  retailBandSentence,
  toneForShare,
} from "../lib/fender-canvas/retail-overview-lead.ts";

const BASE = 1000;

test("the band is 5% of all monitored listings", () => {
  assert.equal(RETAIL_POOR_SHARE, 0.05);
});

test("0 is Good, under 5% is Fair, 5% or more is Poor", () => {
  assert.equal(toneForShare(0, 5, BASE), "success");
  assert.equal(toneForShare(1, 5, BASE), "warning", "1 of 5 bundles is graded on all listings, not 20%");
  assert.equal(toneForShare(49, 100, BASE), "warning", "4.9%");
  assert.equal(toneForShare(50, 100, BASE), "danger", "5.0%");
  assert.equal(toneForShare(51, 100, BASE), "danger", "5.1%");
});

test("a missing count or base keeps the warning", () => {
  assert.equal(toneForShare(null, 5, BASE), "warning");
  assert.equal(toneForShare(3, null, BASE), "warning");
  assert.equal(toneForShare(3, 5, null), "warning");
  assert.equal(toneForShare(3, 5, 0), "warning");
});

test("the tooltip sentence names the band and the base", () => {
  assert.equal(
    retailBandSentence(1198),
    "Good at 0; Fair under 5% of all 1,198 monitored listings; Poor at 5% or more.",
  );
  assert.equal(retailBandSentence(null), null);
});
