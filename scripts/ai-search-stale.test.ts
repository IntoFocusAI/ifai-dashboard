// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-stale.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { AI_SEARCH_STALE_AFTER_DAYS, aiSearchStale, selectionEndsOnPublishedRun } from "../lib/ai-search/stale.ts";
import { PARTIAL_TITLE, partialFigureTip } from "../lib/fender-canvas/canvas-reads.ts";

/* FDD X-25, decision 4: a figure gets an asterisk when its data is older than twice its normal
   check schedule. AI Search runs every 2 to 3 days; the longest normal gap is Thursday to
   Sunday, so the figure is stale after 6 days. The number is one constant. */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const DAY = 86_400_000;
const published = "2026-11-08T12:48:01.071Z";
const at = (days: number) => new Date(published).getTime() + days * DAY;

test("the stale limit is one constant, 6 days", () => {
  assert.equal(AI_SEARCH_STALE_AFTER_DAYS, 6);
  const source = read("lib/ai-search/stale.ts");
  assert.equal(source.match(/AI_SEARCH_STALE_AFTER_DAYS = \d+;/g)?.length, 1);
  assert.doesNotMatch(source.replace(/AI_SEARCH_STALE_AFTER_DAYS = \d+;/, ""), /\b6\b(?! days)/, "no second copy of the number");
});

test("a published run is current through day 6 and stale after it", () => {
  const run = { published_at: published, completed_at: published };
  assert.equal(aiSearchStale(run, at(2)), null);
  assert.equal(aiSearchStale(run, at(AI_SEARCH_STALE_AFTER_DAYS)), null);
  const stale = aiSearchStale(run, at(AI_SEARCH_STALE_AFTER_DAYS) + 60_000);
  assert.ok(stale);
  assert.equal(stale.reason, "stale");
  assert.equal(aiSearchStale(null, at(30)), null);
  assert.equal(aiSearchStale({ published_at: null, completed_at: null }, at(30)), null);
  // An unpublished run's completion time is the last check.
  assert.ok(aiSearchStale({ published_at: null, completed_at: published }, at(7)));
});

test("the tooltip names what is missing and the last check in two short lines", () => {
  const stale = aiSearchStale({ published_at: published, completed_at: published }, at(7))!;
  assert.equal(PARTIAL_TITLE.stale, "Older than its check schedule");
  assert.equal(
    partialFigureTip(stale),
    "No AI Search run has been published in 6 days.\nLast check: Nov 8, 2026.",
  );
  assert.doesNotMatch(partialFigureTip(stale), /—|n't\b/);
});

test("only a selection that ends on the published run is marked", () => {
  const id = "0f6b731c";
  assert.equal(selectionEndsOnPublishedRun({ kind: "month" }, id, "2026-11-08"), true);
  assert.equal(selectionEndsOnPublishedRun({ kind: "all" }, id, "2026-11-08"), true);
  assert.equal(selectionEndsOnPublishedRun({ kind: "run", runId: id }, id, "2026-11-08"), true);
  assert.equal(selectionEndsOnPublishedRun({ kind: "run", runId: "older" }, id, "2026-11-08"), false);
  assert.equal(selectionEndsOnPublishedRun({ kind: "range", from: "2026-10-01", to: "2026-11-08" }, id, "2026-11-08"), true);
  assert.equal(selectionEndsOnPublishedRun({ kind: "range", from: "2026-10-01", to: "2026-10-20" }, id, "2026-11-08"), false);
  assert.equal(selectionEndsOnPublishedRun({ kind: "legacy", runId: id }, id, "2026-11-08"), false);
});

test("each tab's lead figure carries the mark, with the shared custom tooltip", () => {
  const dir = "components/v3/live/ai-search";
  for (const file of ["RunSummaryPanel.tsx", "RunDetailsLead.tsx", "FactCheckLead.tsx", "CitationChain.tsx"]) {
    assert.match(read(`${dir}/${file}`), /<AiStaleMark \/>/, file);
  }
  assert.equal(read(`${dir}/FactCheckLead.tsx`).match(/<AiStaleMark \/>/g)?.length, 2, "catalog lead and Accuracy");
  const mark = read(`${dir}/AiStaleMark.tsx`);
  assert.match(mark, /figureTipAttrs\(PARTIAL_TITLE\.stale, partialFigureTip\(stale\), "ai-stale"\)/);
  assert.match(mark, /if \(!run \|\| !mode \|\| source !== "live"\) return null;/, "the labeled sample copy is not marked");
  assert.doesNotMatch(mark, /\stitle=/);
});
