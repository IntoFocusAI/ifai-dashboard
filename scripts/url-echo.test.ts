// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/url-echo.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createUrlEchoes } from "../lib/canvas-sdk/url-echo.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("both writes from opening a spoke and clicking a tab come back as echoes", () => {
  const echoes = createUrlEchoes();
  echoes.wrote("spoke=ecommerce&tab=retail-overview");
  echoes.wrote("spoke=ecommerce&tab=map");
  assert.equal(echoes.take("spoke=ecommerce&tab=retail-overview"), true, "the older write is not re-applied over the click");
  assert.equal(echoes.take("spoke=ecommerce&tab=map"), true);
  assert.equal(echoes.latest(), null);
});

test("a write the router skipped past is retired with the newer one", () => {
  const echoes = createUrlEchoes();
  echoes.wrote("spoke=ecommerce");
  echoes.wrote("spoke=ecommerce&tab=map");
  assert.equal(echoes.take("spoke=ecommerce&tab=map"), true);
  assert.equal(echoes.take("spoke=ecommerce"), false, "a later Back to that URL applies");
});

test("the newest unanswered write is what the URL will say", () => {
  const echoes = createUrlEchoes();
  assert.equal(echoes.latest(), null);
  echoes.wrote("spoke=aeo");
  echoes.wrote("spoke=aeo&tab=citations");
  assert.equal(echoes.latest(), "spoke=aeo&tab=citations");
});

test("Back, Forward, or a link applies and retires every pending write", () => {
  const echoes = createUrlEchoes();
  echoes.wrote("spoke=aeo");
  assert.equal(echoes.take("spoke=ecommerce&tab=map"), false);
  assert.equal(echoes.latest(), null);
  assert.equal(echoes.take("spoke=aeo"), false);
});

test("pending writes stay bounded", () => {
  const echoes = createUrlEchoes(3);
  for (const q of ["a=1", "a=2", "a=3", "a=4"]) echoes.wrote(q);
  assert.equal(echoes.take("a=1"), false);
  echoes.wrote("a=5");
  assert.equal(echoes.take("a=5"), true);
});

test("the URL applies when the query or the spoke set changes, not when live data rebuilds the list", () => {
  const sync = read("lib/canvas-sdk/useCanvasUrlSync.ts");
  assert.match(sync, /const spokeKey = spokeIds\.join\("\|"\)/);
  assert.match(sync, /if \(appliedKey\.current === key\) return;/);
  assert.ok(!sync.includes("skipUrlSync"), "no single-shot skip flag left to be used up by a rebuild");
});

test("an open panel is never under the lifted map, and a hidden panel keeps its open width", () => {
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.ok(!css.includes(".ifai-canvas:not(.column-layout):has(.satellite-group.visible)"));
  assert.match(css, /\.ifai-canvas:not\(\.column-layout\):not\(\.panel-open\):has\(\.satellite-group\.visible\) \.viewport-container \{\s*z-index: 48;/);
  assert.match(css, /width: var\(--drilldown-panel-width, var\(--drilldown-width\)\);/);
  const shell = read("lib/canvas-sdk/CanvasShell.tsx");
  assert.match(shell, /"--drilldown-panel-width": `\$\{shownDrilldownWidth\}px`/);
  assert.match(read("lib/canvas-sdk/useIomColumnLayout.ts"), /const drilldownWidth = panelLayout === "hidden" \? 0 : shownDrilldownWidth;/);
});
