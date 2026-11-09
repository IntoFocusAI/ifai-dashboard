// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/partial-figure.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PARTIAL_TITLE,
  isPastCheckSchedule,
  markPartial,
  partialFigureTip,
  readFailedPartial,
  readFailure,
} from "../lib/fender-canvas/canvas-reads.ts";
import { DATA_STATUS_WORD, dataStatusFromNode } from "../lib/canvas-sdk/data-status.ts";
import { heroStatus } from "../lib/canvas-sdk/hero-fit.ts";

test("a partial figure's tooltip names what is missing, coverage, source, last check, and effect", () => {
  const tip = partialFigureTip({
    reason: "coverage",
    missing: "Walmart prices are missing for 12 listings",
    coverage: "121 of 633 listings",
    source: "canvas_retail_map",
    lastCheck: "2026-11-08T14:05:00Z",
    effect: "The share can only rise when they arrive",
  });
  assert.equal(
    tip,
    "Walmart prices are missing for 12 listings. Covers 121 of 633 listings. Source: canvas_retail_map. Last check: Nov 8, 2026, 2:05 PM UTC. The share can only rise when they arrive.",
  );
  assert.match(partialFigureTip({ reason: "stale", missing: "x", source: "s", lastCheck: null }), /Last check: not recorded\./);
});

test("the asterisk goes on once, and only on a partial figure", () => {
  const partial = { reason: "filtered" as const, missing: "Acoustics only", source: "canvas_ai_category" };
  assert.equal(markPartial("19.1%", partial), "19.1%*");
  assert.equal(markPartial("19.1%*", partial), "19.1%*");
  assert.equal(markPartial("19.1%", null), "19.1%");
  assert.equal(PARTIAL_TITLE.filtered, "Filtered figure");
});

test("a failed read is a partial figure that names the read once", () => {
  const tip = partialFigureTip(readFailedPartial(readFailure("m", "timeout")));
  assert.equal(tip, "The catalog metrics read (canvas_metrics) did not load: timeout. The figure is left out rather than shown as zero.");
});

test("data is stale only past twice its check schedule", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.parse("2026-11-09T12:00:00Z");
  assert.equal(isPastCheckSchedule("2026-11-08T12:00:00Z", day, now), false);
  assert.equal(isPastCheckSchedule("2026-11-07T11:59:00Z", day, now), true);
  assert.equal(isPastCheckSchedule(null, day, now), false);
  assert.equal(isPastCheckSchedule("2026-11-01T00:00:00Z", 0, now), false, "no schedule, no stale rule");
});

test("status color on a map figure comes with a mark and a word, never on a worded value", () => {
  assert.equal(dataStatusFromNode("danger"), "bad");
  assert.equal(dataStatusFromNode("neutral"), null);
  assert.equal(heroStatus("danger", "4.9%"), "bad");
  assert.equal(heroStatus("danger", "Not available*"), null);
  assert.equal(heroStatus("warning", "Loading"), null);
  assert.deepEqual(DATA_STATUS_WORD, { bad: "Poor", okay: "Fair", good: "Good" });
});
