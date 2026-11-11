// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/role-rate-lead.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BRANDED_RATE_BANDS,
  pct,
  roleRateLead,
  UNBRANDED_RATE_BANDS,
} from "../lib/ai-search/summary.ts";

test("unbranded percentage string matches pct and uses the yellow band at both ends", () => {
  const mid = roleRateLead({ fenderWins: 13, resolved: 21 }, UNBRANDED_RATE_BANDS);
  assert.equal(mid.rate, pct(13, 21));
  assert.equal(mid.rate, "61.9%");
  assert.equal(mid.color, "var(--warning-amber)");

  const lowEnd = roleRateLead({ fenderWins: 3, resolved: 10 }, UNBRANDED_RATE_BANDS);
  assert.equal(lowEnd.rate, "30.0%");
  assert.equal(lowEnd.color, "var(--warning-amber)");

  const highEnd = roleRateLead({ fenderWins: 13, resolved: 20 }, UNBRANDED_RATE_BANDS);
  assert.equal(highEnd.rate, "65.0%");
  assert.equal(highEnd.color, "var(--warning-amber)");
});

test("unbranded is red below 30 and green above 65", () => {
  const red = roleRateLead({ fenderWins: 2, resolved: 10 }, UNBRANDED_RATE_BANDS);
  assert.equal(red.rate, "20.0%");
  assert.equal(red.color, "var(--danger-red)");

  const green = roleRateLead({ fenderWins: 14, resolved: 20 }, UNBRANDED_RATE_BANDS);
  assert.equal(green.rate, "70.0%");
  assert.equal(green.color, "var(--success-green)");
});

test("branded is red below 70, yellow through 90, green above 90", () => {
  const red = roleRateLead({ fenderWins: 13, resolved: 20 }, BRANDED_RATE_BANDS);
  assert.equal(red.rate, "65.0%");
  assert.equal(red.color, "var(--danger-red)");

  const yellowLow = roleRateLead({ fenderWins: 7, resolved: 10 }, BRANDED_RATE_BANDS);
  assert.equal(yellowLow.rate, "70.0%");
  assert.equal(yellowLow.color, "var(--warning-amber)");

  const yellowHigh = roleRateLead({ fenderWins: 9, resolved: 10 }, BRANDED_RATE_BANDS);
  assert.equal(yellowHigh.rate, "90.0%");
  assert.equal(yellowHigh.color, "var(--warning-amber)");

  const green = roleRateLead({ fenderWins: 22, resolved: 23 }, BRANDED_RATE_BANDS);
  assert.equal(green.rate, pct(22, 23));
  assert.equal(green.rate, "95.7%");
  assert.equal(green.color, "var(--success-green)");
});

test("zero resolved shows no percentage and no color", () => {
  const empty = roleRateLead({ fenderWins: 0, resolved: 0 }, BRANDED_RATE_BANDS);
  assert.equal(empty.rate, null);
  assert.equal(empty.color, null);
  assert.notEqual(empty.rate, "100.0%");
  assert.notEqual(empty.rate, "0.0%");
});
