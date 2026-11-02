import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { schemaPageHref } from "../lib/fender-canvas/spec-table-sort.ts";
import { specFenderFoundLabel, specModelTitle } from "../lib/fender-canvas/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("the model cell shows the stored title", () => {
  assert.equal(specModelTitle("Player II Stratocaster"), "Player II Stratocaster");
  assert.equal(specModelTitle("  American Ultra  "), "American Ultra");
  assert.equal(specModelTitle(null), "");
  assert.equal(specModelTitle(undefined), "");
  assert.equal(specModelTitle("   "), "");
});

test("fender.com found follows the stored flag", () => {
  assert.equal(specFenderFoundLabel(true), "Yes");
  assert.equal(specFenderFoundLabel(false), "No");
  assert.equal(specFenderFoundLabel(null), "");
  assert.equal(specFenderFoundLabel(undefined), "");
});

test("yes rows equal the true flags, and a null flag stays blank", () => {
  const flags: Array<boolean | null> = [true, false, null, true, false];
  const labels = flags.map((flag) => specFenderFoundLabel(flag));
  const yes = labels.filter((label) => label === "Yes").length;
  const found = flags.filter((flag) => flag === true).length;
  assert.equal(yes, found);
  assert.equal(labels.filter((label) => label === "").length, 1);
  assert.notEqual(labels.every((label) => label === "No"), true);
});

test("Yes with an http(s) URL can link; No, blank, and Yes without a URL stay plain", () => {
  assert.equal(schemaPageHref("https://www.fender.com/en-US/found"), "https://www.fender.com/en-US/found");
  assert.equal(schemaPageHref("http://www.fender.com/en-US/found"), "http://www.fender.com/en-US/found");
  assert.equal(schemaPageHref("not a url"), null);
  assert.equal(schemaPageHref(null), null);
  assert.equal(schemaPageHref(""), null);

  // Amazon Specs keeps Amazon fields only; fender.com found lives on Brand-Site Specs / Findability.
  const panel = read("components/v3/live/FenderSpecPanel.tsx");
  assert.doesNotMatch(panel, /function FenderFoundCell/);
  assert.doesNotMatch(panel, /schemaPageHref/);
  assert.doesNotMatch(panel, /fender\.com found/);
  assert.match(panel, /SPEC_TABLE_MAX_HEIGHT = 420/);
  assert.match(panel, /fillColumnId="missing"/);
  assert.match(panel, /wrapColumnIds=\{\["model"\]\}/);
  assert.doesNotMatch(panel, /maxHeight=\{520\}/);
  // Page size stays the shared client page size, not a second population.
  assert.match(panel, /CLIENT_TABLE_PAGE_SIZE/);
  assert.match(panel, /data-spec-missing-fields-toggle/);
  assert.match(panel, /retail-explore-chevron/);
  assert.match(panel, /presentMissingFieldShare/);
  assert.doesNotMatch(panel, /Show all \$\{formatInt\(missing\.length\)\} fields/);
  assert.doesNotMatch(panel, /Show fewer fields/);
});
