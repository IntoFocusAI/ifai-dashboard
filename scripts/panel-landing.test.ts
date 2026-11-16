// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/panel-landing.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { landPanelFrom, panelOpenedFrom } from "../lib/canvas-sdk/panel-landing.ts";
import { openedFromPageFoundBubble, PAGE_FOUND_BUBBLE_ID } from "../components/v3/live/useLandOnPageFoundHero.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("a bubble click records that bubble, and any other way in clears it", () => {
  landPanelFrom(PAGE_FOUND_BUBBLE_ID);
  assert.equal(panelOpenedFrom("spoke-specs"), true);
  assert.equal(openedFromPageFoundBubble(), true);
  assert.equal(panelOpenedFrom("sat-schema"), false);

  landPanelFrom("sat-schema");
  assert.equal(openedFromPageFoundBubble(), false, "the Brand-Site Specs satellite is not the AI Readiness bubble");

  landPanelFrom(PAGE_FOUND_BUBBLE_ID);
  landPanelFrom(null);
  assert.equal(openedFromPageFoundBubble(), false, "a slot, link, or tab opened after the bubble does not land");
});

test("the shell records the clicked bubble on every open and the map passes the bubble's id", () => {
  const shell = read("lib/canvas-sdk/useCanvasShellNav.ts");
  assert.match(shell, /\(spokeId: string, subTab\?: string, fromBubble\?: string\) => \{\n\s+const spoke = spec\.spokes\[spokeId\];\n\s+if \(!spoke\) return;\n\s+landPanelFrom\(fromBubble \?\? null\);/);
  assert.equal(shell.match(/landPanelFrom/g)?.length, 2, "one import and one call");

  const node = read("lib/canvas-sdk/CanvasGraphNode.tsx");
  assert.match(node, /onFocusNode\(node\.spokeId, node\.subTab, node\.id\)/);
  assert.match(read("lib/canvas-sdk/CanvasGraph.tsx"), /onFocusNode: \(spokeId: string, subTab\?: string, fromBubble\?: string\) => void/);
});

test("Brand-Site Specs opens on the page-found table only when the AI Readiness bubble opened it", () => {
  const panel = read("components/v3/live/MachineReadabilityPanel.tsx");
  assert.match(panel, /useState<OpenTable>\(\(\) =>\s+openedFromPageFoundBubble\(\) \? PAGE_FOUND_HERO_ID : "missing_specs",?\s+\)/);
  assert.match(panel, /useLandOnPageFoundHero\(PAGE_FOUND_ANCHOR, \(\) => setOpenTable\(PAGE_FOUND_HERO_ID\)\)/);
  const land = read("components/v3/live/useLandOnPageFoundHero.ts");
  assert.match(land, /openTable\(\);\s+requestAnimationFrame\(\(\) => \{\s+document\.getElementById\(anchorId\)\?\.scrollIntoView/);
  assert.doesNotMatch(land, /addEventListener/, "the landing comes from the shell, not a document click listener");
});
