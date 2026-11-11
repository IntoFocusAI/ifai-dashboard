// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/primary-spoke-layout.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { fenderStaticNodes } from "../components/v3/fender-static-nodes.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import {
  HUB_LAYOUT,
  SATELLITE_LAYOUT,
  fenderCanvasEdges,
  layoutOuterExtent,
  primarySpoke,
  primarySpokeLayouts,
  primarySpokeSeeds,
  seedOuterExtent,
  withPrimaryFocusTargets,
} from "../lib/fender-canvas/primary-spoke-layout.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

function gap(
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
}

test("primary spokes grow inward and keep their outer edge", () => {
  const seeds = new Map(primarySpokeSeeds().map((seed) => [seed.id, seed]));
  for (const spoke of primarySpokeLayouts()) {
    const seed = seeds.get(spoke.id);
    assert.ok(seed, spoke.id);
    const ratio = spoke.r / seed.r;
    assert.ok(ratio >= 1.45 && ratio <= 1.5, `${spoke.id} grew by ${ratio}`);

    const oldDistance = Math.hypot(seed.x - HUB_LAYOUT.x, seed.y - HUB_LAYOUT.y);
    const newDistance = Math.hypot(spoke.x - HUB_LAYOUT.x, spoke.y - HUB_LAYOUT.y);
    assert.ok(newDistance < oldDistance, `${spoke.id} should move toward the hub`);
    assert.ok(
      Math.abs(oldDistance - newDistance - (spoke.r - seed.r)) < 1.5,
      `${spoke.id} should move inward by about the radius growth`,
    );
    assert.ok(
      Math.abs(layoutOuterExtent(spoke) - seedOuterExtent(spoke.id)) < 1.5,
      `${spoke.id} outer edge moved`,
    );
    assert.equal(spoke.faceRadius, seed.r);
    assert.ok(spoke.titleSize > spoke.railTitleSize);
  }
});

test("primary circles do not overlap the hub, each other, or satellites", () => {
  const spokes = primarySpokeLayouts();
  for (const spoke of spokes) {
    assert.ok(gap(spoke, HUB_LAYOUT) >= 12, `${spoke.id} overlaps the hub`);
  }
  for (let i = 0; i < spokes.length; i += 1) {
    for (let j = i + 1; j < spokes.length; j += 1) {
      assert.ok(gap(spokes[i], spokes[j]) >= 12, `${spokes[i].id} overlaps ${spokes[j].id}`);
    }
  }
  for (const spoke of spokes) {
    for (const [id, satellite] of Object.entries(SATELLITE_LAYOUT)) {
      assert.ok(gap(spoke, satellite) >= 12, `${spoke.id} overlaps ${id}`);
    }
  }
});

test("the map uses the grown spokes and leaves satellites and the hub alone", () => {
  const staticById = new Map(fenderStaticNodes.map((node) => [node.id, node]));
  const hub = staticById.get("hub");
  assert.equal(hub?.r, HUB_LAYOUT.r);
  assert.equal(hub?.x, HUB_LAYOUT.x);
  assert.equal(hub?.y, HUB_LAYOUT.y);

  for (const spoke of primarySpokeLayouts()) {
    const node = staticById.get(spoke.id);
    assert.equal(node?.x, spoke.x);
    assert.equal(node?.y, spoke.y);
    assert.equal(node?.r, spoke.r);
    assert.equal(node?.faceRadius, spoke.faceRadius);
    assert.equal(node?.titleSize, spoke.titleSize);
    assert.equal(node?.railTitleSize, spoke.railTitleSize);
  }

  for (const [id, satellite] of Object.entries(SATELLITE_LAYOUT)) {
    const node = staticById.get(id);
    assert.equal(node?.x, satellite.x, id);
    assert.equal(node?.y, satellite.y, id);
    assert.equal(node?.r, satellite.r, id);
    assert.equal(node?.faceRadius, undefined, id);
  }

  const live = buildLiveNodes(
    { m: {}, divisions: [], cats: [], engines: [], sov: [], missing: [], fresh: [] } as CanvasBundle,
    buildLiveMetrics({ m: {}, divisions: [], cats: [], engines: [], sov: [], missing: [], fresh: [] } as CanvasBundle),
  );
  for (const spoke of primarySpokeLayouts()) {
    const node = live.find((entry) => entry.id === spoke.id);
    assert.equal(node?.r, spoke.r);
    assert.equal(node?.faceRadius, spoke.faceRadius);
    assert.equal(node?.x, spoke.x);
    assert.equal(node?.y, spoke.y);
  }
  const suppressed = live.find((node) => node.id === "sat-buybox");
  assert.equal(suppressed?.r, SATELLITE_LAYOUT["sat-buybox"].r);
  assert.equal(suppressed?.title, "Suppressed Listings");
  const mapSatellite = live.find((node) => node.id === "sat-map");
  assert.equal(mapSatellite?.title, "MAP Leakage");
  assert.equal(mapSatellite?.r, SATELLITE_LAYOUT["sat-map"].r);
});

test("Roadmap has no retail metadata line", () => {
  const staticRoadmap = fenderStaticNodes.find((node) => node.id === "spoke-roadmap");
  assert.ok(staticRoadmap);
  assert.equal(Object.hasOwn(staticRoadmap, "meta"), false);
  assert.equal(staticRoadmap.meta, undefined);
  assert.deepEqual(staticRoadmap.stats, []);
  assert.deepEqual(staticRoadmap.heroValue, { value: "30-60-90", label: "" });
  assert.equal(staticRoadmap.title, "Roadmap");
  assert.equal(staticRoadmap.tooltip?.desc, "");

  const bundle = { m: {}, divisions: [], cats: [], engines: [], sov: [], missing: [], fresh: [] } as CanvasBundle;
  const liveRoadmap = buildLiveNodes(bundle, buildLiveMetrics(bundle)).find((node) => node.id === "spoke-roadmap");
  assert.ok(liveRoadmap);
  assert.equal(Object.hasOwn(liveRoadmap, "meta"), false);
  assert.equal(liveRoadmap.meta, undefined);
  assert.deepEqual(liveRoadmap.stats, []);
  assert.deepEqual(liveRoadmap.heroValue, { value: "30-60-90", label: "" });
  assert.equal(liveRoadmap.status, "neutral");
  assert.equal(liveRoadmap.spokeId, "roadmap");
  assert.equal(liveRoadmap.tooltip?.desc, "");

  const specs = fenderStaticNodes.find((node) => node.id === "spoke-specs");
  assert.deepEqual(specs?.stats, []);
  assert.deepEqual(specs?.heroValue, { value: "Pending data", label: "Page found" });
});

test("connectors and camera targets land on the new spoke centers", () => {
  const centers = new Set(fenderStaticNodes.map((node) => `${node.x},${node.y}`));
  for (const edge of fenderCanvasEdges()) {
    assert.ok(centers.has(`${edge.x1},${edge.y1}`), `${edge.x1},${edge.y1}`);
    assert.ok(centers.has(`${edge.x2},${edge.y2}`), `${edge.x2},${edge.y2}`);
  }
  const active = fenderCanvasEdges().find((edge) => edge.kind === "active");
  const roadmap = primarySpoke("spoke-roadmap");
  assert.equal(active?.x2, roadmap.x);
  assert.equal(active?.y2, roadmap.y);

  const targets = withPrimaryFocusTargets({
    aeo: { x: 1, y: 1 },
    "aeo:simulations": { x: 240, y: 200 },
    ecommerce: { x: 1, y: 1 },
    suggestions: { x: 1, y: 1 },
  });
  assert.deepEqual(targets.aeo, { x: primarySpoke("spoke-aeo").x, y: primarySpoke("spoke-aeo").y });
  assert.deepEqual(targets["aeo:simulations"], { x: 240, y: 200 });
  assert.deepEqual(targets.ecommerce, {
    x: primarySpoke("spoke-retail").x,
    y: primarySpoke("spoke-retail").y,
  });
  assert.notDeepEqual(targets.suggestions, { x: 1, y: 1 });
});
