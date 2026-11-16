// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/score-history.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CLIENTS } from "../lib/client/active-client.ts";
import { consensusFromLive } from "../lib/fender-canvas/consensus-scores-from-live.ts";
import { consensusScore, type CommerceInputs, type FoundationInputs } from "../lib/fender-canvas/consensus-scores.ts";
import type { PortfolioRetailSnapshot } from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import {
  loadScoreHistory,
  scoreHistoryModel,
  scoreHistoryTip,
  type ScoreHistoryClient,
  type ScoreSnapshotRow,
} from "../lib/fender-canvas/score-history.ts";
import {
  scoreSnapshotFromReads,
  snapshotSaveSql,
  weekStartUtc,
  type ScoreSnapshotReads,
} from "../lib/fender-canvas/score-snapshot.ts";
import { weakestScoreCard } from "../lib/fender-canvas/weakest-score-card.ts";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const share = (numerator: number, denominator: number) => ({ numerator, denominator });

function scores(foundation: Partial<FoundationInputs>, commerce: Partial<CommerceInputs>) {
  return consensusScore(
    {
      exactOfficialPages: null,
      machineReadableSpecs: null,
      requiredMarketplaceSpecs: null,
      unbrandedNamedMost: null,
      factCheckMatch: null,
      ...foundation,
    },
    { controlledBuyBox: null, notSuppressed: null, activeProductsAvailable: null, notSplintered: null, noMapViolation: null, ...commerce },
  );
}

// Weakest card (decision 94) -------------------------------------------------------------------

test("the weakest score card is the lowest score against target 70", () => {
  const low = scores({ exactOfficialPages: share(30, 100) }, { notSuppressed: share(80, 100) });
  assert.equal(low.foundation.score, 30);
  assert.equal(weakestScoreCard(low), "foundation");
  const commerceLow = scores({ exactOfficialPages: share(90, 100) }, { notSuppressed: share(20, 100) });
  assert.equal(weakestScoreCard(commerceLow), "commerce");
});

test("a score that reads Not included or has no figure does not count", () => {
  // AI Actuation is never chosen: it reads Not included.
  const onlyCommerce = scores({}, { notSuppressed: share(90, 100) });
  assert.equal(onlyCommerce.foundation.score, null);
  // Consensus equals Commerce here; the tie keeps the card order on screen.
  assert.equal(weakestScoreCard(onlyCommerce), "consensus");
  const none = scores({}, {});
  assert.equal(weakestScoreCard(none), null);
});

test("Performance opens the weakest card on first render", () => {
  const view = read("components/v3/live/ConsensusScoreView.tsx");
  assert.match(view, /const weakest = weakestScoreCard\(consensus\);/);
  assert.match(view, /useState<OpenCard \| null>\(weakest\)/);
});

// History read (absent / present) --------------------------------------------------------------

function clientAnswering(result: { data: unknown[] | null; error: { code?: string; message: string } | null }) {
  const calls: string[] = [];
  const client: ScoreHistoryClient = {
    from(table) {
      calls.push(`from:${table}`);
      return {
        select(columns) {
          calls.push(`select:${columns}`);
          return {
            eq(column, value) {
              calls.push(`eq:${column}=${value}`);
              return {
                order(column) {
                  calls.push(`order:${column}`);
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const ROWS: ScoreSnapshotRow[] = [
  { client_key: "fmic", week_start: "2026-11-16", saved_at: "2026-11-16T18:17:00Z", consensus_score: "56.01", foundation_score: 34.59, commerce_score: 77.44, actuation_score: null },
  { client_key: "fmic", week_start: "2026-11-09", saved_at: "2026-11-09T18:17:00Z", consensus_score: 54, foundation_score: 33, commerce_score: 75, actuation_score: null },
];

test("before the table exists the history reads absent, never an error", async () => {
  const missing = clientAnswering({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.canvas_score_snapshots' in the schema cache" } });
  assert.deepEqual(await loadScoreHistory(missing.client, "fmic"), { phase: "absent" });
  const relation = clientAnswering({ data: null, error: { code: "42P01", message: 'relation "public.canvas_score_snapshots" does not exist' } });
  assert.deepEqual(await loadScoreHistory(relation.client, "ledlenser"), { phase: "absent" });
  const empty = clientAnswering({ data: [], error: null });
  assert.deepEqual(await loadScoreHistory(empty.client, "fmic"), { phase: "absent" });
  const failed = clientAnswering({ data: null, error: { code: "57014", message: "statement timeout" } });
  assert.equal((await loadScoreHistory(failed.client, "fmic")).phase, "error");
});

test("a present history reads one client's rows from the public table", async () => {
  const present = clientAnswering({ data: ROWS, error: null });
  const result = await loadScoreHistory(present.client, "fmic");
  assert.equal(result.phase, "ready");
  assert.ok(present.calls.includes("from:canvas_score_snapshots"));
  assert.ok(present.calls.includes("eq:client_key=fmic"));
  assert.ok(present.calls.includes("order:week_start"));
});

test("the chart model draws saved weeks only and skips a score with no points", () => {
  const model = scoreHistoryModel(ROWS);
  assert.ok(model);
  assert.deepEqual(model.weeks, ["2026-11-09", "2026-11-16"]);
  assert.deepEqual(
    model.series.map((line) => line.key),
    ["consensus", "foundation", "commerce"],
  );
  assert.deepEqual(model.series[0].points, [
    { week: "2026-11-09", score: 54 },
    { week: "2026-11-16", score: 56.01 },
  ]);
  assert.equal(scoreHistoryModel([]), null);
  const one = scoreHistoryModel([ROWS[0]]);
  assert.ok(one);
  assert.match(scoreHistoryTip(one), /Saving started the week of Nov 16, 2026\. One week is saved so far\./);
});

test("the chart reads with the public client and renders nothing while absent", () => {
  const chart = read("components/v3/live/ScoreHistoryChart.tsx");
  assert.match(chart, /getPublicCanvasSupabase\(\)/);
  assert.match(chart, /activeClient\(\)\.setAsideKey/);
  assert.match(chart, /if \(!model \|\| model\.series\.length === 0\) return null;/);
  assert.doesNotMatch(chart, /\stitle=|Not available/);
  assert.match(read("components/v3/live/ConsensusScoresPanel.tsx"), /<ConsensusLeadBand consensus=\{consensus\} \/>\s*<ScoreHistoryChart \/>/);
});

// Weekly save -----------------------------------------------------------------------------------

function retailRead(): RetailCanvasRead {
  const snapshot = {
    controlledBuyBox: { controlled: 6, known: 10, population: 12 },
    buyBoxSellers: null,
    suppressedListings: { detail: { counts: { current: 20, withheld: 2 } } },
    unnestedBundles: { detail: { bundlesInRead: 10, opportunities: [1, 2, 3] } },
    mapLeakage: { detail: { decided: 8, violations: 1 } },
    amazonSpecGaps: { detail: null },
  } as unknown as PortfolioRetailSnapshot;
  return { phase: "ready", snapshot };
}

function reads(retail: RetailCanvasRead = retailRead()): ScoreSnapshotReads {
  return {
    findability: { phase: "error", message: "fixture" },
    specPages: { pages: [{}, {}, {}, {}] as never, withSpecBlock: 1, withAllBasics: 0, listings: 4 },
    retail,
    ai: { phase: "loading" },
    aiWindow: null,
  };
}

test("the save scores with consensusFromLive, the cards' own function", () => {
  const input = reads();
  const expected = consensusFromLive({ ...input, authorizedPartners: null });
  assert.ok(expected?.score != null);
  const snapshot = scoreSnapshotFromReads(CLIENTS.fender, "2026-11-16", input);
  assert.ok(snapshot);
  assert.equal(snapshot.clientKey, "fmic");
  assert.equal(snapshot.consensus, Math.round(expected.score * 100) / 100);
  assert.equal(snapshot.foundation, Math.round((expected.foundation.score as number) * 100) / 100);
  assert.equal(snapshot.commerce, Math.round((expected.commerce.score as number) * 100) / 100);
  assert.equal(snapshot.actuation, null);
  assert.deepEqual((snapshot.inputs.foundationInputs as FoundationInputs).machineReadableSpecs, share(1, 4));
  assert.equal(scoreSnapshotFromReads(CLIENTS.ledlenser, "2026-11-16", input)?.clientKey, "ledlenser");
  // No retail read: the cards say not available, and nothing is saved.
  assert.equal(scoreSnapshotFromReads(CLIENTS.fender, "2026-11-16", reads({ phase: "error" })), null);
});

test("the script keeps no second copy of the formula and saves every client", () => {
  const script = read("scripts/save-score-snapshots.ts");
  const compute = read("lib/fender-canvas/score-snapshot.ts");
  assert.match(compute, /consensusFromLive\(/);
  for (const source of [script, compute, read("lib/fender-canvas/score-snapshot-reads.ts")]) {
    assert.doesNotMatch(source, /consensusScore\(|foundationScore\(|commerceScore\(|nominalWeight/);
  }
  assert.match(script, /for \(const key of CLIENT_KEYS\)/);
  // Scored inside the client's scope: the brand name and required spec fields follow the client.
  assert.match(script, /runWithClient\(key, async \(\) =>\s*scoreSnapshotFromReads\(client, weekStart, await loadScoreSnapshotReads\(\)/);
  assert.match(script, /SCORE_SNAPSHOT_DB_URL is not set/);
});

test("the save SQL is one function call per client with the inputs dollar-quoted", () => {
  const snapshot = scoreSnapshotFromReads(CLIENTS.fender, "2026-11-16", reads());
  assert.ok(snapshot);
  const sql = snapshotSaveSql({ ...snapshot, inputs: { note: "it's $scores$ here" } });
  assert.match(sql, /^select public\.canvas_score_snapshot_save\('fmic', date '2026-11-16', [\d.]+, [\d.]+, [\d.]+, null, \$scores1\$/);
  assert.match(sql, /\$scores1\$::jsonb\);$/);
  assert.throws(() => snapshotSaveSql({ ...snapshot, clientKey: "x'; drop table y; --" }));
  assert.equal(weekStartUtc(new Date("2026-11-16T18:17:00Z")), "2026-11-16");
  assert.equal(weekStartUtc(new Date("2026-11-22T23:59:00Z")), "2026-11-16");
  assert.equal(weekStartUtc(new Date("2026-11-23T00:01:00Z")), "2026-11-23");
});

test("the migration is additive and the workflow runs weekly without a person", () => {
  const sql = read("supabase/migrations/20261116200000_canvas_score_snapshots.sql");
  assert.match(sql, /create table if not exists public\.canvas_score_snapshots/);
  assert.match(sql, /unique \(client_key, week_start\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /grant select on public\.canvas_score_snapshots to anon, authenticated;/);
  assert.match(sql, /How to undo/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\b(drop|alter table (?!public\.canvas_score_snapshots enable)|delete|truncate)\b/i);
  const workflow = read(".github/workflows/score-snapshots.yml");
  assert.match(workflow, /cron: "17 18 \* \* 1"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /secrets\.SCORE_SNAPSHOT_DB_URL/);
  assert.match(workflow, /SCORE_SNAPSHOT_DB_URL is not set/);
});
