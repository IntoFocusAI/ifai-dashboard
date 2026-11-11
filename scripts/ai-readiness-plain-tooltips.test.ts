// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-readiness-plain-tooltips.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  amazonCompletenessHero,
  FENDER_CHECK_DIFFERS,
  fenderCompletenessHero,
  missingAdditionalPropertyHero,
  PAGE_FOUND_DEFINITION,
  pageFoundHero,
} from "../lib/fender-canvas/ai-readiness-lead.ts";
import { loadSpecCheckRunAt, SPEC_CHECK_JOB, type SpecCheckClient } from "../lib/fender-canvas/page-found-checked-at.ts";
import { brandSitePageFoundHero, PAGE_FOUND_UNAVAILABLE_TIP } from "../lib/fender-canvas/page-found-hero.ts";
import { REASON_COLUMN_TOOLTIP } from "../lib/fender-canvas/page-found-reasons.ts";
import { STORED_REASONS } from "../lib/fender-canvas/page-found-stored-reason.ts";
import type { CanvasMetricsRow } from "../lib/fender-canvas/types.ts";
import {
  AMAZON_SPECS_LAST_CHECKED_FAILED_DESC,
  AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC,
} from "../lib/findability/last-checked.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const M = {
  spec_checked: 1037,
  spec_fender_found: 627,
  spec_fender_found_pct: 60.5,
  spec_avg_amazon_pct: 88.1,
  spec_avg_fender_pct: 71.2,
  spec_missing_additional_property: 627,
} as CanvasMetricsRow;

const AT = "2026-11-04T15:04:28.676+00:00";
const WHEN = "Last checked Nov 4, 2026, 3:04 PM UTC.";
const INTERNAL = /spec read|collector|stored row|\bolder\b|\bstored\b|this read/i;

function tooltips(checkedAt: string | null): string[] {
  return [
    pageFoundHero(M, checkedAt).definition!,
    brandSitePageFoundHero(M, checkedAt).definition,
    amazonCompletenessHero(M, null, checkedAt).definition!,
    fenderCompletenessHero(M, checkedAt).definition!,
    missingAdditionalPropertyHero(M, checkedAt).definition!,
  ];
}

test("AI Readiness hero and page-found tooltips use plain words, no internal read names", () => {
  const all = [
    ...tooltips(null),
    ...tooltips(AT),
    PAGE_FOUND_UNAVAILABLE_TIP,
    REASON_COLUMN_TOOLTIP.description,
    AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC,
    AMAZON_SPECS_LAST_CHECKED_FAILED_DESC,
    ...Object.values(STORED_REASONS).map((reason) => reason.definition),
    brandSitePageFoundHero(M).explainer,
    brandSitePageFoundHero(null).explainer,
  ];
  for (const text of all) assert.doesNotMatch(text, INTERNAL, text);
  for (const path of ["lib/fender-canvas/minimal-metrics-readiness.ts", "components/v3/live/FenderSpecNarratives.tsx"]) {
    assert.doesNotMatch(read(path), /spec read|stored row|\bolder\b|collector/i, path);
  }
  assert.doesNotMatch(read("components/v3/live/FenderSpecNarratives.tsx"), /SchemaExplanation/);
});

test("each hero says what was counted, out of what, and when it was checked", () => {
  assert.equal(
    pageFoundHero(M, AT).definition,
    `Checked SKUs with a matching fender.com product page, out of every SKU the fender.com product check covered. ${WHEN} ${FENDER_CHECK_DIFFERS}`,
  );
  assert.equal(brandSitePageFoundHero(M, AT).definition, pageFoundHero(M, AT).definition);
  assert.equal(PAGE_FOUND_DEFINITION, pageFoundHero(M).definition);
  assert.doesNotMatch(PAGE_FOUND_DEFINITION, /Last checked/);
  for (const text of tooltips(AT)) {
    assert.ok(text.includes(WHEN), text);
    assert.match(text, /out of|averaged across/, text);
  }
  assert.match(amazonCompletenessHero(M, null, AT).definition!, /Amazon listings of the 1,037 checked SKUs/);
});

test("the two checks can differ is said once, on the page-found figures only", () => {
  const count = (text: string) => text.split(FENDER_CHECK_DIFFERS).length - 1;
  assert.equal(count(pageFoundHero(M, AT).definition!), 1);
  assert.equal(count(REASON_COLUMN_TOOLTIP.description), 1);
  assert.equal(count(amazonCompletenessHero(M, null, AT).definition!), 0);
  assert.equal(
    FENDER_CHECK_DIFFERS,
    "This is the fender.com product check; the Findability tab runs its own official-page check, so the two can differ.",
  );
});

function freshnessClient(data: unknown, error: { message: string } | null = null): SpecCheckClient {
  return {
    from: (view) => {
      assert.equal(view, "canvas_freshness");
      return {
        select: (columns) => {
          assert.equal(columns, "job_key,last_run_at");
          return {
            eq: (column, value) => {
              assert.equal(column, "job_key");
              assert.equal(value, SPEC_CHECK_JOB);
              return Promise.resolve({ data, error });
            },
          };
        },
      };
    },
  };
}

test("Brand-Site Specs dates the page-found tooltip from the fender.com product check's last run", async () => {
  assert.equal(SPEC_CHECK_JOB, "spec_readiness");
  assert.equal(await loadSpecCheckRunAt(freshnessClient([{ job_key: "spec_readiness", last_run_at: AT }])), AT);
  assert.equal(await loadSpecCheckRunAt(freshnessClient([])), null);
  assert.equal(await loadSpecCheckRunAt(freshnessClient(null)), null);
  assert.equal(await loadSpecCheckRunAt(freshnessClient([{ job_key: "spec_readiness", last_run_at: "not a time" }])), null);
  assert.equal(await loadSpecCheckRunAt(freshnessClient([{ job_key: "spec_readiness", last_run_at: null }])), null);
  await assert.rejects(loadSpecCheckRunAt(freshnessClient(null, { message: "boom" })), /canvas_freshness: boom/);
  assert.match(read("components/v3/live/MachineReadabilityPanel.tsx"), /brandSitePageFoundHero\(metrics, useSpecCheckRunAt\(\), pageFoundRowsStale\(summary\)\)/);
  assert.match(read("components/v3/live/useSpecCheckRunAt.ts"), /loadSpecCheckRunAt\(\)/);
  const lead = read("components/v3/live/AiReadinessLead.tsx");
  assert.match(lead, /newestAmazonSpecCheckAt\(rows\)/);
  assert.match(lead, /amazonSpecsHeroes\(bundle\.m, metricsTotals \?\? rowTotals, checkedAt\)/);
});
