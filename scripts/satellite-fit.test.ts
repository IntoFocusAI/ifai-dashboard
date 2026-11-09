// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/satellite-fit.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { HUB_LAYOUT, fenderCanvasEdges, primarySpokeLayouts, satelliteNode, type SatelliteId } from "../lib/fender-canvas/primary-spoke-layout.ts";
import {
  SATELLITE_HERO_TEXT,
  fitMainHero,
  isCompactHeroValue,
  satelliteHeroLayout,
} from "../lib/canvas-sdk/hero-fit.ts";
import { hoverSlide } from "../lib/canvas-sdk/hover-frame.ts";
import { fittedSatelliteClusters, groupBounds } from "../lib/canvas-sdk/satellite-fit.ts";
import type { CanvasNode, CanvasSpec } from "../lib/canvas-sdk/types.ts";

const HEROES: Record<SatelliteId, { title: string; value: string; label: string }> = {
  "sat-prompts": { title: "Run Details", value: "95.7%", label: "Brand Consideration" },
  "sat-citations": { title: "Citations", value: "19.1%", label: "Fender-Owned Links" },
  "sat-drift": { title: "Fact Checks", value: "100.0%", label: "Accuracy" },
  "sat-buybox": { title: "Suppressed Listings", value: "12.4%", label: "confirmed high-price" },
  "sat-asin": { title: "Catalog Governance", value: "38.0%", label: "Splintered listings" },
  "sat-map": { title: "MAP Leakage", value: "22.5%", label: "MAP leakage" },
  "sat-findability": { title: "Findability", value: "12.4%", label: "exact official product page" },
  "sat-schema": { title: "Brand-Site Specs", value: "100.0%", label: "missing machine-readable specs" },
  "sat-tables": { title: "Amazon A+ Matrix", value: "Not measured", label: "Comparison tables" },
  "sat-taylor": { title: "Competitor Wins", value: "38 of 84", label: "competitors led" },
  "sat-amps": { title: "Engine Comparison", value: "42.1%", label: "ChatGPT unbranded" },
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
  const layout = satelliteHeroLayout("Run Details", "No resolved answers", "Brand Consideration");
  assert.ok(layout.rows.every((row) => row.kind !== "value"));
  assert.ok(layout.radius < 90);
});

test("main-bubble heroes fit inside a fixed ring with readable size", () => {
  assert.equal(isCompactHeroValue("61.2%"), true);
  assert.equal(isCompactHeroValue("90 Days"), true);
  assert.equal(isCompactHeroValue("Loading run"), false);

  const aeo = primarySpokeLayouts().find((spoke) => spoke.id === "spoke-aeo")!;
  // Icon + two-line title leave the hero stack starting near the center.
  const startY = 4 + 2 * 23 + 5;
  const fit = fitMainHero("61.2%", "Unbranded SOV", aeo.r, startY);
  assert.ok(fit.valueSize >= 16, `value shrunk to a crumb (${fit.valueSize})`);
  assert.ok(fit.valueSize <= aeo.r * 0.4, `value still too large for the ring (${fit.valueSize})`);
  assert.ok(fit.labelY + fit.labelLineH <= aeo.r - 8, "label spills past the ring");
  assert.deepEqual(fit.labelLines, ["Unbranded SOV"]);

  const worded = fitMainHero("Loading run", "", aeo.r, startY);
  assert.equal(worded.worded, true);
  assert.ok(worded.valueSize <= 16);
});

test("a status mark stacks under the label when it fits and shares the value line when it does not", () => {
  const roomy = fitMainHero("4.9%", "Buy Box withheld", 100, 30, "bad");
  assert.equal(roomy.valueX, 0);
  assert.equal(roomy.statusX, 0);
  assert.ok(roomy.statusY > roomy.labelY, "status sits under the label");
  assert.ok(roomy.statusY + roomy.statusSize * 0.3 <= 100 - 14, "status clears the ring");

  const tight = fitMainHero("66.4%", "Unbranded SOV", 88, 44, "good");
  assert.equal(tight.statusY, tight.valueY, "status moves onto the value line");
  assert.ok(tight.valueX < 0 && tight.statusX > 0, "value and status share the line side by side");

  const none = fitMainHero("66.4%", "Unbranded SOV", 88, 44, null);
  assert.equal(none.valueX, 0);
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
