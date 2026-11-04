import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EMPTY_METRICS_ROW } from "../lib/fender-canvas/canvas-reads.ts";
import { buildLiveCommandCenter } from "../lib/fender-canvas/command-center-from-live.ts";
import { buildTemplateVars } from "../lib/fender-canvas/template-vars.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

/** FDD X-03: the client dashboard does not present the catalog SKU count or the division count. */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function bundle(): CanvasBundle {
  return {
    m: { ...EMPTY_METRICS_ROW, division_count: 6 },
    cats: [],
    engines: [],
    sov: [],
    divisions: Array.from({ length: 6 }, (_, index) => ({ division: `Division ${index + 1}` })),
    missing: [],
    fresh: [],
    specPages: null,
    listingContent: null,
  } as CanvasBundle;
}

test("no narrative copy binds a division count", () => {
  const spec = read("data/fender-v3-spec.json");
  assert.doesNotMatch(spec, /\{division_count\}/);
  assert.doesNotMatch(spec, /division read lists/i);
  const hub = (JSON.parse(spec) as { spokes: { hub: { desc: string } } }).spokes.hub.desc;
  assert.equal(hub, "Overview of Fender's electric catalog health.");
  assert.equal("division_count" in buildTemplateVars(bundle()), false);
});

test("the Priorities summary prints no division count", () => {
  const summary = buildLiveCommandCenter(bundle()).summary;
  assert.doesNotMatch(summary, /\bdivisions?\b/i);
  assert.doesNotMatch(summary, /\b6\b/);
});

test("the Summary description has no division fallback left to fill", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const fallbacks = read("components/v3/read-fallbacks.tsx");
  assert.doesNotMatch(spokes, /readFallbackDesc/);
  assert.doesNotMatch(fallbacks, /division_count|readFallbackDesc/);
});
