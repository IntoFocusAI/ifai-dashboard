import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PROMPT_LIST_COLUMNS, promptFromRow } from "../lib/prompts/prompt-list.ts";
import { promptRows } from "../lib/export/prompts-export.ts";

/* Worker 27.10, decision 89: every client has the Prompts screen, read from its own battery. */

const read = (path: string) => readFileSync(path, "utf8");
const MIGRATION = "supabase/migrations/20261116200000_ledlenser_canvas_ai_prompts.sql";

test("the header has a Prompts button for every client; Build prompts stays with the editable list", () => {
  const spec = read("lib/fender-canvas/build-canvas-spec.tsx");
  assert.match(spec, /promptsEditor: \(close\) => <PromptsEditor onClose=\{close\} \/>,/);
  assert.doesNotMatch(spec, /promptsEditor: activeClient\(\)/);
  assert.match(spec, /promptBuilderHref: activeClient\(\)\.promptsEditable \?/);
});

test("a read-only client reads its own canvas_ai_prompts view; Fender keeps the editor functions", () => {
  const lib = read("lib/prompts/prompt-list.ts");
  assert.match(lib, /if \(activeClient\(\)\.promptsEditable\) \{\s*const \{ prompts, status \} = await loadPrompts\(\);/);
  assert.match(lib, /getCanvasSupabase\(\)\s*\.from\("canvas_ai_prompts"\)/);
  assert.equal(PROMPT_LIST_COLUMNS, "prompt_key,prompt_text,category,prompt_kind,active,created_at,updated_at");
  const exporter = read("lib/export/prompts-export.ts");
  assert.match(exporter, /await loadPromptList\(\)/);
  assert.doesNotMatch(exporter, /no editable prompt list/);
});

test("the read-only list hides add, edit, remove, restore, history, and the Build prompts link", () => {
  const editor = read("components/v3/prompts/PromptsEditor.tsx");
  assert.match(editor, /const editable = activeClient\(\)\.promptsEditable;/);
  assert.match(editor, /\{editable \? \(\s*<p className="pe-sub">\s*<Link/);
  assert.match(editor, /\{editable \? \(\s*<>\s*<section className="pe-add">/);
  assert.equal(editor.match(/className="pe-item-actions" hidden=\{!editable\}/g)?.length, 2);
  assert.match(editor, /if \(editable\) \{\s*void loadPromptEditHistory\(\)/);
  assert.match(read("components/v3/prompts/prompts-editor.css"), /\.pe-item-actions\[hidden\] \{\s*display: none;/);
  assert.ok(editor.split("\n").length <= 400, "PromptsEditor.tsx stays at or under 400 lines");
});

test("a canvas_ai_prompts row becomes the same prompt shape and CSV row as Fender's", () => {
  const prompt = promptFromRow({
    prompt_key: "l30",
    prompt_text: "Rotating catalog fact check slot A",
    category: "hallucinations",
    prompt_kind: "probe",
    active: true,
    created_at: "2026-11-04T15:59:37Z",
    updated_at: null,
  });
  assert.deepEqual(prompt, {
    prompt_key: "l30",
    prompt_text: "Rotating catalog fact check slot A",
    category: "hallucinations",
    prompt_kind: "probe",
    active: true,
    created_at: "2026-11-04T15:59:37Z",
    updated_at: null,
  });
  assert.deepEqual(promptRows([prompt!])[0].cells, ["l30", "hallucinations", "Fact check", "Rotating catalog fact check slot A", "Asked"]);
  assert.equal(promptFromRow({ prompt_key: "l01" }), null);
  assert.equal(promptFromRow({ prompt_key: "l02", prompt_text: "Brightest headlamp", active: false })?.active, false);
});

test("the Ledlenser view migration is additive, read-only, granted like the other canvas views, and says how to undo", () => {
  const sql = read(MIGRATION);
  const statements = sql
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n");
  assert.match(statements, /CREATE VIEW ledlenser\.canvas_ai_prompts WITH \(security_invoker = false\) AS/);
  assert.match(statements, /FROM ledlenser\.ai_prompts p;/);
  assert.match(statements, /REVOKE ALL ON TABLE ledlenser\.canvas_ai_prompts FROM PUBLIC, anon, authenticated;/);
  assert.match(statements, /GRANT SELECT ON TABLE ledlenser\.canvas_ai_prompts TO anon, authenticated;/);
  assert.doesNotMatch(statements, /CREATE OR REPLACE|ALTER |DROP |INSERT |UPDATE |DELETE |FUNCTION/i);
  assert.match(sql, /-- How to undo\n--   DROP VIEW IF EXISTS ledlenser\.canvas_ai_prompts;/);
  assert.match(sql, /Status: NOT APPLIED/);
});
