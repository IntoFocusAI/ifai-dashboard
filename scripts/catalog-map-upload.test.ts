// npm test -- or: node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/catalog-map-upload.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { approvalPatch, nameProblem, pendingInsert } from "../lib/upload/approval.ts";
import {
  classifySheet,
  keysInPendingPayload,
  rowSummary,
  toStagedPayload,
} from "../lib/upload/classify-rows.ts";
import { parseSheet } from "../lib/upload/parse-sheet.ts";
import { isStagingTableAbsent } from "../lib/upload/staging-error.ts";
import { STAGED_TABLE } from "../lib/upload/types.ts";
import { UPLOAD_PAGE, UPLOAD_PATH } from "../app/(canvas)/dashboard/upload/upload-copy.ts";

const CSV = ["sku,name", "A,One", "B,Two", "A,One again"].join("\n");

function sheetFrom(text: string, fileName = "catalog.csv") {
  const parsed = parseSheet(text, fileName);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.sheet;
}

test("a repeated key in a CSV is a duplicate and stays out of the pending set", () => {
  const sheet = sheetFrom(CSV);
  const result = classifySheet(sheet, []);
  assert.equal(result.keyColumn, "sku");
  assert.equal(result.keyFromFirstColumn, false);
  assert.deepEqual(
    result.rows.map((row) => [row.key, row.disposition, row.duplicateReason]),
    [
      ["A", "pending", null],
      ["B", "pending", null],
      ["A", "duplicate", "in_file"],
    ],
  );
  assert.deepEqual(
    result.pending.map((row) => row.key),
    ["A", "B"],
  );
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].cells.name, "One again");
  const payload = toStagedPayload(sheet, result);
  assert.deepEqual(
    payload.pending.map((row) => row.key),
    ["A", "B"],
  );
  assert.equal(payload.duplicates[0].reason, "in_file");
  assert.deepEqual(keysInPendingPayload(payload), ["A", "B"]);
});

test("a TSV uses the same duplicate rule, including a comma inside a field", () => {
  const text = ["sku\tname", "0141000000\tPlayer, Strat", "0141000000\tAgain"].join("\n");
  const sheet = sheetFrom(text, "map.tsv");
  assert.equal(sheet.format, "tsv");
  assert.equal(sheet.rows[0].cells.name, "Player, Strat");
  const result = classifySheet(sheet, []);
  assert.equal(result.pending.length, 1);
  assert.equal(result.duplicates[0].duplicateReason, "in_file");
});

test("quotes, a byte order mark, and a different case still count as one key", () => {
  const text = "\uFEFFsku,name\r\n\"0141000000\",\"Player, Strat\"\r\nabc,First\r\nABC,Second\r\n";
  const sheet = sheetFrom(text);
  assert.equal(sheet.rows[0].cells.name, "Player, Strat");
  const result = classifySheet(sheet, []);
  assert.equal(result.pending.length, 2);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].key, "ABC");
  assert.equal(result.duplicates[0].duplicateReason, "in_file");
});

test("a key already staged is a duplicate, including the first row in the file", () => {
  const sheet = sheetFrom(CSV);
  const result = classifySheet(sheet, [" a "]);
  assert.deepEqual(
    result.rows.map((row) => [row.key, row.disposition, row.duplicateReason]),
    [
      ["A", "duplicate", "staged"],
      ["B", "pending", null],
      ["A", "duplicate", "staged"],
    ],
  );
  assert.deepEqual(
    result.pending.map((row) => row.key),
    ["B"],
  );
});

test("a row with no key stays out of the pending set and is not called a duplicate", () => {
  const sheet = sheetFrom(["sku,name", ",No key", "C,Kept"].join("\n"));
  const result = classifySheet(sheet, []);
  assert.equal(result.missingKey.length, 1);
  assert.equal(result.duplicates.length, 0);
  assert.deepEqual(
    result.pending.map((row) => row.key),
    ["C"],
  );
  assert.equal(rowSummary(2, 1, 0, 1), "1 of 2 rows pending. 0 duplicates are kept out of the pending set. 1 row has no key.");
});

test("Product SKU is the key even when it is not the first column", () => {
  const sheet = sheetFrom(["Name,Product SKU", "Guitar,ABC"].join("\n"));
  const result = classifySheet(sheet, []);
  assert.equal(result.keyColumn, "Product SKU");
  assert.equal(result.pending[0].key, "ABC");
});

test("an empty file, a header only, and a spreadsheet are refused", () => {
  assert.equal(parseSheet("", "catalog.csv").ok, false);
  assert.equal(parseSheet("sku,name\n", "catalog.csv").ok, false);
  const spreadsheet = parseSheet("not really", "prices.xlsx");
  assert.equal(spreadsheet.ok, false);
  if (!spreadsheet.ok) assert.match(spreadsheet.error, /CSV and TSV/);
});

test("the save writes a pending staging row and approval touches only the approval columns", () => {
  const sheet = sheetFrom(CSV);
  const result = classifySheet(sheet, []);
  const inserted = pendingInsert({
    kind: "catalog",
    fileName: "catalog.csv",
    payload: toStagedPayload(sheet, result),
    name: "Ada",
  });
  assert.deepEqual(Object.keys(inserted).sort(), ["created_by_name", "file_name", "kind", "payload", "status"]);
  assert.equal(inserted.status, "pending");
  assert.equal(inserted.created_by_name, "Ada");
  assert.equal(pendingInsert({ ...inserted, kind: "map", fileName: "m.csv", payload: inserted.payload, name: "a" }).created_by_name, null);

  const patch = approvalPatch("Ada Lovelace", "2026-11-05T18:00:00.000Z");
  assert.deepEqual(Object.keys(patch).sort(), ["approved_at", "approved_by_name", "status"]);
  assert.equal(patch.status, "approved");
  assert.equal(nameProblem(""), "Enter your name.");
  assert.equal(nameProblem("Ada"), null);
});

test("a missing staging table is Not available, and other failures are not", () => {
  assert.equal(isStagingTableAbsent({ code: "PGRST205", message: "Could not find the table 'public.staged_sheet_uploads' in the schema cache" }), true);
  assert.equal(isStagingTableAbsent({ code: "42P01", message: 'relation "public.staged_sheet_uploads" does not exist' }), true);
  assert.equal(isStagingTableAbsent({ code: "42501", message: "permission denied for table staged_sheet_uploads" }), false);
  assert.equal(isStagingTableAbsent({ message: "Failed to fetch" }), false);
  assert.equal(isStagingTableAbsent(null), false);
});

test("the staging store names only the new table", () => {
  const source = readFileSync("lib/upload/staged-store.ts", "utf8");
  assert.match(source, new RegExp(`from\\(${STAGED_TABLE}\\)|from\\(STAGED_TABLE\\)`));
  assert.doesNotMatch(source, /fmic_|canvas_|buybox_map|dealer_catalog|electric_catalog/);
  assert.equal(STAGED_TABLE, "staged_sheet_uploads");
});

test("the migration adds one table and does not change an existing object", () => {
  const raw = readFileSync("supabase/migrations/20261105181000_staged_sheet_uploads.sql", "utf8");
  assert.match(raw, /drop table public\.staged_sheet_uploads/i);
  assert.match(raw, /Brian Magazu/);
  const sql = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
  assert.match(sql, /create table public\.staged_sheet_uploads/i);
  assert.doesNotMatch(sql, /fmic_|canvas_|buybox_map|dealer_catalog|electric_catalog/);
  const alters = sql.match(/alter table\s+[\w.]+/gi) ?? [];
  assert.ok(alters.length >= 1);
  for (const alter of alters) assert.match(alter, /public\.staged_sheet_uploads/i);
  const grants = sql.match(/^\s*grant\b[^;]*;/gim) ?? [];
  assert.ok(grants.length >= 1);
  for (const grant of grants) assert.match(grant, /staged_sheet_uploads/i);
  assert.match(sql, /grant update \(status, approved_by_name, approved_at\)/i);
  assert.doesNotMatch(sql, /\bdrop table\b/i);
});

test("the upload page says approval does not change the live catalog", () => {
  assert.equal(UPLOAD_PATH, "/dashboard/upload");
  assert.equal(
    UPLOAD_PAGE.approveLine,
    "Approved here means the file is accepted. It does not change the live catalog yet.",
  );
  const page = readFileSync("app/(canvas)/dashboard/upload/page.tsx", "utf8");
  assert.match(page, /UPLOAD_PAGE\.approveLine/);
  assert.match(page, /DASHBOARD_PATH/);
  assert.match(page, /UploadThemeRoot/);
  for (const line of Object.values(UPLOAD_PAGE)) {
    assert.doesNotMatch(line, /\u2014/);
    assert.doesNotMatch(line, /!/);
    assert.doesNotMatch(line, /\b(fees?|retainers?|monthly)\b/i);
  }
});

test("new upload files do not put an em dash in the client UI", () => {
  const files = [
    "app/(canvas)/dashboard/upload/page.tsx",
    "app/(canvas)/dashboard/upload/UploadWorkspace.tsx",
    "app/(canvas)/dashboard/upload/UploadPreview.tsx",
    "app/(canvas)/dashboard/upload/UploadStagedList.tsx",
    "app/(canvas)/dashboard/upload/upload-copy.ts",
    "app/(canvas)/dashboard/upload/upload-term.tsx",
    "lib/upload/labels.ts",
    "lib/upload/classify-rows.ts",
  ];
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /\u2014/, file);
    assert.doesNotMatch(readFileSync(file, "utf8"), /\stitle=/, file);
  }
});
