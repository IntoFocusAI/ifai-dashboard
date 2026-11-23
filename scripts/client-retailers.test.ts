// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/client-retailers.test.ts
//
// Retailer lists are per client (Brian Magazu, 23 Nov 2026): every client starts with Amazon and
// Walmart plus room for its own retailers, and no client inherits another's. Amazon is the home
// channel (settings `retailers` lists the retailers other than Amazon), so the starting set in a
// settings record is Walmart alone. The database lists follow the same rule
// (supabase/migrations/20261123220000_fender_guitar_center_retailer.sql, supabase/tests/retailer_lists.test.sql).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

type Settings = { client_key: string; retailers: { key: string; name: string }[] };
const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Settings;
const clients = readdirSync("data/clients").filter((f) => f.endsWith(".json")).map((f) => read(`data/clients/${f}`));
const fixtures = readdirSync("e2e/fixtures/clients").filter((f) => f.endsWith(".json")).map((f) => read(`e2e/fixtures/clients/${f}`));

/** Fender's own retailers. Each stays on Fender's list only. */
const FENDER_ONLY = /musician|guitar.?center|sweetwater|reverb/i;

test("Retailer lists: every client's list starts with Walmart (after Amazon, the home channel)", () => {
  for (const c of [...clients, ...fixtures]) {
    assert.equal(c.retailers[0]?.key, "walmart", c.client_key);
    assert.equal(c.retailers.some((r) => /amazon/i.test(r.key)), false, `${c.client_key}: Amazon is the home channel, not a retailer row`);
  }
});

test("Retailer lists: no client inherits Fender's retailers", () => {
  for (const c of [...clients, ...fixtures].filter((x) => x.client_key !== "fender")) {
    const borrowed = c.retailers.filter((r) => FENDER_ONLY.test(`${r.key} ${r.name}`));
    assert.deepEqual(borrowed, [], c.client_key);
  }
});

test("Retailer lists: a new client starts with exactly the starting set", () => {
  // The made-up third client stands in for a client on its first day.
  assert.ok(fixtures.length > 0);
  for (const c of fixtures) assert.deepEqual(c.retailers.map((r) => r.key), ["walmart"], c.client_key);
});
