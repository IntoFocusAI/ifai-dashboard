// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-readiness-tab-links.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fenderStaticNodes } from "../components/v3/fender-static-nodes.ts";
import { fenderCommandCenter } from "../components/v3/command-center-data.ts";
import { fenderWidgetMetrics } from "../components/v3/fender-metrics.ts";
import { tabIndexFromSlug, tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";

const SPEC_TABS = ["Findability", "Amazon Specs", "Brand-Site Specs", "Amazon A+ Matrix"];

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const json = (path: string) => JSON.parse(read(path));

/** The substring rule CanvasShell uses to turn a `subTab` into a tab index. */
function resolveSubTab(tabs: string[], subTab: string): number {
  return tabs.findIndex((tab) => tab.toLowerCase().includes(subTab.toLowerCase()));
}

test("the spoke carries Findability plus the renamed tabs and no earlier title", () => {
  const spec = json("data/fender-v3-spec.json");
  assert.deepEqual(spec.spokes.specs.tabs, SPEC_TABS);
  assert.equal(spec.spokes.specs.navLabel, "AI Readiness");
  const serialized = JSON.stringify(spec.spokes.specs.tabs);
  for (const retired of [
    "Catalog Readiness",
    "JSON-LD Audit",
    "Comparison Matrix",
    "AI Readiness",
    "Machine Readability",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(`"${retired}"`, "i"));
  }
});

test("the bubble keeps AI Readiness; satellites match their tabs", () => {
  const byId = new Map(fenderStaticNodes.map((node) => [node.id, node]));
  assert.equal(byId.get("spoke-specs")?.title, "AI Readiness");
  assert.equal(byId.get("spoke-specs")?.subTab, "Brand-Site Specs");
  assert.equal(byId.get("sat-findability")?.title, "Findability");
  assert.equal(byId.get("sat-schema")?.title, "Brand-Site Specs");
  assert.equal(byId.get("sat-tables")?.title, "Amazon A+ Matrix");

  for (const id of ["sat-findability", "sat-schema", "sat-tables"]) {
    const node = byId.get(id);
    assert.ok(node?.subTab, `${id} needs a subTab`);
    const index = resolveSubTab(SPEC_TABS, node.subTab);
    assert.notEqual(index, -1, `${id} subTab "${node.subTab}" matches no tab`);
    assert.equal(SPEC_TABS[index], node.title, `${id} should open the tab with its name`);
  }
  assert.equal(resolveSubTab(SPEC_TABS, byId.get("spoke-specs")!.subTab!), 2);
});

test("every satellite subTab has a camera target", () => {
  const targets = json("data/fender-v3-spokes.json").focusTargets as Record<string, unknown>;
  for (const node of fenderStaticNodes) {
    if (node.spokeId !== "specs" || !node.subTab) continue;
    assert.ok(targets[`specs:${node.subTab}`], `missing focus target for specs:${node.subTab}`);
  }
});

test("every stored deep link into the spoke still resolves to a tab", () => {
  for (const item of fenderCommandCenter.items) {
    if (item.spokeId !== "specs" || !item.subTab) continue;
    assert.notEqual(
      resolveSubTab(SPEC_TABS, item.subTab),
      -1,
      `command center item ${item.id} points at "${item.subTab}"`,
    );
  }

  for (const metric of fenderWidgetMetrics) {
    if (metric.spokeId !== "specs" || !metric.subTab) continue;
    assert.notEqual(
      resolveSubTab(SPEC_TABS, metric.subTab),
      -1,
      `metric widget ${metric.id} points at "${metric.subTab}"`,
    );
  }

  // Panel HTML and React panels deep link with data-ifai-tab.
  const governance = read("components/v3/live/CatalogGovernancePanel.tsx");
  const tabAttr = governance.match(/data-ifai-tab="([^"]+)"/)?.[1];
  assert.equal(tabAttr, "Amazon Specs");
  assert.equal(resolveSubTab(SPEC_TABS, tabAttr!), 1);
});

test("a URL copied from an earlier tab title opens the renamed tab", () => {
  const copied: Array<[string, string]> = [
    ["catalog-readiness-executive-guide", "Amazon Specs"],
    ["ai-readiness", "Amazon Specs"],
    ["machine-readable-schema-org-json-ld-audit", "Brand-Site Specs"],
    ["machine-readability", "Brand-Site Specs"],
    ["amazon-a-comparison-matrix-blueprint", "Amazon A+ Matrix"],
  ];
  for (const [slug, tab] of copied) {
    assert.equal(SPEC_TABS[tabIndexFromSlug(SPEC_TABS, slug)], tab, slug);
  }
  // "schema" alone no longer names a tab, so nothing may still link by it.
  assert.equal(resolveSubTab(SPEC_TABS, "schema"), -1);
  assert.equal(resolveSubTab(SPEC_TABS, "a+"), 3);
  assert.equal(tabSlug(SPEC_TABS[0]), "findability");
  assert.equal(tabSlug(SPEC_TABS[1]), "amazon-specs");
  assert.equal(tabSlug(SPEC_TABS[2]), "brand-site-specs");
});
