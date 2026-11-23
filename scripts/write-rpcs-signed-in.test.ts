// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/write-rpcs-signed-in.test.ts
// 1.6 Step 0a: the five write functions are not callable with the anon key, so the dashboard
// must call them with the signed-in session, and the migration must close all five.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { errorText, SIGN_IN_TO_SAVE_MESSAGE } from "../lib/set-aside/set-aside.ts";

const WRITE_RPCS = ["ai_prompt_save", "ai_prompt_set_active", "mark_issue_done", "set_aside_issue", "reopen_set_aside"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

test("migration revokes anon and PUBLIC execute on all five write functions", () => {
  const sql = readFileSync("supabase/migrations/20261118190000_write_rpcs_no_anon.sql", "utf8");
  for (const fn of WRITE_RPCS) {
    assert.match(sql, new RegExp(`^revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon;`, "m"), fn);
    assert.match(sql, new RegExp(`^grant execute on function public\\.${fn}\\([^)]*\\) to authenticated, service_role;`, "m"), fn);
  }
  assert.match(sql, /^-- Undo/m);
});

test("no app code calls a write function with the anon client", () => {
  for (const file of [...sourceFiles("lib"), ...sourceFiles("components"), ...sourceFiles("app")]) {
    const src = readFileSync(file, "utf8");
    if (!WRITE_RPCS.some((fn) => src.includes(`"${fn}"`))) continue;
    assert.ok(src.includes("getSessionSupabase"), `${file} calls a write function but not with getSessionSupabase()`);
    assert.doesNotMatch(src, /getPublicCanvasSupabase\(\)\s*\.rpc\(/, `${file} calls rpc on the anon client`);
    assert.doesNotMatch(src, /getPublicCanvasSupabase\(\)\.rpc\(fn/, `${file} routes rpc through the anon client`);
  }
});

test("a signed-out save shows the sign-in message", () => {
  assert.equal(errorText({ code: "42501", message: "permission denied for function set_aside_issue" }), SIGN_IN_TO_SAVE_MESSAGE);
  assert.equal(errorText({ message: "permission denied for function mark_issue_done" }), SIGN_IN_TO_SAVE_MESSAGE);
  assert.equal(errorText({ message: "Unknown check." }), "Unknown check.");
});
