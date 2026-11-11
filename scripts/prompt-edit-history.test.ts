// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/prompt-edit-history.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PROMPT_HISTORY_HEADER,
  PROMPT_HISTORY_NOTE,
  PROMPT_HISTORY_TIPS,
  PROMPT_HISTORY_UNAVAILABLE,
  formatPromptEditWhen,
  loadPromptEditHistory,
  promptEditActionLabel,
  promptEditCells,
  promptEditCountLabel,
  promptEditHistoryFromRpc,
  promptEditSide,
  promptEditsFor,
  promptHistoryFunctionMissing,
} from "../lib/ai-search/prompt-edit-history.ts";

/* FDD A-08: the Prompts screen shows each prompt's change history from
   command.fmic_ai_prompt_edits, through one additive read function. Until that function is
   applied the screen says the history is not available. It never invents a row. */

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(`${root}${path}`, "utf8");

const edit = {
  id: "6c0e1b2a-4d5f-4a6b-8c7d-111111111111",
  edited_at: "2026-11-04T13:27:19.699Z",
  action: "edit",
  prompt_key: "p01",
  before: { prompt_text: "Best electric guitar under $900", category: "electrics" },
  after: { prompt_text: "Best electric guitar under $700 for a beginner", category: "electrics" },
};

const add = {
  id: "6c0e1b2a-4d5f-4a6b-8c7d-222222222222",
  edited_at: "2026-11-01T15:00:00.000Z",
  action: "add",
  prompt_key: "p01",
  before: null,
  after: { prompt_text: "Best electric guitar under $900", category: "electrics", prompt_kind: "commercial", active: true },
};

const remove = {
  id: "6c0e1b2a-4d5f-4a6b-8c7d-333333333333",
  edited_at: "2026-11-02T15:00:00.000Z",
  action: "remove",
  prompt_key: "p02",
  before: { active: true },
  after: { active: false },
};

test("a missing function reads as not applied yet, and any other failure as a failed read", () => {
  const missing = { code: "PGRST202", message: "Could not find the function public.ai_prompt_edits_list(p_prompt_key) in the schema cache" };
  assert.equal(promptHistoryFunctionMissing(missing), true);
  assert.equal(promptHistoryFunctionMissing({ code: "42883", message: "function does not exist" }), true);
  assert.equal(promptHistoryFunctionMissing({ code: "57014", message: "canceling statement due to statement timeout" }), false);
  assert.deepEqual(promptEditHistoryFromRpc(null, missing), { status: "unavailable", reason: "missing" });
  assert.deepEqual(promptEditHistoryFromRpc(null, { message: "timeout" }), { status: "unavailable", reason: "failed" });
  assert.deepEqual(promptEditHistoryFromRpc(null, null), { status: "unavailable", reason: "failed" });
  assert.deepEqual(promptEditHistoryFromRpc({ rows: [edit] }, null), { status: "unavailable", reason: "failed" });
  assert.deepEqual(promptEditHistoryFromRpc(["not-a-row"], null), { status: "unavailable", reason: "failed" });
  assert.deepEqual(promptEditHistoryFromRpc([{ ...edit, before: "old wording" }], null), { status: "unavailable", reason: "failed" });
  assert.equal(PROMPT_HISTORY_UNAVAILABLE, "Not available*");
  assert.match(PROMPT_HISTORY_TIPS.missing, /not applied to the database yet/);
  assert.match(PROMPT_HISTORY_TIPS.failed, /could not be read/);
});

test("an empty log is a real read with no rows", () => {
  assert.deepEqual(promptEditHistoryFromRpc([], null), { status: "ready", rows: [] });
  assert.equal(promptEditCountLabel(0), "No changes");
  assert.equal(promptEditCountLabel(1), "1 change");
  assert.equal(promptEditCountLabel(3), "3 changes");
});

test("stored edits keep their time, action, and wording, newest first per prompt", () => {
  const history = promptEditHistoryFromRpc([add, remove, edit], null);
  assert.equal(history.status, "ready");
  if (history.status !== "ready") return;
  assert.deepEqual(
    promptEditsFor(history.rows, "p01").map((row) => row.action),
    ["edit", "add"],
  );
  assert.deepEqual(
    promptEditsFor(history.rows, "p02").map((row) => row.action),
    ["remove"],
  );
  assert.deepEqual(promptEditsFor(history.rows, "p99"), []);
  assert.equal(promptEditActionLabel("edit"), "Edited");
  assert.equal(promptEditActionLabel("add"), "Added");
  assert.equal(promptEditActionLabel("remove"), "Removed");
  assert.equal(promptEditActionLabel("restore"), "Restored");
  assert.equal(promptEditActionLabel("rename"), "rename");
  assert.equal(promptEditSide(edit.before), "Best electric guitar under $900\nCategory: electrics");
  assert.equal(promptEditSide(null), "None");
  assert.equal(promptEditSide({ active: true }), "Asked");
  assert.equal(promptEditSide({ active: false }), "Not asked");
  assert.equal(formatPromptEditWhen(edit.edited_at), "Nov 4, 2026, 1:27 PM UTC");
  assert.equal(formatPromptEditWhen("not-a-date"), "not-a-date");
  assert.deepEqual([...PROMPT_HISTORY_HEADER], ["Time", "Change", "Before", "After"]);
  assert.deepEqual(promptEditCells(history.rows.find((row) => row.action === "edit")!), [
    "Nov 4, 2026, 1:27 PM UTC",
    "Edited",
    "Best electric guitar under $900\nCategory: electrics",
    "Best electric guitar under $700 for a beginner\nCategory: electrics",
  ]);
});

test("one read returns every prompt's edits, and a thrown read is a failed read", async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const ok = await loadPromptEditHistory(null, {
    rpc: (fn, args) => {
      calls.push([fn, args]);
      return Promise.resolve({ data: [edit], error: null });
    },
  });
  assert.deepEqual(calls, [["ai_prompt_edits_list", { p_prompt_key: null }]]);
  assert.equal(ok.status, "ready");
  const thrown = await loadPromptEditHistory("p01", {
    rpc: () => {
      throw new Error("network");
    },
  });
  assert.deepEqual(thrown, { status: "unavailable", reason: "failed" });
});

test("the migration adds one read function, grants execute only on it, and says how to undo it", () => {
  const sql = read("supabase/migrations/20261109233000_ai_prompt_edits_list.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ai_prompt_edits_list\(p_prompt_key text\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO ''/);
  assert.match(sql, /\bSTABLE\b/);
  const body = sql.slice(sql.indexOf("AS $$"), sql.indexOf("$$;"));
  assert.match(body, /FROM command\.fmic_ai_prompt_edits e/);
  assert.equal(body.match(/\bFROM\b/g)?.length, 1);
  assert.doesNotMatch(body, /\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(body, /e\.source/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ai_prompt_edits_list\(text\) FROM PUBLIC;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ai_prompt_edits_list\(text\) TO %I/);
  assert.match(sql, /ARRAY\['anon', 'authenticated', 'service_role'\]/);
  assert.match(sql, /How to undo/);
  assert.match(sql, /DROP FUNCTION public\.ai_prompt_edits_list\(text\);/);
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /Brian Magazu/);
  const statements = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  assert.doesNotMatch(statements, /ALTER TABLE|DROP TABLE|DROP VIEW|CREATE TABLE|ALTER VIEW/i);
  assert.doesNotMatch(statements, /ai_prompt_save|ai_prompt_set_active|FUNCTION public\.ai_prompts_list/);
});

test("the Prompts screen shows the history from the log only, with custom tooltips and brand voice", () => {
  const editor = read("components/v3/prompts/PromptsEditor.tsx");
  const history = read("components/v3/prompts/PromptHistory.tsx");
  const lib = read("lib/ai-search/prompt-edit-history.ts");
  assert.match(editor, /<PromptHistoryNotice history=\{history\} \/>/);
  assert.match(editor, /setHistory\(await loadPromptEditHistory\(\)\)/);
  assert.match(editor, /edits && historyKey === key \? <PromptHistory promptKey=\{key\} rows=\{promptEditsFor\(edits, key\)\} \/> : null/);
  // The toggle exists only once the log was read, so no prompt shows a Not available* row of its own.
  assert.match(editor, /const edits = history\?\.status === "ready" \? history\.rows : null;/);
  assert.match(history, /tableId="prompt-history"/);
  assert.match(history, /exportScope=\{\{ promptKey \}\}/);
  assert.match(history, /className="ifai-term"/);
  assert.match(history, /data-ifai-tooltip-desc=\{tip\}/);
  assert.doesNotMatch(history, /\stitle=/);
  assert.match(lib, /rpc\("ai_prompt_edits_list", \{ p_prompt_key: promptKey \}\)/);
  assert.equal(PROMPT_HISTORY_NOTE, "A run keeps the questions it asked. A later edit does not change that run.");
  for (const file of [
    "components/v3/prompts/PromptsEditor.tsx",
    "components/v3/prompts/PromptHistory.tsx",
    "components/v3/prompts/prompts-editor.css",
    "lib/ai-search/prompt-edit-history.ts",
    "lib/export/prompt-history-export.ts",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /—/, `em dash in ${file}`);
    assert.doesNotMatch(source, /font-weight:\s*[7-9]00/, `weight above 600 in ${file}`);
    assert.doesNotMatch(source, /ui-monospace|SFMono/, `system monospace in ${file}`);
  }
  // Ledlenser's prompt list stays read-only: its profile has no editor, so no history read runs.
  assert.match(read("lib/client/active-client.ts"), /ledlenser: \{[\s\S]*?promptsEditable: false/);
  assert.match(read("lib/export/prompt-history-export.ts"), /if \(!activeClient\(\)\.promptsEditable\)/);
});
