// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/map-interaction.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sameTooltipContent, type TooltipContent } from "../lib/canvas-sdk/tooltip-content.ts";
import { INTERACTIVE_SELECTOR, pointInRect } from "../lib/canvas-sdk/iom-cursor-targets.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const box: TooltipContent = { title: "Catalog Health", desc: "Buy Box and MAP", hasMoreInfo: true, anchor: "cursor" };

test("a pointer move along the same bubble keeps the same tooltip content", () => {
  assert.equal(sameTooltipContent(box, { ...box }), true);
  assert.equal(sameTooltipContent(box, { ...box, example: false }), true, "a missing example flag reads as false");
  assert.equal(sameTooltipContent(null, null), true);
});

test("a different bubble, anchor, or example flag is new tooltip content", () => {
  assert.equal(sameTooltipContent(box, { ...box, title: "AI Readiness" }), false);
  assert.equal(sameTooltipContent(box, { ...box, desc: "Other" }), false);
  assert.equal(sameTooltipContent(box, { ...box, anchor: "column-right" }), false);
  assert.equal(sameTooltipContent(box, { ...box, hasMoreInfo: false }), false);
  assert.equal(sameTooltipContent(box, { ...box, example: true }), false);
  assert.equal(sameTooltipContent(null, box), false);
});

test("the reticle region includes its edges", () => {
  const rect = { left: 0, top: 0, right: 1280, bottom: 720 };
  assert.equal(pointInRect(0, 0, rect), true);
  assert.equal(pointInRect(1280, 720, rect), true);
  assert.equal(pointInRect(-1, 300, rect), false);
  assert.equal(pointInRect(640, 721, rect), false);
});

test("the reticle reads definitions, disclosures, and panel links as clickable", () => {
  const selectors = INTERACTIVE_SELECTOR.split(", ");
  for (const selector of [".ifai-term", "summary", "[data-ifai-open]", "[data-ifai-star]", "[data-ifai-filter]", "[role='tab']"]) {
    assert.ok(selectors.includes(selector), selector);
  }
});

test("the reticle hides for the window edge, focus loss, and native pickers", () => {
  const cursor = read("lib/canvas-sdk/IomCursor.tsx");
  assert.match(cursor, /addEventListener\("pointerout", onOut/);
  assert.match(cursor, /addEventListener\("blur", hide\)/);
  assert.match(cursor, /addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(cursor, /opensNativePicker\(event\.target\)/);
  assert.match(cursor, /document\.elementFromPoint\(state\.x, state\.y\)/, "hover is re-read under a still pointer");
  assert.match(read("lib/canvas-sdk/iom-theme.css"), /\.iom-cursor-portal \{[^}]*z-index: 2147483647;/);
});

test("a pointer move renders nothing in React on the map", () => {
  const cursor = read("lib/canvas-sdk/IomCursor.tsx");
  assert.doesNotMatch(cursor, /setPos|setVisible|setHover/, "position, visibility, and hover are written to the reticle directly");
  assert.match(cursor, /requestAnimationFrame\(paint\)/, "moves are coalesced into one write per frame");

  const wash = read("lib/canvas-sdk/useIomPointerWash.ts");
  assert.match(wash, /wash\.style\.setProperty\("--pointer-x"/, "the glow variables live on the wash, not the canvas body");
  assert.match(wash, /requestAnimationFrame\(paint\)/);

  const shell = read("lib/canvas-sdk/CanvasShell.tsx");
  assert.doesNotMatch(shell, /addEventListener\("pointermove"/, "the shell adds no pointermove listener of its own");
  assert.doesNotMatch(shell, /setTooltip\(/, "the hover box keeps its own state");
  assert.match(shell, /useIomPointerWash\(canvasBodyRef, iom\)/);

  assert.match(read("lib/canvas-sdk/CanvasGraph.tsx"), /export const CanvasGraph = memo\(/);
  const node = read("lib/canvas-sdk/CanvasGraphNode.tsx");
  assert.match(node, /export const CanvasGraphNode = memo\(/);
  assert.doesNotMatch(read("lib/canvas-sdk/CanvasGraph.tsx"), /node=\{\{ \.\.\.node/, "each bubble gets a stable node object");
});
