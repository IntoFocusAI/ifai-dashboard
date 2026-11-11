import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCanvasSearchParams, tabIndexFromSlug, tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";

const hubTabs = [
  "Briefing",
  "Performance",
  "Opportunity",
];

const aiTabs = ["Run Summary", "Run Details", "Product Fact Checks", "Citation Ecosystem"];

const specTabs = ["Findability", "Amazon Specs", "Brand-Site Specs", "Amazon A+ Matrix"];

test("the renamed executive briefing keeps the earlier Buy Box tab slug", () => {
  assert.equal(tabSlug(hubTabs[0]), "briefing");
  assert.equal(tabSlug("Executive Briefing & Buy Box Coverage"), "executive-briefing-buy-box-coverage");
  assert.equal(tabSlug("Executive Briefing"), "executive-briefing");
  assert.equal(tabIndexFromSlug(hubTabs, "executive-briefing"), 0);
  assert.equal(tabIndexFromSlug(hubTabs, "executive-briefing-buy-box-coverage"), 0);
  assert.equal(hubTabs[0], "Briefing");
  assert.doesNotMatch(hubTabs[0], /buy box/i);
});

test("hub tab aliases open Briefing, Performance, and Opportunity", () => {
  assert.deepEqual(hubTabs.map(tabSlug), ["briefing", "performance", "opportunity"]);

  assert.equal(tabIndexFromSlug(hubTabs, "briefing"), 0);
  assert.equal(tabIndexFromSlug(hubTabs, "performance"), 1);
  assert.equal(tabIndexFromSlug(hubTabs, "opportunity"), 2);

  assert.equal(
    tabIndexFromSlug(hubTabs, "commercial-sizing-680k-pilot-vs-38m-to-62m-enterprise"),
    2,
  );

  // Old Division Performance titles included a live SKU count in the slug.
  assert.equal(tabIndexFromSlug(hubTabs, "division-performance"), 1);
  assert.equal(tabIndexFromSlug(hubTabs, "division-performance-3-598-skus"), 1);
  assert.equal(tabIndexFromSlug(hubTabs, "division-performance-3598-skus"), 1);

  // Prefix rule stays narrow: unrelated tabs are unchanged.
  assert.equal(tabIndexFromSlug(aiTabs, "division-performance-3-598-skus"), 0);
  assert.equal(tabIndexFromSlug(aiTabs, "run-details"), 1);
});

test("AI Search Simulations aliases open Run Details", () => {
  assert.equal(tabSlug(aiTabs[1]), "run-details");
  assert.equal(tabIndexFromSlug(aiTabs, "run-details"), 1);
  assert.equal(tabIndexFromSlug(aiTabs, "simulations"), 1);
  assert.equal(tabIndexFromSlug(aiTabs, "100-ai-simulations-interactive-explorer"), 1);
  assert.equal(tabIndexFromSlug(aiTabs, "run-summary"), 0);
});

test("the renamed Amazon Specs and Brand-Site Specs tabs keep earlier slugs", () => {
  assert.deepEqual(specTabs.map(tabSlug), [
    "findability",
    "amazon-specs",
    "brand-site-specs",
    "amazon-a-matrix",
  ]);

  const copied: Array<[string, number]> = [
    ["catalog-readiness-executive-guide", 1],
    ["ai-readiness", 1],
    ["machine-readable-schema-org-json-ld-audit", 2],
    ["machine-readability", 2],
    ["amazon-a-comparison-matrix-blueprint", 3],
  ];
  for (const [slug, index] of copied) {
    assert.equal(tabIndexFromSlug(specTabs, slug), index, slug);
  }

  // The current slugs resolve too, and an unrelated slug still falls back to the first tab.
  for (const [index, tab] of specTabs.entries()) {
    assert.equal(tabIndexFromSlug(specTabs, tabSlug(tab)), index);
  }
  assert.equal(tabIndexFromSlug(specTabs, "not-a-tab"), 0);
});

test("canvas navigation keeps the AI Search fixture query", () => {
  const built = buildCanvasSearchParams(
    {
      spokeId: "aeo",
      tabSlug: "run-summary",
      priorities: false,
      panelLayout: "wide",
      tourStep: null,
      tourPaused: false,
      menuOpen: false,
      profileOpen: false,
    },
    new URLSearchParams("ai-history=fixture&spoke=aeo"),
  );
  assert.equal(built.get("ai-history"), "fixture");
  assert.equal(built.get("spoke"), "aeo");
});
