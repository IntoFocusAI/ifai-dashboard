// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/data-source-freshness.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";
import { dataAsOf, dataSourceFreshness, dataSourceLine, sourceForJob } from "../lib/fender-canvas/data-source-freshness.ts";
import { parseTooltipRows, sameTooltipContent } from "../lib/canvas-sdk/tooltip-content.ts";

const NOW = Date.parse("2026-11-16T15:00:00Z");

// canvas_freshness as both clients read it on 16 Nov 2026 (a subset of the lock rows).
const FENDER = [
  { job_key: "ai_battery_config", last_run_at: null },
  { job_key: "ai_probe_rotation", last_run_at: "2026-11-15T06:01:44Z" },
  { job_key: "ai_sim_conflict_rerun", last_run_at: "2026-10-05T16:01:26Z" },
  { job_key: "ai_simulations", last_run_at: "2026-11-16T12:04:30Z" },
  { job_key: "buybox_seller_harvester", last_run_at: "2026-11-16T13:01:07Z" },
  { job_key: "catalog_harvester", last_run_at: "2026-11-16T13:01:38Z" },
  { job_key: "claude_drift_check", last_run_at: "2026-11-16T12:03:34Z" },
  { job_key: "featured_offer_keepa", last_run_at: "2026-11-16T13:41:19Z" },
  { job_key: "findability_recheck", last_run_at: "2026-11-16T06:17:13Z" },
  { job_key: "keepa_history", last_run_at: "2026-11-16T10:41:10Z" },
  { job_key: "kpi_recompute", last_run_at: "2026-11-16T13:41:16Z" },
  { job_key: "map_leakage_walmart", last_run_at: "2026-11-16T13:55:27Z" },
  { job_key: "map_parity_musiciansfriend", last_run_at: "2026-11-15T23:35:32Z" },
  { job_key: "mirror_drift_check", last_run_at: "2026-11-16T12:45:49Z" },
  { job_key: "sandbox_drift_check", last_run_at: "2026-11-16T12:23:36Z" },
  { job_key: "smartscout_snapshot", last_run_at: "2026-11-09T08:02:50Z" },
  { job_key: "spec_readiness", last_run_at: "2026-11-16T14:02:53Z" },
  { job_key: "subchat_lock_fe3ada9e_claude_api", last_run_at: "2026-10-27T23:56:15Z" },
];

const LEDLENSER = [
  { job_key: "ai_probe_rotation", last_run_at: "2026-11-16T08:00:22Z" },
  { job_key: "ai_simulations", last_run_at: "2026-11-14T03:00:20Z" },
  { job_key: "buybox_seller_harvester", last_run_at: "2026-11-15T15:15:23Z" },
  { job_key: "catalog_harvester", last_run_at: "2026-11-15T15:01:47Z" },
  { job_key: "featured_offer_keepa", last_run_at: "2026-11-16T09:30:09Z" },
  { job_key: "keepa_history", last_run_at: "2026-11-16T13:10:07Z" },
  { job_key: "kpi_recompute", last_run_at: "2026-11-16T09:30:09Z" },
  { job_key: "map_leakage_walmart", last_run_at: "2026-11-16T10:20:32Z" },
  { job_key: "schedule_probe", last_run_at: "2026-11-04T19:41:47Z" },
  { job_key: "smartscout_snapshot", last_run_at: "2026-11-10T16:30:27Z" },
  { job_key: "spec_readiness", last_run_at: "2026-11-16T12:41:59Z" },
  { job_key: "subchat_lock_170f2790_all", last_run_at: "2026-11-16T11:17:14Z" },
];

afterEach(() => resetActiveClientForTests(null));

test("every live job maps to a source a client recognizes; unknown keys go to the closest one", () => {
  const sources = new Set(["ai", "amazon_offers", "walmart", "musiciansfriend", "amazon_specs", "amazon_sales", "brand_site"]);
  for (const row of [...FENDER, ...LEDLENSER]) assert.ok(sources.has(sourceForJob(row.job_key)), row.job_key);
  assert.equal(sourceForJob("subchat_lock_fe3ada9e_claude_api"), "ai");
  assert.equal(sourceForJob("mirror_drift_check"), "ai");
  assert.equal(sourceForJob("kpi_recompute"), "amazon_offers");
  assert.equal(sourceForJob("walmart_price_refresh"), "walmart");
  assert.equal(sourceForJob("aplus_content_check"), "amazon_specs");
  assert.equal(sourceForJob("something_new"), "amazon_offers");
});

test("Fender lists seven sources in plain words, with no raw key and only true staleness", () => {
  resetActiveClientForTests("fender");
  const sources = dataSourceFreshness(FENDER, NOW);
  assert.deepEqual(
    sources.map((source) => source.label),
    ["AI answers", "Amazon prices and Buy Box", "Walmart", "Musician's Friend", "Amazon specs and A+", "Amazon sales estimates", "fender.com pages"],
  );
  // The October conflict rerun and the old API lock do not make AI answers out of date: the run is today.
  assert.equal(sources.find((source) => source.id === "ai")!.lastCheck, "2026-11-16T12:04:30Z");
  // SmartScout is weekly: 7 days old is inside twice its interval.
  assert.ok(sources.every((source) => !source.outOfDate));
  for (const line of sources.map(dataSourceLine)) {
    assert.doesNotMatch(line, /_|\bago\b|stale|'(?!s )|—/, line);
    assert.match(line, /: last checked [A-Z][a-z]{2} \d{1,2}, 2026$/);
  }
  assert.equal(dataAsOf(sources), "2026-11-16T14:02:53Z");
});

test("Ledlenser shows only the sources it has, and Walmart uses its two-day interval", () => {
  resetActiveClientForTests("ledlenser");
  const sources = dataSourceFreshness(LEDLENSER, NOW);
  assert.deepEqual(
    sources.map((source) => source.label),
    ["AI answers", "Amazon prices and Buy Box", "Walmart", "Amazon specs and A+", "Amazon sales estimates"],
  );
  assert.equal(sources.find((source) => source.id === "walmart")!.intervalDays, 2);
  const late = dataSourceFreshness([{ job_key: "map_leakage_walmart", last_run_at: "2026-11-13T10:00:00Z" }], NOW)[0]!;
  assert.equal(late.outOfDate, false, "3 days is inside Ledlenser's 4-day window");
  resetActiveClientForTests("fender");
  assert.equal(dataSourceFreshness([{ job_key: "map_leakage_walmart", last_run_at: "2026-11-13T10:00:00Z" }], NOW)[0]!.outOfDate, true);
});

test("out of date is twice each source's own interval, not a flat 26 hours", () => {
  resetActiveClientForTests("fender");
  const at = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
  const cases: [string, number, boolean][] = [
    ["ai_simulations", 5.9, false],
    ["ai_simulations", 6.1, true],
    ["featured_offer_keepa", 1.9, false],
    ["featured_offer_keepa", 2.1, true],
    ["map_parity_musiciansfriend", 5.9, false],
    ["map_parity_musiciansfriend", 6.1, true],
    ["spec_readiness", 13.9, false],
    ["spec_readiness", 14.1, true],
    ["smartscout_snapshot", 14.1, true],
    ["findability_recheck", 13.9, false],
  ];
  for (const [job, days, out] of cases) {
    const [source] = dataSourceFreshness([{ job_key: job, last_run_at: at(days) }], NOW);
    assert.equal(source!.outOfDate, out, `${job} at ${days} days`);
    assert.equal(dataSourceLine(source!).endsWith(", out of date"), out);
  }
});

test("a source's own collector sets its date; supporting jobs fill in only without one", () => {
  const [ai] = dataSourceFreshness([
    { job_key: "ai_simulations", last_run_at: "2026-11-01T00:00:00Z" },
    { job_key: "claude_drift_check", last_run_at: "2026-11-16T12:00:00Z" },
  ], NOW);
  assert.equal(ai!.lastCheck, "2026-11-01T00:00:00Z");
  assert.equal(ai!.outOfDate, true);
  const [onlyLocks] = dataSourceFreshness([{ job_key: "subchat_lock_x_all", last_run_at: "2026-11-15T00:00:00Z" }], NOW);
  assert.equal(onlyLocks!.lastCheck, "2026-11-15T00:00:00Z");
});

test("the tooltip carries rows; an out-of-date row is red with the x mark, and the label gets the x", () => {
  assert.deepEqual(parseTooltipRows('[{"text":"Walmart: last checked Nov 12, 2026, out of date","bad":true},{"text":"AI answers"}]'), [
    { text: "Walmart: last checked Nov 12, 2026, out of date", bad: true },
    { text: "AI answers" },
  ]);
  assert.equal(parseTooltipRows("not json"), undefined);
  const base = { title: "t", desc: "d", hasMoreInfo: false, anchor: "definition" as const };
  assert.equal(sameTooltipContent({ ...base, rows: [{ text: "a" }] }, { ...base, rows: [{ text: "a", bad: true }] }), false);

  const bar = readFileSync("components/v3/live/DataFreshnessBar.tsx", "utf8");
  assert.match(bar, /Data as of \{asOfLabel\}/);
  assert.match(bar, /anyOutOfDate \? \(\s*<span className="data-status-bad"[^>]*>\s*<StatusGlyph status="bad" \/>/);
  assert.doesNotMatch(bar, /26 \* 3600|JOB_LABELS|relativeTime/);
  const tip = readFileSync("lib/canvas-sdk/NodeTooltip.tsx", "utf8");
  assert.match(tip, /row\.bad \? <StatusGlyph status="bad" \/> : null/);
  assert.match(tip, /dataStatusColor\("bad"\)/);
});
