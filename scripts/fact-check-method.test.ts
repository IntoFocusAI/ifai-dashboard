// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/fact-check-method.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { driftRead } from "../lib/ai-search/drift.ts";
import {
  DEFAULT_FILTER,
  applyExplorerFilter,
  factCheckColumnLabel,
} from "../lib/ai-search/explorer-filter.ts";
import { AI_DEFINITIONS } from "../lib/ai-search/definitions.ts";
import {
  FACT_CHECK_SCOPE_LINE,
  UNVERIFIED_FLAG_TIP,
  factCheckAccuracyLead,
  factCheckMethodLine,
  factCheckPickTip,
  factCheckScopeTip,
} from "../lib/ai-search/fact-check-copy.ts";
import type { AiCallRow, AiProbeRow } from "../lib/ai-search/types.ts";

function probe(partial: Partial<AiProbeRow> & Pick<AiProbeRow, "sim_id" | "prompt_key" | "engine">): AiProbeRow {
  return {
    audit_run_id: "r1",
    prompt: `Question ${partial.prompt_key}`,
    model: null,
    call_status: "answered",
    material_hallucination: "none",
    hallucination_evidence: null,
    verified_claim: "Neck radius is 9.5 inches",
    verified_source_url: "https://www.fender.com/example",
    verified_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function call(patch: Partial<AiCallRow>): AiCallRow {
  return {
    id: "row",
    audit_run_id: "r1",
    sim_id: 1,
    engine: "chatgpt",
    model: null,
    category: "electrics",
    prompt: "Prompt",
    prompt_key: "p01",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender/Squier",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-10-12T16:40:00Z",
    ...patch,
  };
}

/** Shape of the published run: five fact-check questions, one with no verified fact, some failed calls. */
function publishedShape(): AiProbeRow[] {
  const rows: AiProbeRow[] = [];
  let sim = 1;
  for (const key of ["p17", "p18", "p19", "p33", "p34"]) {
    const noFact = key === "p18";
    for (const engine of ["chatgpt", "gemini", "perplexity"]) {
      const failed = engine === "perplexity";
      rows.push(
        probe({
          sim_id: sim++,
          prompt_key: key,
          engine,
          call_status: failed ? "error" : "answered",
          material_hallucination: failed || noFact ? "not_evaluated" : "none",
          verified_claim: noFact ? null : `Fact for ${key}`,
        }),
      );
    }
  }
  return rows;
}

test("method line is N products checked and N with a verified fact; the tooltip says how they were picked", () => {
  const coverage = driftRead([], publishedShape()).coverage;
  assert.equal(coverage.questionsSent, 5);
  assert.equal(coverage.factsChecked, 4);
  const line = factCheckMethodLine(coverage);
  assert.equal(`${line?.products} · ${line?.verified}`, "5 products checked · 4 with a verified fact");
  assert.equal(
    line?.tip,
    "Each fact-check question names one Fender product, and the question set names 5. IntoFocus sends them to every engine on purpose. 4 of 5 were compared with a fact verified on an official Fender page in this run. How these products were picked, and what part of Fender's catalog they stand for, is not recorded, so this result covers these 5 products only.",
  );
  assert.match(factCheckMethodLine(coverage, true)?.tip ?? "", /in this selection\./);
});

test("method line never calls the set representative and keeps qualifiers in the tooltip", () => {
  const one = driftRead([], [probe({ sim_id: 1, prompt_key: "p1", engine: "chatgpt" })]).coverage;
  const many = driftRead([], publishedShape()).coverage;
  for (const line of [factCheckMethodLine(one), factCheckMethodLine(many, true)]) {
    assert.ok(line);
    const onScreen = `${line.products} · ${line.verified}`;
    assert.doesNotMatch(onScreen, /\bnot\b|\bno\b/i, "the on-screen line states counts only");
    for (const text of [onScreen, line.tip]) {
      assert.doesNotMatch(text, /representative|random/i);
      assert.doesNotMatch(text, /\u2014/, "no em dash in client copy");
      assert.doesNotMatch(text, /regex|collector|probe/i);
    }
  }
  const single = factCheckMethodLine(one);
  assert.equal(`${single?.products} · ${single?.verified}`, "1 product checked · 1 with a verified fact");
  assert.match(single?.tip ?? "", /IntoFocus sends it to every engine on purpose\. 1 of 1 was compared/);
  assert.match(single?.tip ?? "", /so this result covers this product only\.$/);
});

test("no fact-check questions means no method line", () => {
  assert.equal(factCheckMethodLine(driftRead([], []).coverage), null);
});

test("the method line leaves the Accuracy lead figure and colors unchanged", () => {
  const coverage = driftRead([], publishedShape()).coverage;
  const lead = factCheckAccuracyLead(coverage);
  assert.equal(lead.rate, "100.0%");
  assert.equal(lead.tone, "success");
  const panel = readFileSync("components/v3/live/ai-search/AiDriftPanel.tsx", "utf8");
  assert.match(panel, /factCheckMethodLine\(coverage, windowed\)/);
  assert.match(panel, /color: rateColor/);
  assert.match(panel, /\{accuracy\.rate\} Accuracy/);
  // The line sits in the explainer beside the Accuracy figure, right under the headline.
  const explainer = panel.slice(panel.indexOf("data-ai-accuracy-lead"), panel.indexOf("data-ai-accuracy-row"));
  const headlineAt = explainer.indexOf("data-ai-fact-headline");
  const methodAt = explainer.indexOf("data-ai-fact-method");
  assert.ok(headlineAt > 0 && methodAt > headlineAt, "method follows the headline");
  const method = explainer.slice(methodAt, explainer.indexOf("</p>", methodAt));
  assert.match(method, /<CopyTip label=\{FACT_CHECK_METHOD_TITLE\} description=\{method\.tip\}>/);
  assert.doesNotMatch(explainer, /\btitle=/);
  const tip = readFileSync("components/v3/live/ai-search/CopyTip.tsx", "utf8");
  for (const attr of ['className="ifai-term"', "data-ifai-tooltip-title", "data-ifai-tooltip-desc", "tabIndex={0}", "aria-label"]) {
    assert.ok(tip.includes(attr), attr);
  }
  assert.doesNotMatch(tip, /\stitle=/);
});

test("fact-check 'not' qualifiers sit in tooltips, never as on-screen sentences", () => {
  const flat = (path: string) => readFileSync(path, "utf8").replace(/\s+/g, " ");
  const panel = flat("components/v3/live/ai-search/AiDriftPanel.tsx");
  const drawer = flat("components/v3/live/ai-search/FactCheckEvidence.tsx");
  const explorer = flat("components/v3/live/ai-search/SimulationsExplorer.tsx");
  const removed = [
    /randomly chosen/,
    /clean bill of health/,
    /does not cover/,
    /is not a buying prompt/,
    /never scored as a win/,
    /not the whole answer/,
    /so they are not reported/,
    /has not verified a fact/,
    /\{FACT_CHECK_SCOPE\}/,
    /\{shoppingScope\}/,
  ];
  for (const source of [panel, drawer, explorer]) {
    for (const phrase of removed) assert.doesNotMatch(source, phrase);
  }
  // The scope line stays visible as the dotted trigger; its qualifiers are the tooltip.
  assert.equal(FACT_CHECK_SCOPE_LINE, "These checks cover the selected facts only.");
  assert.match(panel, /<CopyTip label=\{FACT_CHECK_SCOPE_TITLE\} description=\{factCheckScopeTip\(windowed\)\}> \{FACT_CHECK_SCOPE_LINE\} <\/CopyTip>/);
  assert.match(factCheckScopeTip(), /do not prove every statement in each answer is accurate\. This run checked selected product facts, not every factual claim/);
  assert.match(factCheckScopeTip(true), /This selection checked selected product facts/);
  assert.match(panel, /<CopyTip label="Unverified flag" description=\{UNVERIFIED_FLAG_TIP\}> unverified flag <\/CopyTip>/);
  assert.match(UNVERIFIED_FLAG_TIP, /never verified against a Fender page, so it is not reported as a contradiction/);
  assert.match(panel, /<AiTerm term="product fact check">product facts<\/AiTerm>\?/);
  assert.match(AI_DEFINITIONS["product fact check"], /never count toward win rates or competitor share/);
  assert.match(drawer, /<AiTerm term="no contradiction found">\{result\}<\/AiTerm>/);
  assert.match(AI_DEFINITIONS["no contradiction found"], /does not prove every statement in the answer is accurate/);
  assert.match(drawer, /\{probe\?\.claim \?\? PROBE_STATE_LABELS\.no_fact\}/);
  assert.equal(
    factCheckPickTip(5),
    "Each fact-check question names one Fender product. How these 5 products were picked, and what part of Fender's catalog they stand for, is not recorded.",
  );
  assert.match(factCheckPickTip(1), /^This fact-check question names one Fender product\. How it was picked/);
  for (const tip of [factCheckScopeTip(), UNVERIFIED_FLAG_TIP, factCheckPickTip(5)]) {
    assert.doesNotMatch(tip, /\u2014|representative|random/i);
  }
});

test("a fact-check result filter never returns a non-fact-check row", () => {
  const rows = [
    call({ id: "c1", sim_id: 1, prompt_kind: "commercial", material_hallucination: "not_evaluated" }),
    call({ id: "c2", sim_id: 2, prompt_kind: "commercial", material_hallucination: "confirmed" }),
    call({ id: "c3", sim_id: 3, prompt_kind: null, material_hallucination: "none" }),
    call({ id: "f1", sim_id: 4, prompt_kind: "probe", material_hallucination: "not_evaluated" }),
    call({ id: "f2", sim_id: 5, prompt_kind: "probe", material_hallucination: "none" }),
    call({ id: "f3", sim_id: 6, prompt_kind: "probe", material_hallucination: "confirmed" }),
  ];
  for (const scope of ["commercial", "probe", "all"] as const) {
    for (const accuracy of ["confirmed", "none", "not_evaluated", "unverified"] as const) {
      const matched = applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope, accuracy });
      for (const row of matched) {
        assert.equal(row.prompt_kind, "probe", `${scope}/${accuracy} matched ${row.id}`);
        assert.notEqual(factCheckColumnLabel(row), "n/a");
      }
    }
  }
  assert.deepEqual(
    applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope: "all", accuracy: "not_evaluated" }).map((r) => r.id),
    ["f1"],
  );
  // Without a fact-check result filter, shopping rows still list and read "n/a".
  const shopping = applyExplorerFilter(rows, { ...DEFAULT_FILTER, scope: "all" }).filter(
    (row) => row.prompt_kind !== "probe",
  );
  assert.equal(shopping.length, 3);
  for (const row of shopping) assert.equal(factCheckColumnLabel(row), "n/a");
});

test("choosing a fact-check result on Shopping prompts moves the table to Product fact checks", () => {
  const filters = readFileSync("components/v3/live/ai-search/SimulationFilters.tsx", "utf8");
  assert.match(filters, /accuracy !== "" && filter\.scope === "commercial"/);
  assert.match(filters, /\{ accuracy, scope: "probe", category: "" \}/);
});
