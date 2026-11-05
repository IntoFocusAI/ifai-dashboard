// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/prompt-edit-history.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PROMPT_HISTORY_NOTE,
  PROMPT_HISTORY_UNAVAILABLE,
  formatPromptEditWhen,
  promptEditActionLabel,
  promptEditHistoryFromRpc,
  promptEditSide,
} from "../lib/ai-search/prompt-edit-history.ts";

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

test("the history sentence is the approved line", () => {
  assert.equal(
    PROMPT_HISTORY_NOTE,
    "A run keeps the questions it asked. A later edit does not change that run.",
  );
});

test("a failed or unreadable log is unavailable and adds no rows", () => {
  assert.deepEqual(promptEditHistoryFromRpc(null, { message: "function does not exist" }), {
    status: "unavailable",
  });
  assert.deepEqual(promptEditHistoryFromRpc(null, null), { status: "unavailable" });
  assert.deepEqual(promptEditHistoryFromRpc({ rows: [edit] }, null), { status: "unavailable" });
  assert.deepEqual(promptEditHistoryFromRpc(["not-a-row"], null), { status: "unavailable" });
  assert.deepEqual(
    promptEditHistoryFromRpc([{ ...edit, before: "old wording" }], null),
    { status: "unavailable" },
  );
});

test("an empty log is a real read with no rows", () => {
  assert.deepEqual(promptEditHistoryFromRpc([], null), { status: "ready", rows: [] });
});

test("stored edits keep their time, action, and wording", () => {
  const history = promptEditHistoryFromRpc(
    [
      edit,
      {
        id: "6c0e1b2a-4d5f-4a6b-8c7d-222222222222",
        edited_at: "2026-11-01T15:00:00.000Z",
        action: "add",
        prompt_key: "p01",
        before: null,
        after: {
          prompt_text: "Best electric guitar under $900",
          category: "electrics",
          prompt_kind: "commercial",
          active: true,
        },
      },
      {
        id: "6c0e1b2a-4d5f-4a6b-8c7d-333333333333",
        edited_at: "2026-11-02T15:00:00.000Z",
        action: "remove",
        prompt_key: "p01",
        before: { active: true },
        after: { active: false },
      },
      {
        id: "6c0e1b2a-4d5f-4a6b-8c7d-444444444444",
        edited_at: "2026-11-03T15:00:00.000Z",
        action: "restore",
        prompt_key: "p01",
        before: { active: false },
        after: { active: true },
      },
    ],
    null,
  );
  assert.equal(history.status, "ready");
  if (history.status !== "ready") return;
  assert.equal(history.rows.length, 4);
  assert.deepEqual(
    history.rows.map((row) => row.action),
    ["edit", "add", "remove", "restore"],
  );
  assert.equal(promptEditActionLabel("edit"), "Edited");
  assert.equal(promptEditActionLabel("add"), "Added");
  assert.equal(promptEditActionLabel("remove"), "Removed");
  assert.equal(promptEditActionLabel("restore"), "Restored");
  assert.equal(promptEditActionLabel("rename"), "rename");
  assert.equal(promptEditSide(edit.before), "Best electric guitar under $900\nCategory: electrics");
  assert.equal(
    promptEditSide(edit.after),
    "Best electric guitar under $700 for a beginner\nCategory: electrics",
  );
  assert.equal(promptEditSide(null), "None");
  assert.equal(promptEditSide({ active: true }), "Asked");
  assert.equal(promptEditSide({ active: false }), "Not asked");
  assert.equal(history.rows[0].edited_at, edit.edited_at);
  const shown = formatPromptEditWhen(edit.edited_at);
  assert.notEqual(shown, "");
  assert.notEqual(shown, edit.edited_at);
  assert.equal(formatPromptEditWhen("not-a-date"), "not-a-date");
});

test("the new read follows the public list grant and does not change existing objects", () => {
  const sql = read("supabase/migrations/20261105181000_ai_prompt_edits_list.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ai_prompt_edits_list\(p_prompt_key text\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO ''/);
  const body = sql.slice(sql.indexOf("AS $$"), sql.indexOf("$$;"));
  assert.match(body, /FROM command\.fmic_ai_prompt_edits e/);
  assert.equal(body.match(/\bFROM\b/g)?.length, 1);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.ai_prompt_edits_list\(text\) FROM PUBLIC/);
  assert.equal((sql.match(/\bGRANT\b/g) ?? []).length, 1);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ai_prompt_edits_list\(text\) TO %I/);
  assert.match(sql, /ARRAY\['anon', 'authenticated', 'service_role'\]/);
  assert.match(sql, /DROP FUNCTION public\.ai_prompt_edits_list\(text\)/);
  assert.match(sql, /Not applied/);
  assert.match(sql, /Brian Magazu/);
  assert.doesNotMatch(sql, /ALTER TABLE/i);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(sql, /FUNCTION public\.ai_prompts_list/);
  assert.doesNotMatch(sql, /ai_prompt_save/);
  assert.doesNotMatch(sql, /ai_prompt_set_active/);
});

test("the Prompts screen shows the history sentence and does not invent a log", () => {
  const editor = read("components/v3/prompts/PromptsEditor.tsx");
  const history = read("components/v3/prompts/PromptHistory.tsx");
  const moduleSource = read("lib/ai-search/prompt-edit-history.ts");
  assert.match(editor, /PromptHistory/);
  assert.match(history, /PROMPT_HISTORY_NOTE/);
  assert.match(history, /PROMPT_HISTORY_UNAVAILABLE/);
  assert.match(history, /className="ifai-term"/);
  assert.match(history, /data-ifai-tooltip-title=\{PROMPT_HISTORY_UNAVAILABLE\}/);
  assert.match(history, /data-ifai-tooltip-desc=\{PROMPT_HISTORY_UNAVAILABLE_DESC\}/);
  assert.match(history, /tabIndex=\{0\}/);
  assert.match(history, /aria-label=\{label\}/);
  assert.doesNotMatch(history, /\stitle=/);
  assert.match(moduleSource, /rpc\("ai_prompt_edits_list"/);
  assert.doesNotMatch(moduleSource, /prompt-editor/);
  assert.equal(PROMPT_HISTORY_UNAVAILABLE, "Not available*");
  for (const file of [
    "components/v3/prompts/PromptsEditor.tsx",
    "components/v3/prompts/PromptHistory.tsx",
    "components/v3/prompts/prompts-editor.css",
    "lib/ai-search/prompt-edit-history.ts",
  ]) {
    assert.doesNotMatch(read(file), /\u2014/, `em dash in ${file}`);
  }
});
