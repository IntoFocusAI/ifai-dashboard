// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/amazon-required-fields-migration.test.ts
//
// The seed in supabase/migrations/20261117150000_amazon_required_fields.sql must match the D-05
// lists approved in decision 100 field for field. PR 212 (worker 28.3) holds those lists in
// lib/findability/amazon-field-lists.ts but is not on main yet, so the fixture
// scripts/fixtures/d05-amazon-field-lists-pr212.json is a JSON copy of that file's
// AMAZON_FIELD_LISTS and AMAZON_NO_LIST_PRODUCT_TYPES (commit a0277096). Once PR 212 merges, the
// last test also compares the fixture with the list file on the branch.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const MIGRATION = "supabase/migrations/20261117150000_amazon_required_fields.sql";

type FixtureField = { field: string; label: string; filled: number; alsoCounts?: string[] };
type FixtureList = { productType: string; label: string; sampled: number; sourceDate: string; fields: FixtureField[] };
const fixture = JSON.parse(read("scripts/fixtures/d05-amazon-field-lists-pr212.json")) as {
  lists: FixtureList[];
  noListProductTypes: Record<string, string>;
};

type SeedRow = {
  productType: string;
  productTypeLabel: string;
  fieldId: string;
  altFieldIds: string[];
  label: string;
  sampleFilled: number;
  sampleSize: number;
  sourceDate: string;
};

const ROW =
  /^\s*\('([A-Z0-9_]+)', '([^']+)', '([a-z0-9_]+)', '\{([a-z0-9_,]*)\}', '([^']+)', (\d+), (\d+), date '(\d{4}-\d{2}-\d{2})'\),?\s*$/;

function seedRows(sql: string): SeedRow[] {
  const values = sql.match(/from \(values\n([\s\S]*?)\n\) as v \(/);
  assert.ok(values, "seed VALUES block");
  return values[1].split("\n").map((line) => {
    const m = line.match(ROW);
    assert.ok(m, `unparsed seed line: ${line}`);
    return {
      productType: m[1],
      productTypeLabel: m[2],
      fieldId: m[3],
      altFieldIds: m[4] ? m[4].split(",") : [],
      label: m[5],
      sampleFilled: Number(m[6]),
      sampleSize: Number(m[7]),
      sourceDate: m[8],
    };
  });
}

const sql = read(MIGRATION);
const rows = seedRows(sql);

function expectedRows(): SeedRow[] {
  return fixture.lists.flatMap((list) =>
    list.fields.map((f) => ({
      productType: list.productType,
      productTypeLabel: list.label,
      fieldId: f.field,
      altFieldIds: f.alsoCounts ?? [],
      label: f.label,
      sampleFilled: f.filled,
      sampleSize: list.sampled,
      sourceDate: list.sourceDate,
    })),
  );
}

test("seed matches the decision 100 lists field for field, in list order", () => {
  assert.deepEqual(rows, expectedRows());
});

test("row counts: GUITARS 17, FLASHLIGHT 22, no other product type", () => {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.productType] = (counts[r.productType] ?? 0) + 1;
  assert.deepEqual(counts, { GUITARS: 17, FLASHLIGHT: 22 });
});

test("brightness and max lumens are one FLASHLIGHT entry; no other alternates", () => {
  const withAlts = rows.filter((r) => r.altFieldIds.length > 0);
  assert.deepEqual(
    withAlts.map((r) => [r.productType, r.fieldId, r.altFieldIds]),
    [["FLASHLIGHT", "white_brightness", ["light_output_maximum"]]],
  );
  assert.ok(!rows.some((r) => r.fieldId === "light_output_maximum"));
});

test("product types with no approved list have no rows (they read Not available*)", () => {
  assert.deepEqual(Object.keys(fixture.noListProductTypes).sort(), ["ELECTRIC_LANTERN", "ELECTRIC_LIGHT"]);
  for (const type of Object.keys(fixture.noListProductTypes)) {
    assert.ok(!rows.some((r) => r.productType === type), type);
  }
});

test("primary key is unique and ORDER BY sample_filled DESC, field_id gives list order", () => {
  const keys = rows.map((r) => `${r.productType}/${r.fieldId}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const list of fixture.lists) {
    const ofType = rows.filter((r) => r.productType === list.productType);
    const sorted = [...ofType].sort((a, b) => b.sampleFilled - a.sampleFilled || a.fieldId.localeCompare(b.fieldId));
    assert.deepEqual(
      sorted.map((r) => r.fieldId),
      list.fields.map((f) => f.field),
    );
  }
});

test("migration is additive, read-only for anon, with undo and NOT APPLIED status", () => {
  assert.match(sql, /create table if not exists public\.amazon_required_fields/);
  assert.match(sql, /primary key \(product_type, field_id\)/);
  assert.match(sql, /alt_field_ids text\[\] not null default '\{\}'/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.amazon_required_fields from anon, authenticated;/);
  assert.match(sql, /grant select on public\.amazon_required_fields to anon, authenticated;/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]*to (anon|authenticated)/i);
  assert.doesNotMatch(sql, /^\s*(drop|alter table (?!public\.amazon_required_fields)|delete|update|truncate)\b/im);
  assert.match(sql, /'decision 100', date '2026-11-16'/);
  assert.match(sql, /-- How to undo\n--   DROP TABLE public\.amazon_required_fields;/);
  assert.match(sql, /-- Status: NOT APPLIED\. Additive; Brian Magazu approves/);
});

test("fixture matches lib/findability/amazon-field-lists.ts once PR 212 is merged", async (t) => {
  const path = join(root, "lib/findability/amazon-field-lists.ts");
  if (!existsSync(path) || !readFileSync(path, "utf8").includes("decision 100")) {
    t.skip("PR 212 lists not on this branch yet; the fixture is the copy from commit a0277096");
    return;
  }
  const mod = (await import("../lib/findability/amazon-field-lists.ts")) as {
    AMAZON_FIELD_LISTS: Record<string, unknown>;
    AMAZON_NO_LIST_PRODUCT_TYPES?: Record<string, string>;
  };
  assert.deepEqual(JSON.parse(JSON.stringify(Object.values(mod.AMAZON_FIELD_LISTS))), fixture.lists);
  assert.deepEqual({ ...mod.AMAZON_NO_LIST_PRODUCT_TYPES }, fixture.noListProductTypes);
});
