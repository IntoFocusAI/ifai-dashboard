import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PROMPT_LIST_COLUMNS, promptDisplayText, promptFromRow } from "../lib/prompts/prompt-list.ts";
import { promptRows } from "../lib/export/prompts-export.ts";

/* Worker 27.10, decision 89: every client has the Prompts screen, read from its own battery. */

const read = (path: string) => readFileSync(path, "utf8");
const MIGRATION = "supabase/migrations/20261116230000_ledlenser_canvas_ai_prompts.sql";

test("the header has a Prompts button for every client; Build prompts is not tied to a client", () => {
  const spec = read("lib/fender-canvas/build-canvas-spec.tsx");
  assert.match(spec, /promptsEditor: \(close\) => <PromptsEditor onClose=\{close\} \/>,/);
  assert.doesNotMatch(spec, /promptsEditor: activeClient\(\)/);
  assert.doesNotMatch(spec, /promptBuilderHref: activeClient\(\)/);
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

test("the Prompts list is view-only for every client: no add, edit, remove, restore, history, or Build prompts link (decision 99)", () => {
  const editor = read("components/v3/prompts/PromptsEditor.tsx");
  assert.doesNotMatch(editor, /promptsEditable|savePrompt|setPromptActive|loadPromptEditHistory|PromptHistory|CategoryPicker/);
  assert.doesNotMatch(editor, /<textarea|pe-add|pe-item-actions|aria-label=\{`(Edit|Remove)/);
  assert.doesNotMatch(editor, /battery-builder|data-pe-builder-link/);
  assert.match(editor, /<PromptSearchBar/);
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

test("rotating fact-check slots read in plain words in the list and the CSV, for both clients", () => {
  const plain = (letter: string) => `Rotating catalog fact check, slot ${letter}: a different catalog product each run`;
  assert.equal(promptDisplayText("Rotating catalog fact check slot A: question per run in command.fmic_ai_probe_plan"), plain("A"));
  assert.equal(promptDisplayText("Rotating catalog fact check slot C: question per run in ledlenser.ai_probe_plan"), plain("C"));
  assert.equal(promptDisplayText("What is the scale length of a Fender Jaguar"), "What is the scale length of a Fender Jaguar");
  const row = promptRows([
    {
      prompt_key: "p36",
      prompt_text: "Rotating catalog fact check slot B: question per run in command.fmic_ai_probe_plan",
      category: "hallucinations",
      prompt_kind: "probe",
      active: true,
      created_at: null,
      updated_at: null,
    },
  ])[0];
  assert.equal(row.cells[3], plain("B"));
  const editor = read("components/v3/prompts/PromptsEditor.tsx");
  assert.equal(editor.match(/<p className="pe-text">\{promptDisplayText\(p\.prompt_text\)\}<\/p>/g)?.length, 1);
  assert.match(read("components/v3/prompts/PromptSearch.tsx"), /promptDisplayText\(p\.prompt_text\)/);
});
