// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/satellite-fit.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { HUB_LAYOUT, fenderCanvasEdges, primarySpokeLayouts, satelliteNode, type SatelliteId } from "../lib/fender-canvas/primary-spoke-layout.ts";
import {
  BUBBLE_TEXT_MIN,
  SATELLITE_HERO_TEXT,
  bubbleTextMin,
  fitMainHero,
  isCompactHeroValue,
  satelliteHeroLayout,
} from "../lib/canvas-sdk/hero-fit.ts";
import { hoverSlide } from "../lib/canvas-sdk/hover-frame.ts";
import { fittedSatelliteClusters, groupBounds } from "../lib/canvas-sdk/satellite-fit.ts";
import type { CanvasNode, CanvasSpec } from "../lib/canvas-sdk/types.ts";

const HEROES: Record<SatelliteId, { title: string; value: string; label: string }> = {
  "sat-prompts": { title: "Run Details", value: "95.7%", label: "Branded Consideration" },
  "sat-citations": { title: "Citations", value: "19.1%", label: "Fender-Owned Links" },
  "sat-drift": { title: "Fact Checks", value: "100.0%", label: "Accuracy" },
  "sat-buybox": { title: "Suppressed Listings", value: "12.4%", label: "confirmed high-price" },
  "sat-asin": { title: "Catalog Governance", value: "38.0%", label: "Splintered Listings" },
  "sat-map": { title: "MAP Leakage", value: "22.5%", label: "" },
  "sat-findability": { title: "Findability", value: "12.4%*", label: "Exact page" },
  "sat-schema": { title: "Brand-Site Specs", value: "100.0%", label: "Specs missing" },
  "sat-tables": { title: "Amazon A+ Matrix", value: "74.4%", label: "Five bullets" },
  "sat-taylor": { title: "Competitor Wins", value: "39.3%", label: "" },
  "sat-amps": { title: "Engine Comparison", value: "42.1%", label: "ChatGPT API" },
};

const SATELLITES: SatelliteId[] = [
  "sat-prompts", "sat-citations", "sat-drift", "sat-buybox", "sat-asin", "sat-map",
  "sat-findability", "sat-schema", "sat-tables", "sat-taylor", "sat-amps",
];

function node(id: string, x: number, y: number, r: number, extra: Partial<CanvasNode> = {}): CanvasNode {
  return { id, x, y, r, status: "neutral", title: id, stats: [], tooltip: { title: "", desc: "" }, ...extra } as CanvasNode;
}

function spec(): CanvasSpec {
  const nodes: CanvasNode[] = [
    node("hub", HUB_LAYOUT.x, HUB_LAYOUT.y, HUB_LAYOUT.r, { variant: "hub" }),
    ...primarySpokeLayouts().map((spoke) => node(spoke.id, spoke.x, spoke.y, spoke.r)),
    ...SATELLITES.map((id) => {
      const s = satelliteNode(id);
      const hero = HEROES[id];
      return node(id, s.x, s.y, s.r, {
        title: hero.title,
        heroValue: { value: hero.value, label: hero.label },
      });
    }),
  ];
  return { nodes, edges: fenderCanvasEdges() } as unknown as CanvasSpec;
}

test("hero text stays at its readable size and the ring clears every row", () => {
  for (const hero of Object.values(HEROES)) {
    const layout = satelliteHeroLayout(hero.title, hero.value, hero.label);
    const value = layout.rows.find((row) => row.kind === "value");
    if (/\s/.test(hero.value.trim())) {
      assert.ok(layout.rows.every((row) => row.kind !== "value"), `${hero.title} worded value`);
    } else {
      assert.equal(value?.size, SATELLITE_HERO_TEXT.value);
    }
    for (const row of layout.rows.filter((item) => item.kind === "label")) assert.equal(row.size, SATELLITE_HERO_TEXT.label);
    assert.ok(layout.radius > 48, `${hero.title} needs room for its hero face`);
  }
});

test("a worded empty value reads at label size, not as a giant number", () => {
  const layout = satelliteHeroLayout("Run Details", "No resolved answers", "Branded Consideration");
  assert.ok(layout.rows.every((row) => row.kind !== "value"));
  assert.ok(layout.radius < 90);
});

test("main-bubble heroes fit inside a fixed ring with readable size", () => {
  assert.equal(isCompactHeroValue("61.2%"), true);
  assert.equal(isCompactHeroValue("90 Days"), true);
  assert.equal(isCompactHeroValue("Loading run"), false);

  const aeo = primarySpokeLayouts().find((spoke) => spoke.id === "spoke-aeo")!;
  // The lifted icon and two-line title leave the hero stack starting just under the center.
  const startY = -aeo.r * 0.56 + 20 + 15 + 2 * 23 + 5;
  const fit = fitMainHero("61.2%", "Unbranded Discovery", aeo.r, startY);
  assert.ok(fit.valueSize >= 24, `value shrunk to a crumb (${fit.valueSize})`);
  assert.ok(fit.valueSize <= aeo.r * 0.4, `value still too large for the ring (${fit.valueSize})`);
  assert.ok(fit.labelY + fit.labelLineH * (fit.labelLines.length - 1) <= aeo.r - 8, "label spills past the ring");
  assert.equal(fit.labelSize, BUBBLE_TEXT_MIN);

  const worded = fitMainHero("Loading run", "", aeo.r, startY);
  assert.equal(worded.worded, true);
  assert.equal(worded.valueSize, BUBBLE_TEXT_MIN);
});

test("bubble text renders at 11px or more at 1280x720, on the map and on the rail", () => {
  // The map draws at 0.72 at 1280x720, the rail at 240 / 330; the floor is set a little under both.
  assert.ok(BUBBLE_TEXT_MIN * 0.72 >= 11, `${BUBBLE_TEXT_MIN} units render under 11px on the map`);
  assert.ok(SATELLITE_HERO_TEXT.title * 0.72 >= 11 && SATELLITE_HERO_TEXT.label * 0.72 >= 11);
  for (const spoke of primarySpokeLayouts()) {
    // The rail lays a face out at its pre-growth radius and scales it to the 100-unit rail bubble.
    const faceScale = 100 / spoke.faceRadius;
    const min = bubbleTextMin(faceScale);
    assert.ok(min * faceScale * (240 / 330) >= 11, `${spoke.id} rail text renders at ${(min * faceScale * (240 / 330)).toFixed(2)}px`);
    const fit = fitMainHero("44.6%", "Taylor leads Acoustics", spoke.faceRadius, 20, min);
    assert.ok(fit.labelSize >= min && fit.valueSize >= min, `${spoke.id} rail hero under the floor`);
  }
});

test("grown satellites clear their parent, each other, and every other bubble", () => {
  const { groups } = fittedSatelliteClusters(spec());
  const circles = [
    ...spec().nodes!.filter((item) => !SATELLITES.includes(item.id as SatelliteId)),
    ...groups.flatMap((group) => group.nodes),
  ];
  for (let i = 0; i < circles.length; i += 1) {
    for (let j = i + 1; j < circles.length; j += 1) {
      const a = circles[i];
      const b = circles[j];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
      assert.ok(gap >= 12, `${a.id} and ${b.id} are ${gap.toFixed(1)} apart`);
    }
  }
  for (const group of groups) {
    for (const sat of group.nodes) {
      const hero = HEROES[sat.id as SatelliteId];
      assert.equal(sat.r, satelliteHeroLayout(hero.title, hero.value, hero.label).radius);
    }
    assert.deepEqual(
      group.edges.map((edge) => [edge.x2, edge.y2]),
      group.nodes.map((sat) => [sat.x, sat.y]),
    );
  }
});

test("every satellite cluster grows to fit its hero face", () => {
  const { groups } = fittedSatelliteClusters(spec());
  assert.equal(groups.length, 4);
  for (const group of groups) {
    for (const sat of group.nodes) {
      const stored = satelliteNode(sat.id as SatelliteId);
      const hero = HEROES[sat.id as SatelliteId];
      const need = satelliteHeroLayout(hero.title, hero.value, hero.label).radius;
      assert.ok(sat.r >= stored.r);
      assert.equal(sat.r, Math.max(stored.r, need));
    }
  }
});

test("the framing box holds the bubble and its satellites", () => {
  const { groups } = fittedSatelliteClusters(spec());
  const parent = spec().nodes!.find((item) => item.id === "spoke-aeo")!;
  const box = groupBounds(groups, parent, 0);
  for (const sat of groups.find((group) => group.parent.id === "spoke-aeo")!.nodes) {
    assert.ok(sat.x - sat.r >= box.minX && sat.x + sat.r <= box.maxX);
    assert.ok(sat.y - sat.r >= box.minY && sat.y + sat.r <= box.maxY);
  }
});

test("the hover slide clears the slots without pushing other bubbles under them", () => {
  const room = { left: 302, top: 64, right: 1175, bottom: 640 };
  const mains = { minX: 300, minY: 70, maxX: 900, maxY: 630 };
  const left = hoverSlide({ minX: 134, minY: 120, maxX: 520, maxY: 440 }, mains, room);
  assert.ok(left.dx >= 302 + 16 - 134, "the left group clears the slots");
  assert.ok(left.dx <= 1175 - 16 - 900, "the right-hand bubbles stay on screen");
  assert.equal(left.dy, 0);
  const right = hoverSlide({ minX: 640, minY: 150, maxX: 1060, maxY: 520 }, mains, room);
  assert.ok(right.dx >= 302 + 16 - 300, "a right-hand group does not slide the left bubbles under the slots");
  assert.ok(right.dx <= 18);
  const hub = hoverSlide({ minX: 520, minY: 250, maxX: 700, maxY: 450 }, mains, room);
  assert.equal(hub.dx, Math.round((302 + 1175) / 2 - 610));
});
