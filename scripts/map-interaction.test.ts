// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/map-interaction.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sameTooltipContent, type TooltipContent } from "../lib/canvas-sdk/tooltip-content.ts";
import { INTERACTIVE_SELECTOR, pointInRect } from "../lib/canvas-sdk/iom-cursor-targets.ts";
import { blurredAuraStops, blurredDiskOpacity, blurredDiskStops } from "../lib/canvas-sdk/blurred-disk.ts";

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
  assert.match(wash, /glow\.style\.transform = `translate3d\(/, "the glow follows the pointer with a transform");
  assert.doesNotMatch(wash, /setProperty\("--pointer/, "no gradient variable is rewritten per move");
  assert.match(wash, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(wash, /if \(still\.matches\) return;/, "with reduced motion the glow does not follow the pointer");
  assert.match(wash, /requestAnimationFrame\(paint\)/);
  assert.doesNotMatch(read("lib/canvas-sdk/iom-theme.css"), /var\(--pointer-[xy]\)/, "no gradient follows the pointer through a variable");

  const shell = read("lib/canvas-sdk/CanvasShell.tsx");
  assert.doesNotMatch(shell, /addEventListener\("pointermove"/, "the shell adds no pointermove listener of its own");
  assert.doesNotMatch(shell, /setTooltip\(/, "the hover box keeps its own state");
  assert.match(shell, /useIomPointerWash\(canvasBodyRef, iom\)/);

  assert.match(read("lib/canvas-sdk/CanvasGraph.tsx"), /export const CanvasGraph = memo\(/);
  const node = read("lib/canvas-sdk/CanvasGraphNode.tsx");
  assert.match(node, /export const CanvasGraphNode = memo\(/);
  assert.doesNotMatch(read("lib/canvas-sdk/CanvasGraph.tsx"), /node=\{\{ \.\.\.node/, "each bubble gets a stable node object");
});

/** The declarations of every rule whose selector list includes `selector`. */
function rule(css: string, selector: string) {
  const blocks = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((match) => match[1].split(",").some((part) => part.trim() === selector))
    .map((match) => match[2]);
  assert.ok(blocks.length, `no rule for ${selector}`);
  return blocks.join("\n");
}

test("only the metric widgets blur what is behind them on the map, at a small radius", () => {
  const iom = read("lib/canvas-sdk/iom-theme.css");
  for (const selector of [".hdr-btn", ".canvas-hud-legend", ".user-menu-panel"]) {
    assert.doesNotMatch(rule(iom, `.ifai-canvas.theme-iom ${selector}`), /backdrop-filter:\s*blur/, `${selector} uses a fill, not a blur`);
  }
  assert.match(rule(iom, ".ifai-canvas.theme-iom .view-mode-switch"), /backdrop-filter: none;/);
  assert.match(rule(iom, ".ifai-canvas.theme-iom .canvas-metric-widget"), /backdrop-filter: blur\(8px\);/);
});

test("bubble shadows, glows, and halos are pre-rendered gradients, not blur filters", () => {
  const iom = read("lib/canvas-sdk/iom-theme.css");
  assert.doesNotMatch(iom, /url\(#auraBlur\)/, "the halos fade through their own gradient");
  for (const selector of [".node-circle", ".node-circle.hub-core", ".graph-node.node-selected .node-circle"]) {
    assert.doesNotMatch(rule(iom, `.ifai-canvas.theme-iom ${selector}`), /drop-shadow/, `${selector} has no drop-shadow`);
  }
  assert.doesNotMatch(rule(iom, ".ifai-canvas.theme-iom.light-theme .node-circle"), /drop-shadow/);
  assert.match(rule(iom, ".ifai-canvas.theme-iom .node-drop"), /transform: translateY\(14px\);/);
  assert.match(rule(iom, ".ifai-canvas.theme-iom .graph-node.node-selected .node-glow"), /opacity: 0\.8;/);
  assert.match(read("lib/canvas-sdk/GraphPrimitives.tsx"), /<BubbleLift radius=\{r\} sigma=\{18\}/);
});

test("the pre-rendered shadow traces a blurred circle: solid inside, half at a straight edge, clear at its reach", () => {
  const { reach, stops } = blurredDiskStops(1000, 9);
  assert.equal(reach, 1027);
  assert.ok(stops[0].opacity > 0.99);
  const edge = stops.find((stop) => Math.abs(stop.offset * reach - 1000) < 1e-6);
  assert.ok(edge && Math.abs(edge.opacity - 0.5) < 0.01, "half opacity at the edge of a large circle");
  assert.ok(stops.at(-1)!.opacity < 0.01 && Math.abs(stops.at(-1)!.offset - 1) < 1e-6);
  for (let i = 1; i < stops.length; i += 1) {
    assert.ok(stops[i].offset > stops[i - 1].offset && stops[i].opacity < stops[i - 1].opacity);
  }
  const hubEdge = blurredDiskOpacity(98, 22, 98);
  assert.ok(hubEdge > 0.4 && hubEdge < 0.5, "a small circle's edge is under half, as Chrome blurs it");
});

test("the pre-rendered halo spreads the aura and its colored edge past the circle, as the 10px blur did", () => {
  const plain = blurredAuraStops(154, 10);
  const ringed = blurredAuraStops(154, 10, [46, 183, 255]);
  const at = (stops: typeof plain.stops, d: number) => stops.find((stop) => Math.abs(stop.offset * plain.reach - d) < 1e-6)!;
  assert.equal(plain.reach, 184);
  assert.ok(plain.stops[0].opacity > 0.5 && plain.stops[0].opacity < 0.55, "the bright center softens a little");
  assert.ok(at(plain.stops, 164).opacity > 0.002, "the aura reaches past its circle");
  assert.ok(plain.stops.at(-1)!.opacity < 0.005 && plain.stops.at(-1)!.offset <= 1);
  const edge = at(ringed.stops, 154);
  assert.ok(edge.opacity - at(plain.stops, 154).opacity > 0.03, "the 1px edge stroke adds a faint ring");
  const green = (color: string) => Number(color.split(" ")[1]);
  assert.ok(green(edge.color) - green(at(plain.stops, 154).color) > 40, "the edge leans to the stroke color");
  for (let i = 1; i < plain.stops.length; i += 1) assert.ok(plain.stops[i].offset > plain.stops[i - 1].offset);
  assert.match(read("lib/canvas-sdk/iom-theme.css"), /fill: var\(--aura, url\(#luxHubAura\)\);/);
});

test("the panel opens with a short slide and never animates its width", () => {
  const iom = read("lib/canvas-sdk/iom-theme.css");
  const panel = rule(iom, ".ifai-canvas.theme-iom .drilldown-panel");
  assert.match(panel, /transition: transform calc\(0\.45s \* var\(--iom-motion-scale\)\)/);
  assert.doesNotMatch(panel, /width calc/);
  assert.match(read("lib/canvas-sdk/CanvasShell.tsx"), /if \(columnLayout && windowWidth > 0\) \{/, "the column width applies before the slide");
});
