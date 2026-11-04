// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/amazon-specs-last-checked.test.ts
// FDD D-04: Amazon Specs shows Last checked with its heroes, the way Findability does (X-12).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC,
  findabilityLastCheckedSentence,
  LAST_CHECKED_UNAVAILABLE_LABEL,
  lastCheckedSentence,
  newestAmazonSpecCheckAt,
  newestCheckTime,
  type AmazonSpecCheckRow,
} from "../lib/findability/last-checked.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const ROWS: AmazonSpecCheckRow[] = [
  { amazon_checked: true, checked_at: "2026-10-02T08:03:00+00:00" },
  { amazon_checked: true, checked_at: "2026-10-13T18:04:08+00:00" },
  { amazon_checked: true, checked_at: "2026-10-07T23:01:30+00:00" },
];

test("Last checked is the newest stored check among checked listings, in UTC", () => {
  const iso = newestAmazonSpecCheckAt(ROWS);
  assert.equal(iso, "2026-10-13T18:04:08.000Z");
  assert.equal(lastCheckedSentence(iso), "Last checked Oct 13, 2026, 6:04 PM UTC.");
});

test("an unchecked listing does not set it, even with a later time", () => {
  const rows: AmazonSpecCheckRow[] = [
    ...ROWS,
    { amazon_checked: false, checked_at: "2026-11-01T12:00:00Z" },
    { amazon_checked: null, checked_at: "2026-11-02T12:00:00Z" },
    { checked_at: "2026-11-03T12:00:00Z" },
  ];
  assert.equal(newestAmazonSpecCheckAt(rows), "2026-10-13T18:04:08.000Z");
});

test("no checked listing with a usable time reads Not available*", () => {
  assert.equal(newestAmazonSpecCheckAt([]), null);
  assert.equal(
    newestAmazonSpecCheckAt([
      { amazon_checked: true, checked_at: null },
      { amazon_checked: true, checked_at: "   " },
      { amazon_checked: true, checked_at: "not-a-date" },
      { amazon_checked: true },
      { amazon_checked: false, checked_at: "2026-10-13T18:04:08Z" },
    ]),
    null,
  );
  assert.equal(lastCheckedSentence(null), null);
  assert.equal(LAST_CHECKED_UNAVAILABLE_LABEL, "Not available*");
  assert.match(AMAZON_SPECS_LAST_CHECKED_UNAVAILABLE_DESC, /Amazon spec read/);
});

test("the shared helper keeps the Findability sentence and accepts any checked rule", () => {
  assert.equal(
    findabilityLastCheckedSentence("2026-10-12T20:27:46.000Z"),
    "Last checked Oct 12, 2026, 8:27 PM UTC.",
  );
  const rows = [
    { ok: true, at: "2026-01-01T00:00:00Z" },
    { ok: false, at: "2026-06-01T00:00:00Z" },
    { ok: true, at: "2026-03-01T00:00:00Z" },
  ];
  assert.equal(
    newestCheckTime(rows, (row) => row.ok, (row) => row.at),
    "2026-03-01T00:00:00.000Z",
  );
});

test("Amazon Specs reads its rows once and shows the line beside its heroes", () => {
  const catalog = read("components/v3/live/CatalogReadinessSpec.tsx");
  assert.equal(catalog.match(/useAmazonSpecRows\(\)/g)?.length, 1);
  assert.match(catalog, /<AiReadinessLead bundle=\{bundle\} specRows=\{specRows\} \/>/);
  assert.match(catalog, /<FenderSpecPanel catalogReadiness read=\{specRows\} \/>/);

  const lead = read("components/v3/live/AiReadinessLead.tsx");
  assert.match(lead, /<AmazonSpecsLastChecked read=\{specRows\} \/>/);
  assert.doesNotMatch(lead, /specRowsQuery|loadFilteredPages/);

  const panel = read("components/v3/live/FenderSpecPanel.tsx");
  assert.equal(panel.match(/specRowsQuery\(/g)?.length, 1);

  const line = read("components/v3/live/AmazonSpecsLastChecked.tsx");
  assert.match(line, /newestAmazonSpecCheckAt/);
  assert.match(line, /data-amazon-specs-last-checked=/);
  assert.match(line, /className="findability-last-checked amazon-specs-last-checked"/);
  assert.match(line, /className="ifai-term"/);
  assert.match(line, /data-ifai-tooltip-desc=\{description\}/);
  assert.match(line, /tabIndex=\{0\}/);
  for (const source of [catalog, lead, line]) {
    assert.doesNotMatch(source, /(?<![\w-])title=/);
    assert.doesNotMatch(source, /\u2014/);
  }
});
