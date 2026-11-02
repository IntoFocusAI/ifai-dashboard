// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/spec-missing-field-share.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MISSING_FIELD_COUNT_POPULATION,
  MISSING_FIELD_SHARE_UNAVAILABLE,
  presentMissingFieldShare,
} from "../lib/fender-canvas/spec-missing-fields.ts";
import { formatPct, formatRatio, pendingLabel } from "../lib/fender-canvas/format.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("a missing-field row shows N of M and a percent when the checked total matches", () => {
  const share = presentMissingFieldShare(89, 989);
  assert.equal(share.kind, "share");
  if (share.kind !== "share") return;
  assert.equal(share.ratio, formatRatio(89, 989));
  assert.equal(share.percent, formatPct((100 * 89) / 989));
  assert.equal(share.label, `${formatRatio(89, 989)} (${formatPct((100 * 89) / 989)})`);
  assert.ok(share.barPct > 0);
  assert.ok(share.barPct < 100);
  assert.notEqual(share.percent, "0.0%");
  assert.notEqual(share.percent, MISSING_FIELD_SHARE_UNAVAILABLE);
});

test("a missing checked total does not become 0% or a full bar", () => {
  for (const checked of [null, undefined, 0, Number.NaN, -1]) {
    const share = presentMissingFieldShare(40, checked);
    assert.equal(share.kind, "count-only");
    if (share.kind !== "count-only") continue;
    assert.equal(share.label, `40 ${MISSING_FIELD_COUNT_POPULATION}`);
    assert.equal(share.shareLabel, MISSING_FIELD_SHARE_UNAVAILABLE);
    assert.equal(share.barPct, null);
    assert.doesNotMatch(share.label, /0\.0%|0%/);
  }
});

test("a count above the checked total is not paired as a share", () => {
  const share = presentMissingFieldShare(40, 10);
  assert.equal(share.kind, "count-only");
  if (share.kind !== "count-only") return;
  assert.equal(share.shareLabel, MISSING_FIELD_SHARE_UNAVAILABLE);
  assert.equal(share.barPct, null);
  assert.match(share.label, new RegExp(MISSING_FIELD_COUNT_POPULATION));
});

test("a missing sku_count stays pending without inventing a zero share", () => {
  for (const count of [null, undefined, Number.NaN]) {
    const share = presentMissingFieldShare(count, 925);
    assert.equal(share.kind, "pending");
    if (share.kind !== "pending") continue;
    assert.equal(share.label, pendingLabel());
    assert.equal(share.shareLabel, MISSING_FIELD_SHARE_UNAVAILABLE);
    assert.equal(share.barPct, null);
  }
});

test("Amazon Specs wires spec_checked into the missing-field rows and bars", () => {
  const panel = read("components/v3/live/FenderSpecPanel.tsx");
  const catalog = read("components/v3/live/CatalogReadinessSpec.tsx");
  const helper = read("lib/fender-canvas/spec-missing-fields.ts");

  assert.match(helper, /presentMissingFieldShare/);
  assert.match(helper, /MISSING_FIELD_SHARE_UNAVAILABLE/);
  assert.match(panel, /presentMissingFieldShare/);
  assert.match(panel, /specChecked/);
  assert.match(panel, /data-spec-missing-count/);
  assert.match(panel, /data-spec-missing-bar-empty/);
  assert.doesNotMatch(panel, /maxCount/);
  assert.doesNotMatch(panel, /formatInt\(row\.sku_count\)\} SKUs/);
  assert.match(catalog, /specChecked=\{bundle\.m\.spec_checked\}/);
});

test("Amazon Specs puts Top missing fields beside the completeness hero", () => {
  const catalog = read("components/v3/live/CatalogReadinessSpec.tsx");
  const panel = read("components/v3/live/FenderSpecPanel.tsx");
  const brandSite = read("components/v3/live/MachineReadabilityPanel.tsx");
  const css = read("lib/canvas-sdk/canvas-sdk.css");

  assert.match(catalog, /data-amazon-specs-band/);
  assert.match(catalog, /display:\s*"flex"/);
  assert.match(catalog, /flexWrap:\s*"wrap"/);
  assert.match(catalog, /alignItems:\s*"flex-start"/);
  assert.match(catalog, /MissingFieldList/);
  assert.match(catalog, /AiReadinessLead/);
  assert.match(panel, /export function MissingFieldList/);
  assert.match(panel, /flex:\s*"1 1 240px"/);
  assert.match(panel, /minWidth:\s*200/);
  assert.match(
    panel,
    /className="content-box spec-missing-fields-box"[\s\S]*?style=\{\{\s*flex:\s*"1 1 240px",\s*minWidth:\s*200\s*\}\}/,
  );
  // Same horizontal-band idea as Brand-Site Specs (hero/explainer row, table below).
  assert.match(brandSite, /alignItems:\s*"flex-start"/);
  assert.match(brandSite, /flex:\s*"1 1 240px"/);
  assert.match(catalog, /data-amazon-specs-hero-col/);
  assert.match(catalog, /flex:\s*"1 1 42%"/);
  assert.match(catalog, /maxWidth:\s*"50%"/);
  assert.match(catalog, /minWidth:\s*"max-content"/);
  assert.match(css, /\[data-amazon-specs-band\]\s*\.findability-lead-card/);
  assert.match(css, /\[data-amazon-specs-hero\]\s*\.findability-lead-row\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(
    css,
    /\[data-spec-missing-fields-box\]\s*\.readiness-progress-bar\s*\{[^}]*max-width:\s*180px/,
  );
});
