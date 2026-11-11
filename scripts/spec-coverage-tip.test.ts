// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/spec-coverage-tip.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { amazonSpecGapsFinding, type PortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";
import { specHero } from "../lib/fender-canvas/retail-overview-lead.ts";

const root = new URL("..", import.meta.url).pathname;
const panel = readFileSync(join(root, "components/v3/live/CatalogGovernancePanel.tsx"), "utf8");

function snapshotWith(rows: Parameters<typeof amazonSpecGapsFinding>[0]): PortfolioRetailSnapshot {
  return { amazonSpecGaps: amazonSpecGapsFinding(rows) } as PortfolioRetailSnapshot;
}

const checked = (asin: string, missing: string | null) => ({ asin, title: asin, amazon_checked: true, amazon_missing_fields: missing });
const unchecked = (asin: string) => ({ asin, title: asin, amazon_checked: false, amazon_missing_fields: null });

test("the unchecked-listings caveat rides in the spec figure's tooltip", () => {
  const hero = specHero(snapshotWith([checked("B1", "color"), checked("B2", null), checked("B3", null), unchecked("B4")]));
  assert.equal(hero.ratio, "2 of 3");
  assert.match(hero.tip ?? "", /^1 of 3 checked listings are missing an Amazon spec field\./);
  assert.match(hero.tip ?? "", /1 listing was not checked\. Unchecked listings are missing from this count and are not counted as zero\./);
  assert.doesNotMatch(hero.ratio ?? "", /\*/);
  assert.doesNotMatch(hero.explainer, /not checked|not counted/);
});

test("a fully checked read keeps the tooltip to the count", () => {
  const hero = specHero(snapshotWith([checked("B1", "color"), checked("B2", null)]));
  assert.equal(hero.tip, "1 of 2 checked listings are missing an Amazon spec field.");
});

test("Catalog Governance notes print only a missing reading, and the spec ratio carries the tooltip", () => {
  assert.match(panel, /const showMissing = specs\.status === "unavailable" && Boolean\(specs\.missingMessage\);/);
  assert.doesNotMatch(panel, /specs\.status === "incomplete"/);
  assert.match(panel, /figureTipAttrs\(SPECS_COMPLETE_LABEL, hero\.tip, "spec-coverage"\)/);
});
