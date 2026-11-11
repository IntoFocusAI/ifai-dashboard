// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/map-one-story.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadPortfolioRetailSnapshot, type MapLeakageRow } from "../lib/fender-canvas/portfolio-retail.ts";
import { mapHero, mapLeakageTip } from "../lib/fender-canvas/retail-overview-lead.ts";

/* Worker 21.4 / FDD R-08: one MAP explainer path on the MAP tab. MAP is defined once
   (the lead label); the coverage caveat lives in the N of M tooltip; channel caveats sit
   behind an asterisk instead of repeating as prose. */

const panel = readFileSync(new URL("../components/v3/live/MapChannelPanel.tsx", import.meta.url), "utf8");

function notesFn(): string {
  return panel.slice(panel.indexOf("function MapNotes"), panel.indexOf("function MapTopRow"));
}

test("MAP is defined once, on the lead label", () => {
  const uses = panel.match(/<DefinedCopy\b/g) ?? [];
  assert.equal(uses.length, 1);
  assert.match(panel, /<div data-map-lead-label="">\s*<DefinedCopy text=\{hero\.label\} \/>/);
  assert.doesNotMatch(notesFn(), /DefinedCopy|DefinedTerm/);
  // Panel glossary injection is kept out, so it cannot add a second MAP definition.
  assert.match(panel, /className="retail-health retail-surface"/);
});

test("channel caveats sit in the figure's tooltip, not in prose", () => {
  const notes = notesFn();
  assert.match(notes, /<FigureTip title=\{channel\.name\} desc=\{note\}/);
  assert.doesNotMatch(notes, /\{note\}\s*<\/li>/);
  // No native title tooltips on HTML elements; only FigureTip's custom tooltip title prop.
  assert.doesNotMatch(panel, /<[a-z][^>]*\stitle=/);
});

test("the N of M tooltip says which listings were counted and what the read could not compare", async () => {
  const rows: MapLeakageRow[] = [
    { asin: "B000000001", map_price: 100, offer_price: 80, amz_leakage: -20, wmt_leakage: null, mf_leakage: null },
    { asin: "B000000002", map_price: 100, offer_price: 100, amz_leakage: 0, wmt_leakage: null, mf_leakage: null },
    { asin: "B000000003", map_price: 100, offer_price: 90, amz_leakage: null, wmt_leakage: null, mf_leakage: null },
    { asin: "B000000004", map_price: null, offer_price: 90, amz_leakage: null, wmt_leakage: null, mf_leakage: null },
  ];
  const snapshot = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({ ok: false }),
    mapRows: async () => ({ ok: true, rows, truncated: false }),
    catalogRows: async () => ({ ok: false }),
    catalogBundleCount: async () => null,
    specRows: async () => ({ ok: false }),
  });
  const tip = mapLeakageTip(snapshot) ?? "";
  assert.match(tip, /^1 of 2 listings with a stored MAP price and at least one stored channel price are priced below MAP\./);
  assert.match(tip, /2 other monitored listings have no stored MAP comparison\./);
  assert.match(tip, /0 listings set aside as approved exceptions/);
  assert.equal(mapHero(snapshot).tip, tip);
  assert.match(panel, /<FigureTip title=\{hero\.label\} desc=\{hero\.tip\} testId="map-ratio">/);
});
