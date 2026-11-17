// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/estimate-trail.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  CONFIDENCE_STATUS,
  coverageText,
  estimatedFrom,
  inputBenchmark,
  inputKindLabel,
  inputKindTip,
  inputValueText,
  MOST_IMPROVED_BY,
  resultFigureText,
  salesSourceRows,
  SOURCE_NOT_CHECKED,
  sourceHref,
  sourceTip,
} from "../components/v3/live/estimates/trail-copy.ts";
import { HIGH_CONFIDENCE_RESULT, LOW_CONFIDENCE_RESULT } from "../e2e/estimate-trail-fixtures.ts";
import { formatMoneyRange, formatMoneyShort, formatMoneySpan } from "../lib/fender-canvas/format.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");
const LOW = LOW_CONFIDENCE_RESULT.trail;
const HIGH = HIGH_CONFIDENCE_RESULT.trail;

test("money: whole dollars under $1K, three figures above, separators throughout", () => {
  assert.equal(formatMoneyShort(119), "$119");
  assert.equal(formatMoneyShort(945.4), "$945");
  assert.equal(formatMoneyShort(0), "$0");
  assert.equal(formatMoneyShort(1_543), "$1.54K");
  assert.equal(formatMoneyShort(12_400), "$12.4K");
  assert.equal(formatMoneyShort(490_347), "$490K");
  assert.equal(formatMoneyShort(1_050_000), "$1.05M");
  assert.equal(formatMoneyShort(20_695_240), "$20.7M");
  assert.equal(formatMoneyShort(1_250_000_000_000), "$1,250B");
  assert.equal(formatMoneyShort(-12_400), "-$12.4K");
  assert.equal(formatMoneyShort(null), "Pending data");
});

test("money: rounding at a unit boundary moves up a unit", () => {
  assert.equal(formatMoneyShort(999.6), "$1.00K");
  assert.equal(formatMoneyShort(9_996), "$10.0K");
  assert.equal(formatMoneyShort(99_960), "$100K");
  assert.equal(formatMoneyShort(999_600), "$1.00M");
});

test("money: mid with its range, low end in the high end's unit just under a million", () => {
  assert.equal(formatMoneyRange({ low: 600_000, mid: 1_050_000, high: 1_710_000 }), "$1.05M, range $0.60M to $1.71M");
  assert.equal(formatMoneyRange({ low: 11_000, mid: 17_100, high: 26_400 }), "$17.1K, range $11.0K to $26.4K");
  assert.equal(formatMoneySpan(443, 1_543), "$443 to $1.54K");
  assert.equal(formatMoneySpan(4_900, 147_000), "$4.90K to $147K");
  assert.equal(formatMoneyRange(null), "Pending data");
});

test("figure: mid with range, or Not available* when no listing had a sales figure", () => {
  assert.equal(resultFigureText(HIGH_CONFIDENCE_RESULT), "$490K, range $368K to $674K");
  assert.equal(resultFigureText(LOW_CONFIDENCE_RESULT), "$2.45K, range $306 to $9.18K");
  assert.equal(resultFigureText({ status: "not_available", range: null }), "Not available*");
});

test("coverage: N of M measured, estimated listings and their basis, Not available*", () => {
  assert.equal(coverageText(LOW), "Based on 62 of 214 listings; 120 estimated from sales rank; 32 Not available*");
  assert.equal(coverageText(HIGH), "Based on 247 of 609 listings; 362 Not available*");
  const both = {
    ...LOW,
    salesSources: { ...LOW.salesSources, keepa_monthly_sold: { listings: 10, annualSales: 1 } },
  };
  assert.equal(estimatedFrom(both), "sales rank and Keepa monthly sold");
  assert.deepEqual(
    salesSourceRows(LOW).map((row) => [row.label, row.listings, row.annualSales]),
    [
      ["Estimated from sales rank", "120", "$48.0K a year"],
      ["SmartScout sales estimate", "62", "$122K a year"],
      ["No sales figure yet", "32", "Not available*"],
    ],
  );
});

test("inputs: value in its unit with the benchmark's range; kinds in the operator's words", () => {
  const byKey = (key: string) => LOW.inputs.find((input) => input.key === key)!;
  const share = byKey("ai_shaped_share");
  assert.equal(inputValueText(share, inputBenchmark(share, LOW)), "4% (1% to 10%)");
  assert.equal(inputValueText(byKey("brand_sales"), null), "$122K");
  assert.equal(inputValueText(byKey("current_rate"), null), "3.8%");
  assert.equal(inputValueText({ unit: "usd", value: null }), "Not available*");
  assert.equal(inputValueText({ unit: "text", value: "Musical instruments" }), "Musical instruments");
  assert.equal(inputValueText({ unit: "days", value: 1 }), "1 day");
  assert.equal(inputValueText({ unit: "usd_per_day", value: 1_234 }), "$1.23K a day");
  assert.deepEqual(
    ["collected", "benchmark", "assumption", "derived", "client"].map(inputKindLabel),
    ["Measured", "Benchmark", "Placeholder", "Worked out", "Client-provided"],
  );
  assert.match(inputKindTip(byKey("brand_sales")), /Read from: canvas_listing_sales_loss_v2\.smartscout_ttm_revenue\.$/);
});

test("sources: an unchecked source says so in its tooltip only", () => {
  const unchecked = LOW.sources[0];
  assert.ok(sourceTip(unchecked).endsWith(SOURCE_NOT_CHECKED));
  assert.ok(!sourceTip({ ...unchecked, verified: true }).includes(SOURCE_NOT_CHECKED));
  assert.equal(sourceHref("javascript:alert(1)"), null);
  assert.equal(sourceHref("not a url"), null);
  assert.equal(sourceHref(unchecked.url), unchecked.url);
  const sources = read("components/v3/live/estimates/EstimateTrailSources.tsx");
  assert.ok(!sources.includes("SOURCE_NOT_CHECKED"), "the unchecked note is never rendered as text");
});

test("confidence: grade wears StatusMark; every line names what would most improve it", () => {
  assert.deepEqual(CONFIDENCE_STATUS, { high: "good", medium: "okay", low: "bad" });
  assert.equal(MOST_IMPROVED_BY.ai_unbranded, "The brand's sales in every channel, by category (onboarding questions 1 and 3).");
  for (const [line, text] of Object.entries(MOST_IMPROVED_BY)) {
    assert.ok(text.endsWith("."), `${line} reads as a sentence`);
    assert.ok(!/—|n't|'re|'ll/.test(text), `${line} keeps the brand voice`);
  }
  const drawer = read("components/v3/live/estimates/EstimateTrail.tsx");
  assert.match(drawer, /<StatusMark status=\{CONFIDENCE_STATUS\[trail\.confidence\]\}/);
  assert.match(drawer, /ANALYST_ESTIMATE/);
  assert.match(drawer, /role="dialog"/);
});

test("drawer files: custom tooltips only, at or under 400 lines", () => {
  for (const file of ["EstimateTrail.tsx", "EstimateTrailInputs.tsx", "EstimateTrailSources.tsx", "EstimateTrailTrigger.tsx"]) {
    const src = read(`components/v3/live/estimates/${file}`);
    assert.ok(src.split("\n").length <= 400, `${file} is over 400 lines`);
    assert.ok(!/\stitle=/.test(src), `${file} uses a native title`);
  }
});

test("test-only route answers 404 outside the e2e dev server", () => {
  const page = read("app/(canvas)/dashboard/estimate-trail-check/page.tsx");
  assert.match(page, /E2E_AUTH_BYPASS !== "1" \|\| process\.env\.NODE_ENV === "production"\) notFound\(\)/);
});
