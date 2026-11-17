// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/e2e-db-target.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_E2E_WORKERS,
  productionNotice,
  resolveDbTarget,
  resolveWorkers,
} from "../e2e/db-target.ts";

/* 17 Nov 2026: browser tests move off production onto a database copy. Unset, the
   suite still reads production and must say so; set, the dev server reads the copy. */

test("no override reads production through .env.local and prints the one-suite notice", () => {
  const target = resolveDbTarget({});
  assert.equal(target.production, true);
  assert.deepEqual(target.serverEnv, {});
  assert.match(productionNotice(target) ?? "", /one suite at a time/);
});

test("a copy URL and key override every Supabase variable the app reads", () => {
  const target = resolveDbTarget({
    E2E_SUPABASE_URL: "https://copyref.supabase.co",
    E2E_SUPABASE_ANON_KEY: "copy-key",
  });
  assert.equal(target.production, false);
  assert.equal(target.host, "copyref.supabase.co");
  assert.deepEqual(target.serverEnv, {
    NEXT_PUBLIC_SUPABASE_URL: "https://copyref.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "copy-key",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "copy-key",
  });
  assert.equal(productionNotice(target), null);
});

test("pointing the override at production still counts as production", () => {
  const target = resolveDbTarget({
    E2E_SUPABASE_URL: "https://qftczrlksczfimnzfiov.supabase.co",
    E2E_SUPABASE_ANON_KEY: "k",
  });
  assert.equal(target.production, true);
  assert.notEqual(productionNotice(target), null);
});

test("only one of the pair, or a bad URL, is refused", () => {
  assert.throws(() => resolveDbTarget({ E2E_SUPABASE_URL: "https://x.supabase.co" }), /both/);
  assert.throws(() => resolveDbTarget({ E2E_SUPABASE_ANON_KEY: "k" }), /both/);
  assert.throws(() => resolveDbTarget({ E2E_SUPABASE_URL: "not a url", E2E_SUPABASE_ANON_KEY: "k" }), /valid URL/);
});

test("workers default to 2 and E2E_WORKERS overrides", () => {
  assert.equal(resolveWorkers({}), DEFAULT_E2E_WORKERS);
  assert.equal(DEFAULT_E2E_WORKERS, 2);
  assert.equal(resolveWorkers({ E2E_WORKERS: "4" }), 4);
  assert.equal(resolveWorkers({ E2E_WORKERS: "50%" }), "50%");
  assert.throws(() => resolveWorkers({ E2E_WORKERS: "0" }));
  assert.throws(() => resolveWorkers({ E2E_WORKERS: "many" }));
});

test("playwright config wires the target into the spawned server and keeps fullyParallel", () => {
  const config = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");
  assert.match(config, /fullyParallel: true/);
  assert.match(config, /workers: resolveWorkers\(process\.env\)/);
  assert.match(config, /\.\.\.dbTarget\.serverEnv/);
  assert.match(config, /reuseExistingServer: !process\.env\.CI && !overridesDb/);
});
