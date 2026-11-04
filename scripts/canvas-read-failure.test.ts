import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCanvas } from "../lib/canvasData.ts";
import {
  BUNDLE_READ_KEYS,
  CANVAS_READS,
  CanvasReadError,
  EMPTY_METRICS_ROW,
  READ_NOT_AVAILABLE,
  readFailureTip,
  withLastGood,
  type BundleReadKey,
} from "../lib/fender-canvas/canvas-reads.ts";
import { buildLiveCommandCenter } from "../lib/fender-canvas/command-center-from-live.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { buildTemplateVars } from "../lib/fender-canvas/template-vars.ts";
import { buildLiveTourSteps } from "../lib/fender-canvas/tour-from-live.ts";
import type { CanvasBundle } from "../lib/fender-canvas/types.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const METRICS = {
  ...EMPTY_METRICS_ROW,
  catalog_skus: 3598,
  division_count: 13,
  bb_1p: 85,
  bb_3p: 851,
  bb_1p_pct: 8.3,
  active_offer_coverage_pct: 28.5,
  spec_checked: 913,
  spec_fender_found: 99,
  spec_fender_found_pct: 10.8,
  sim_resolved: 3885,
  sim_win_pct: 82.6,
};

const ROWS: Record<string, unknown> = {
  canvas_metrics: METRICS,
  canvas_ai_category: [{ category: "beginner", fender_win_pct: 58.5, top_competitor: "Yamaha", top_competitor_pct: 20 }],
  canvas_ai_engine: [{ engine: "chatgpt", fender_win_pct: 80, resolved: 100 }],
  canvas_competitor_sov: [{ category: "beginner", competitor: "Yamaha", wins: 12, sov_pct: 20 }],
  canvas_divisions: [{ division: "Electric", monitored_skus: 40, buybox_pct: 30, schema_sync_pct: 90, splinter_bundles: 2, primary_threat: null, strategic_action: null }],
  canvas_spec_missing_fields: [{ field: "color", sku_count: 12, source: "amazon" }],
  canvas_freshness: [{ job_key: "catalog_harvester", last_run_at: "2026-11-04T10:00:00Z" }],
  canvas_spec_readiness: [],
  canvas_listing_content: [],
};

type Outcome = "ok" | "error" | "reject" | "hang";

/** Answers each view from ROWS; a listed view fails with an error result or a rejection. */
function stubClient(fail: Partial<Record<string, Outcome>> = {}): SupabaseClient {
  const builder = (table: string) => {
    const query = {
      select: () => query,
      order: () => query,
      eq: () => query,
      range: () => query,
      single: () => query,
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        const outcome = fail[table] ?? "ok";
        if (outcome === "hang") return new Promise(() => {});
        if (outcome === "reject") return Promise.reject(new TypeError("Failed to fetch")).then(resolve, reject);
        if (outcome === "error") {
          return Promise.resolve({ data: null, error: { message: `forced ${table} failure` } }).then(resolve, reject);
        }
        return Promise.resolve({ data: ROWS[table], error: null }).then(resolve, reject);
      },
    };
    return query;
  };
  return { from: builder } as unknown as SupabaseClient;
}

const LIST_KEYS = BUNDLE_READ_KEYS.filter((key): key is Exclude<BundleReadKey, "m"> => key !== "m");

/** Every figure the map, widgets, command center, and tour build from the bundle. */
function downstreamText(bundle: CanvasBundle): string[] {
  const metrics = buildLiveMetrics(bundle);
  const nodes = buildLiveNodes(bundle, metrics);
  const command = buildLiveCommandCenter(bundle, { phase: "loading" }, { phase: "loading" });
  const tour = buildLiveTourSteps(bundle);
  return [
    ...Object.values(buildTemplateVars(bundle)),
    ...Object.values(metrics).flatMap((metric) => [metric.value, metric.detail ?? ""]),
    ...nodes.flatMap((node) => [...node.stats, node.heroValue?.value ?? ""]),
    JSON.stringify(command),
    JSON.stringify(tour),
  ];
}

for (const key of BUNDLE_READ_KEYS) {
  const { source } = CANVAS_READS[key];

  test(`${source} failing alone still builds the bundle with that piece unavailable`, async () => {
    const bundle = await loadCanvas(stubClient({ [source]: "error" }));

    assert.deepEqual(Object.keys(bundle.unavailable ?? {}), [key]);
    const failure = bundle.unavailable![key]!;
    assert.equal(failure.source, source);
    assert.equal(failure.message, `forced ${source} failure`);
    assert.match(readFailureTip(failure), new RegExp(`\\(${source}\\) did not load`));

    if (key === "m") {
      assert.deepEqual(bundle.m, EMPTY_METRICS_ROW);
      for (const value of Object.values(bundle.m)) assert.equal(value, null, "a failed metrics row is null, never zero");
    } else {
      assert.deepEqual(bundle[key], []);
      assert.deepEqual(bundle.m, METRICS);
    }
    for (const other of LIST_KEYS.filter((k) => k !== key)) {
      assert.deepEqual(bundle[other], ROWS[CANVAS_READS[other].source], `${other} still loads`);
    }

    const figures = downstreamText(bundle);
    assert.ok(figures.length > 0);
  });

  test(`${source} rejecting alone is marked the same way`, async () => {
    const bundle = await loadCanvas(stubClient({ [source]: "reject" }));
    assert.deepEqual(Object.keys(bundle.unavailable ?? {}), [key]);
    assert.equal(bundle.unavailable![key]!.message, "Failed to fetch");
  });
}

test("a hung read times out into Not available* instead of holding the map on Loading", async () => {
  const bundle = await loadCanvas(stubClient({ canvas_metrics: "hang", canvas_spec_readiness: "hang" }), 30);
  assert.deepEqual(Object.keys(bundle.unavailable ?? {}).sort(), ["m", "specPages"]);
  assert.deepEqual(bundle.m, EMPTY_METRICS_ROW);
  assert.equal(bundle.specPages, null);
  assert.match(readFailureTip(bundle.unavailable!.m!), /\(canvas_metrics\) did not load: it took longer than \d+ seconds\.$/);
  assert.deepEqual(bundle.divisions, ROWS.canvas_divisions);
});

test("a failed metrics read shows missing figures, never zero", async () => {
  const bundle = await loadCanvas(stubClient({ canvas_metrics: "error" }));
  const metrics = buildLiveMetrics(bundle);
  for (const id of ["activeOfferCoverage", "buyBoxRetention", "sellerDataCoverage", "overallAiWinRate"]) {
    assert.doesNotMatch(metrics[id].value, /^0(\.0)?%?$/, `${id} must not read zero`);
    assert.doesNotMatch(metrics[id].value, /\d/, `${id} invents no number`);
  }
  const readiness = buildLiveNodes(bundle, metrics).find((node) => node.id === "spoke-specs");
  assert.doesNotMatch(String(readiness?.heroValue?.value), /\d/, "AI Readiness bubble invents no number");
  assert.doesNotMatch(buildTemplateVars(bundle).catalog_skus, /\d/);
});

test("every bundle read failing keeps the full error and names each source", async () => {
  const everyRead = Object.fromEntries(BUNDLE_READ_KEYS.map((key) => [CANVAS_READS[key].source, "error" as const]));
  await assert.rejects(loadCanvas(stubClient(everyRead)), (error: unknown) => {
    assert.ok(error instanceof CanvasReadError);
    assert.equal(error.failures.length, BUNDLE_READ_KEYS.length);
    for (const key of BUNDLE_READ_KEYS) assert.match(error.message, new RegExp(CANVAS_READS[key].source));
    return true;
  });
});

test("six of seven failing still builds from the one read that loaded", async () => {
  const sixFail = Object.fromEntries(
    BUNDLE_READ_KEYS.filter((key) => key !== "divisions").map((key) => [CANVAS_READS[key].source, "error" as const]),
  );
  const bundle = await loadCanvas(stubClient(sixFail));
  assert.equal(Object.keys(bundle.unavailable ?? {}).length, 6);
  assert.deepEqual(bundle.divisions, ROWS.canvas_divisions);
});

test("a failed page read is null and named, beside a full bundle", async () => {
  const bundle = await loadCanvas(stubClient({ canvas_spec_readiness: "error", canvas_listing_content: "reject" }));
  assert.equal(bundle.specPages, null);
  assert.equal(bundle.listingContent, null);
  assert.equal(bundle.unavailable?.specPages?.source, "canvas_spec_readiness");
  assert.equal(bundle.unavailable?.listingContent?.source, "canvas_listing_content");
  assert.deepEqual(bundle.m, METRICS);
});

test("a refresh that fails one read keeps that piece's last good value and goes stale", async () => {
  const lastGood = await loadCanvas(stubClient());
  const next = await loadCanvas(stubClient({ canvas_divisions: "error" }));
  const merged = withLastGood(next, lastGood);
  assert.equal(merged.stale, true);
  assert.deepEqual(merged.bundle.divisions, ROWS.canvas_divisions);
  assert.equal(merged.bundle.unavailable?.divisions, undefined);

  const clean = withLastGood(lastGood, lastGood);
  assert.equal(clean.stale, false);
});

test("a piece that never loaded stays Not available* on refresh", async () => {
  const first = await loadCanvas(stubClient({ canvas_divisions: "error" }));
  const next = await loadCanvas(stubClient({ canvas_divisions: "error" }));
  const merged = withLastGood(next, first);
  assert.equal(merged.stale, false);
  assert.deepEqual(merged.bundle.divisions, []);
  assert.equal(merged.bundle.unavailable?.divisions?.source, "canvas_divisions");
  assert.equal(READ_NOT_AVAILABLE, "Not available*");
});

test("the failed division read reads Not available* with a custom tooltip naming the source", () => {
  const spokes = read("components/v3/build-live-spokes.tsx");
  const fallbacks = read("components/v3/read-fallbacks.tsx");
  const mark = read("components/v3/live/ReadNotAvailable.tsx");
  assert.match(spokes, /readFallbackTab\(id, tabIdx, bundle, retail\) \?\? overrides\[tabIdx\]/);
  assert.match(spokes, /\.\.\.readFallbackDesc\(id, spokeData\[id\]\.desc, vars, bundle\)/);
  assert.match(fallbacks, /bundle\.unavailable\?\.divisions/);
  assert.match(mark, /className="ifai-term"/);
  assert.match(mark, /data-ifai-tooltip-desc=\{tip\}/);
  assert.match(mark, /readFailureTip\(failure\)/);
  assert.doesNotMatch(mark, /\stitle=/);
});

test("the canvas hook keeps the last good bundle and only blanks when every read fails", () => {
  const hook = read("components/v3/use-fender-canvas-data.ts");
  assert.match(hook, /withLastGood\(next, lastGood\.current\)/);
  assert.match(hook, /if \(lastGood\.current\) setData\(lastGood\.current\)/);
  const loader = read("lib/canvasData.ts");
  assert.match(loader, /Promise\.allSettled/);
  assert.doesNotMatch(loader, /if \(err\?\.error\) throw/);
});
