import type { Page } from "@playwright/test";
import type { Row } from "./spec-read-mock";

/**
 * One published search-engine run and one API run dated inside its Last 30 days, served in
 * place of every AI Search read. Small on purpose, so each switch position has a figure a
 * reader can recount by hand.
 *
 * Search run: ChatGPT and Gemini, two buying questions, fixed fact checks p17 and p18, and the
 * rotating catalog check p35. API run: ChatGPT API and Gemini API on the same buying questions
 * and fixed fact checks, plus Crescent API, which failed every call.
 */

export const SEARCH_RUN = "5e0a0000-0000-4000-8000-000000000001";
export const API_RUN = "a9100000-0000-4000-8000-000000000002";
/** With `earlierRun`, a second published search run on Oct 20 with the same answers. */
export const EARLIER_RUN = "5e0a0000-0000-4000-8000-000000000003";

const QUESTIONS = {
  p01: { kind: "commercial", category: "electrics", prompt: "Best electric guitar under $900 for versatile tones" },
  p02: { kind: "commercial", category: "acoustics", prompt: "Best acoustic guitar for beginners under $500" },
  p17: { kind: "probe", category: "hallucinations", prompt: "Fender Player II Stratocaster neck radius and fret size" },
  p18: { kind: "probe", category: "hallucinations", prompt: "What pickups come in the Fender Player II Telecaster" },
  p35: { kind: "probe", category: "hallucinations", prompt: "Nut width of the Fender American Professional II Precision Bass" },
} as const;

type Key = keyof typeof QUESTIONS;

const CLAIMS: Record<string, { claim: string; url: string }> = {
  p17: {
    claim: "Player II Stratocaster fingerboard radius is 9.5 inches with 22 medium jumbo frets.",
    url: "https://www.fender.com/products/player-ii-stratocaster",
  },
  p18: {
    claim: "Player II Telecaster has two Player Series Alnico V single-coil pickups.",
    url: "https://www.fender.com/products/player-ii-telecaster",
  },
  p35: {
    claim: "American Professional II Precision Bass nut width is 1.5 inches.",
    url: "https://www.fender.com/products/american-professional-ii-precision-bass",
  },
};

/** answered: outcome for a buying question, or the fact-check result for a probe. */
type Plan = { engine: string; key: Key; result: "fender_win" | "competitor_win" | "none" | "confirmed" | "error" };

const SEARCH_PLAN: Plan[] = [
  { engine: "chatgpt", key: "p01", result: "fender_win" },
  { engine: "chatgpt", key: "p02", result: "competitor_win" },
  { engine: "chatgpt", key: "p17", result: "none" },
  { engine: "chatgpt", key: "p18", result: "none" },
  { engine: "chatgpt", key: "p35", result: "confirmed" },
  { engine: "gemini", key: "p01", result: "fender_win" },
  { engine: "gemini", key: "p02", result: "fender_win" },
  { engine: "gemini", key: "p17", result: "none" },
  { engine: "gemini", key: "p18", result: "none" },
  { engine: "gemini", key: "p35", result: "none" },
];

const API_PLAN: Plan[] = [
  { engine: "openai_api", key: "p01", result: "fender_win" },
  { engine: "openai_api", key: "p02", result: "competitor_win" },
  { engine: "openai_api", key: "p17", result: "confirmed" },
  { engine: "openai_api", key: "p18", result: "none" },
  { engine: "gemini_api", key: "p01", result: "fender_win" },
  { engine: "gemini_api", key: "p02", result: "competitor_win" },
  { engine: "gemini_api", key: "p17", result: "none" },
  { engine: "gemini_api", key: "p18", result: "none" },
  { engine: "crescent_api", key: "p01", result: "error" },
  { engine: "crescent_api", key: "p02", result: "error" },
  { engine: "crescent_api", key: "p17", result: "error" },
  { engine: "crescent_api", key: "p18", result: "error" },
];

function rowsFor(runId: string, plan: Plan[], day: string, firstSim: number) {
  const calls: Row[] = [];
  const probes: Row[] = [];
  const citations: Row[] = [];
  plan.forEach((step, index) => {
    const question = QUESTIONS[step.key];
    const sim = firstSim + index;
    const id = `${runId.slice(0, 8)}-call-${sim}`;
    const created = `${day}T08:${String(index).padStart(2, "0")}:00.000Z`;
    const failed = step.result === "error";
    const probe = question.kind === "probe";
    const answer = failed ? null : `Answer from ${step.engine} to ${step.key}.`;
    calls.push({
      id,
      audit_run_id: runId,
      sim_id: sim,
      engine: step.engine,
      model: null,
      category: question.category,
      prompt: question.prompt,
      prompt_key: step.key,
      prompt_kind: question.kind,
      call_status: failed ? "error" : "answered",
      outcome: failed ? "error" : probe ? "not_scored" : step.result,
      primary_brand: step.result === "fender_win" ? "Fender/Squier" : step.result === "competitor_win" ? "Gibson" : null,
      material_hallucination: probe && !failed ? step.result : "not_evaluated",
      hallucination_evidence: step.result === "confirmed" ? "The answer gave a different figure than Fender's page." : null,
      root_cause: null,
      remediation_patch: null,
      error_message: failed ? "Provider returned 503" : null,
      attempt_no: 1,
      repeat_no: 1,
      created_at: created,
      answer_text: answer,
    });
    if (probe) {
      probes.push({
        audit_run_id: runId,
        sim_id: sim,
        prompt_key: step.key,
        prompt: question.prompt,
        engine: step.engine,
        model: null,
        call_status: failed ? "error" : "answered",
        material_hallucination: failed ? "not_evaluated" : step.result,
        hallucination_evidence: step.result === "confirmed" ? "The answer gave a different figure than Fender's page." : null,
        verified_claim: CLAIMS[step.key].claim,
        verified_source_url: CLAIMS[step.key].url,
        verified_at: `${day}T22:00:00.000Z`,
        created_at: created,
        answer_text: answer,
        probe_asin: null,
        probe_asins: null,
        probe_fender_sku: null,
        probe_category: null,
        probe_series: null,
        probe_spec_field: null,
        probe_expected_value: null,
        probe_source_url: null,
        probe_amazon_value: null,
        probe_is_anchor: null,
      });
    } else if (!failed) {
      citations.push({
        audit_run_id: runId,
        sim_id: sim,
        simulation_id: id,
        prompt_key: step.key,
        prompt_kind: question.kind,
        category: question.category,
        engine: step.engine,
        position: 1,
        url: `https://www.guitarworld.com/${step.key}`,
        domain: "guitarworld.com",
        title: question.prompt,
      });
    }
  });
  return { calls, probes, citations };
}

const search = rowsFor(SEARCH_RUN, SEARCH_PLAN, "2026-11-03", 1001);
const api = rowsFor(API_RUN, API_PLAN, "2026-11-02", 2001);
const earlier = rowsFor(EARLIER_RUN, SEARCH_PLAN, "2026-10-20", 3001);

const SEARCH_SUMMARY: Row = {
  audit_run_id: SEARCH_RUN,
  run_kind: "ai_simulation",
  run_state: "completed",
  collector_version: "v11",
  prompt_set_hash: "mock-prompt-set",
  expected_calls: SEARCH_PLAN.length,
  attempted_calls: SEARCH_PLAN.length,
  answered_calls: SEARCH_PLAN.length,
  error_calls: 0,
  is_published: true,
  published_at: "2026-11-03T21:31:28.000Z",
  started_at: "2026-11-03T06:00:00.000Z",
  completed_at: "2026-11-03T21:31:24.000Z",
};

const EARLIER_SUMMARY: Row = {
  ...SEARCH_SUMMARY,
  audit_run_id: EARLIER_RUN,
  published_at: "2026-10-20T21:31:28.000Z",
  started_at: "2026-10-20T06:00:00.000Z",
  completed_at: "2026-10-20T21:31:24.000Z",
};

const API_SUMMARY: Row = {
  audit_run_id: API_RUN,
  run_kind: "ai_api",
  run_state: "partial",
  collector_version: "v11",
  prompt_set_hash: "mock-prompt-set",
  expected_calls: API_PLAN.length,
  attempted_calls: API_PLAN.length,
  answered_calls: 8,
  error_calls: 4,
  is_published: false,
  published_at: null,
  started_at: "2026-11-02T06:00:00.000Z",
  completed_at: "2026-11-02T20:00:00.000Z",
  missing_calls: 4,
  engine_group: "api",
  engines: ["crescent_api", "gemini_api", "openai_api"],
  repeats: 1,
  questions_asked: 4,
  questions_matched: 4,
  question_set_match: true,
  counted: true,
};

const CURRENT_RUN: Row = {
  audit_run_id: SEARCH_RUN,
  run_state: "completed",
  collector_version: "v11",
  prompt_set_hash: "mock-prompt-set",
  expected_calls: SEARCH_PLAN.length,
  attempted_calls: SEARCH_PLAN.length,
  answered_calls: SEARCH_PLAN.length,
  error_calls: 0,
  started_at: SEARCH_SUMMARY.started_at,
  completed_at: SEARCH_SUMMARY.completed_at,
  published_at: SEARCH_SUMMARY.published_at,
  missing_calls: 0,
};

const strip = (rows: Row[], column: string) =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== column)));

/** Rows for one AI read, or undefined when the table is not an AI Search read. */
function aiRows(table: string, url: URL, withEarlier: boolean): Row[] | undefined {
  const run = url.searchParams.get("audit_run_id")?.replace(/^eq\./, "");
  const only = (rows: Row[]) => (run ? rows.filter((row) => row.audit_run_id === run) : rows);
  const history = withEarlier
    ? {
        calls: [...earlier.calls, ...search.calls],
        probes: [...earlier.probes, ...search.probes],
        citations: [...earlier.citations, ...search.citations],
      }
    : search;
  const summaries = withEarlier ? [EARLIER_SUMMARY, SEARCH_SUMMARY] : [SEARCH_SUMMARY];
  switch (table) {
    case "canvas_ai_current_run":
      return [CURRENT_RUN];
    case "canvas_ai_simulations":
      return strip(search.calls, "answer_text");
    case "canvas_ai_probes":
      return search.probes;
    case "canvas_ai_citations":
      return search.citations;
    case "canvas_ai_run_history":
      return summaries;
    case "canvas_ai_history_runs":
      return only(summaries.map((row) => ({ ...row, missing_calls: 0 })));
    case "canvas_ai_history_calls":
      return only(history.calls);
    case "canvas_ai_history_probes":
      return only(history.probes);
    case "canvas_ai_history_citations":
    case "canvas_ai_history_citations_by_run":
      return only(history.citations);
    case "canvas_ai_probe_coverage":
      return [];
    case "canvas_ai_api_runs":
      return [API_SUMMARY];
    case "canvas_ai_api_calls":
      return only(api.calls.map((row) => ({ ...row, engine_group: "api" })));
    case "canvas_ai_api_probes":
      return only(api.probes);
    case "canvas_ai_api_citations":
      return only(api.citations);
    default:
      return undefined;
  }
}

const MISSING_VIEW = (table: string) => ({
  code: "PGRST205",
  details: null,
  hint: null,
  message: `Could not find the table 'public.${table}' in the schema cache`,
});

/**
 * Serves the AI Search reads above. Register after `mockCanvasRead`, which answers the rest.
 * `apiViews: "missing"` answers the API views the way the database does before the migration.
 */
export async function mockAiSearchWithApi(
  page: Page,
  options: { apiViews?: "ready" | "missing"; earlierRun?: boolean } = {},
): Promise<string[]> {
  const seen: string[] = [];
  await page.route("**/*supabase.co/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop() ?? "";
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "content-range",
    };
    if (options.apiViews === "missing" && table.startsWith("canvas_ai_api_")) {
      seen.push(table);
      await route.fulfill({ status: 404, contentType: "application/json", headers, body: JSON.stringify(MISSING_VIEW(table)) });
      return;
    }
    const rows = aiRows(table, url, options.earlierRun === true);
    if (!rows) {
      await route.fallback();
      return;
    }
    seen.push(table);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { ...headers, "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
      body: JSON.stringify(rows),
    });
  });
  return seen;
}

/** Forces the API reads on, whatever NEXT_PUBLIC_AI_API_ENGINE_VIEWS says. */
export async function enableApiViews(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __IFAI_AI_API_VIEWS__: boolean }).__IFAI_AI_API_VIEWS__ = true;
  });
}

/** Turns the API reads off the way NEXT_PUBLIC_AI_API_ENGINE_VIEWS "0" does. */
export async function disableApiViews(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __IFAI_AI_API_VIEWS__: boolean }).__IFAI_AI_API_VIEWS__ = false;
  });
}
