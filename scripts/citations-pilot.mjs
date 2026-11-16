#!/usr/bin/env node
/**
 * Citations pilot: Claude and Grok with web search on and off.
 *
 * Why: the Toolbelt API job (claude_api, grok_api) stores answers with no citations because
 * Toolbelt does not pass a web search setting to Anthropic or xAI. This script calls both APIs
 * directly so we can see the search queries each model ran, the sources it consulted, and the
 * sources it cited, in the same shape we already store for ChatGPT and Perplexity.
 *
 * Read-only: it calls the two model APIs and writes files under .tmp/ (gitignored).
 * It never writes to the database.
 *
 * Keys: ANTHROPIC_API_KEY and XAI_API_KEY, from the environment or from .env.local
 * (this folder, or the path given with --env).
 *
 * Usage:
 *   node scripts/citations-pilot.mjs --dry-run           # print the plan and request bodies, no calls
 *   node scripts/citations-pilot.mjs                     # 10 questions x 2 engines x search on/off = 40 calls
 *   node scripts/citations-pilot.mjs --engines claude --modes on --n 3
 *
 * Options:
 *   --engines claude,grok   engines to run (default both)
 *   --modes on,off          search modes (default both)
 *   --n 10                  how many pilot questions (default 10, max 10)
 *   --claude-model ID       default claude-opus-5-5 (the Toolbelt job uses claude-sonnet-5-5)
 *   --grok-model ID         default grok-4.7 (same as the Toolbelt job)
 *   --out DIR               default .tmp/citations-pilot/<timestamp>
 *   --env PATH              env file to load (default .env.local)
 *   --dry-run               no API calls
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

/** The 10 pilot questions: 9 wave 1 buyer questions and fact checks, 1 wave 2 question. */
const PILOT_KEYS = ["p01", "p02", "p05", "p07", "p09", "p11", "p14", "p17", "p23", "p38"];

function parseArgs(argv) {
  const args = {
    engines: ["claude", "grok"],
    modes: ["on", "off"],
    n: 10,
    claudeModel: "claude-opus-5-5",
    grokModel: "grok-4.7",
    out: null,
    env: ".env.local",
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--engines") args.engines = next().split(",");
    else if (a === "--modes") args.modes = next().split(",");
    else if (a === "--n") args.n = Math.min(10, Number(next()));
    else if (a === "--claude-model") args.claudeModel = next();
    else if (a === "--grok-model") args.grokModel = next();
    else if (a === "--out") args.out = next();
    else if (a === "--env") args.env = next();
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--questions") args.questions = next().split(",");
    else throw new Error(`Unknown option ${a}`);
  }
  return args;
}

function loadEnv(file) {
  const p = path.resolve(ROOT, file);
  if (!fs.existsSync(p)) return false;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return true;
}

/** Read prompt wording from the repo's battery file so the pilot asks exactly what the battery asks. */
function loadPrompts(n) {
  const src = fs.readFileSync(path.join(ROOT, "lib/ai-search/prompt-battery.ts"), "utf8");
  const out = [];
  for (const key of PILOT_KEYS.slice(0, n)) {
    const m = src.match(new RegExp(`key:\\s*"${key}",\\s*text:\\s*"([^"]+)"`));
    if (!m) throw new Error(`Prompt ${key} not found in lib/ai-search/prompt-battery.ts`);
    out.push({ key, text: m[1] });
  }
  return out;
}

const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const stripUtm = (u) => u.replace(/[?&]utm_source=[^&]+/, "").replace(/\?$/, "");

// ---------- Claude ----------

const CLAUDE_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", allowed_callers: ["direct"] };

function claudeRequest(model, prompt, mode) {
  return {
    model,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    // Server-side refusal fallback (beta); a guitar question should never need it.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: prompt }],
    ...(mode === "on" ? { tools: [CLAUDE_SEARCH_TOOL] } : {}),
  };
}

async function callClaude(client, body) {
  const params = structuredClone(body);
  const turns = [];
  // A long search turn can pause; send the paused assistant content back to let it finish.
  for (let i = 0; i < 4; i++) {
    const res = await client.beta.messages.create(params);
    turns.push(res);
    if (res.stop_reason !== "pause_turn") break;
    params.messages = [...params.messages, { role: "assistant", content: res.content }];
  }
  return turns;
}

function summarizeClaude(turns) {
  const blocks = turns.flatMap((t) => t.content);
  const last = turns[turns.length - 1];
  const queries = blocks
    .filter((b) => b.type === "server_tool_use" && b.name === "web_search")
    .map((b) => b.input?.query);
  const consulted = [];
  const searchErrors = [];
  for (const b of blocks.filter((b) => b.type === "web_search_tool_result")) {
    if (Array.isArray(b.content)) for (const r of b.content) consulted.push({ url: r.url, title: r.title });
    else searchErrors.push(b.content?.error_code ?? "unknown");
  }
  const cited = [];
  for (const b of blocks.filter((b) => b.type === "text")) {
    for (const c of b.citations ?? []) if (c.url) cited.push({ url: c.url, title: c.title });
  }
  const answer = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    model_served: last.model,
    stop_reason: last.stop_reason,
    answer,
    queries: uniq(queries),
    consulted,
    cited,
    search_errors: searchErrors,
    searches_billed: turns.reduce((s, t) => s + (t.usage?.server_tool_use?.web_search_requests ?? 0), 0),
    input_tokens: turns.reduce((s, t) => s + (t.usage?.input_tokens ?? 0), 0),
    output_tokens: turns.reduce((s, t) => s + (t.usage?.output_tokens ?? 0), 0),
  };
}

// ---------- Grok (xAI Responses API) ----------

function grokRequest(model, prompt, mode) {
  return {
    model,
    input: [{ role: "user", content: prompt }],
    ...(mode === "on" ? { tools: [{ type: "web_search" }, { type: "x_search" }] } : {}),
  };
}

async function callGrok(key, body) {
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw_text: text };
  }
  if (!res.ok) {
    const err = new Error(`xAI ${res.status}: ${text.slice(0, 400)}`);
    err.raw = json;
    throw err;
  }
  return json;
}

function summarizeGrok(res) {
  const output = Array.isArray(res.output) ? res.output : [];
  const queries = [];
  const consulted = [];
  for (const item of output) {
    if (!/search_call|tool_call|function_call/.test(item.type ?? "")) continue;
    const action = item.action ?? {};
    let args = {};
    if (typeof item.arguments === "string") {
      try {
        args = JSON.parse(item.arguments);
      } catch {
        args = {};
      }
    }
    queries.push(action.query ?? args.query ?? args.q ?? null);
    for (const s of action.sources ?? []) consulted.push({ url: s.url, title: s.title });
  }
  // xAI's top-level `citations` lists every source the search returned.
  for (const c of res.citations ?? []) consulted.push(typeof c === "string" ? { url: c } : { url: c.url, title: c.title });
  const cited = [];
  let answer = "";
  for (const item of output.filter((o) => o.type === "message")) {
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      answer += part.text ?? "";
      // xAI attaches every consulted source as a url_citation. Only annotations with a real
      // position in the text ([[N]](url) markers, end_index > start_index) are cited in the answer;
      // the rest (start_index = end_index = 0) are consulted only.
      for (const a of part.annotations ?? []) {
        if (!a.url) continue;
        if ((a.end_index ?? 0) > (a.start_index ?? 0)) cited.push({ url: a.url, title: a.title });
        else consulted.push({ url: a.url, title: a.title });
      }
    }
  }
  return {
    model_served: res.model,
    stop_reason: res.status,
    answer,
    queries: uniq(queries),
    consulted,
    cited,
    search_errors: [],
    searches_billed: res.usage?.server_side_tool_usage ?? res.usage?.num_sources_used ?? null,
    input_tokens: res.usage?.input_tokens ?? null,
    output_tokens: res.usage?.output_tokens ?? null,
  };
}

// ---------- shared ----------

function fenderFlags(s) {
  const isFender = (r) => /fender/i.test(r.url ?? "") || /fender/i.test(r.title ?? "");
  const isFenderCom = (r) => /(^|\.)fender\.com$/.test(hostOf(r.url ?? ""));
  return {
    fender_mentioned: /fender/i.test(s.answer),
    fender_consulted: s.consulted.some(isFender),
    fender_cited: s.cited.some(isFender),
    fender_com_consulted: s.consulted.some(isFenderCom),
    fender_com_cited: s.cited.some(isFenderCom),
  };
}

function finalize(s) {
  const consultedUrls = uniq(s.consulted.map((r) => stripUtm(r.url)));
  const citedUrls = uniq(s.cited.map((r) => stripUtm(r.url)));
  return {
    ...s,
    consulted_urls: consultedUrls,
    cited_urls: citedUrls,
    consulted_count: consultedUrls.length,
    cited_count: citedUrls.length,
    cited_domains: uniq(citedUrls.map(hostOf)),
    ...fenderFlags(s),
  };
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx]);
      }
    }),
  );
  return results;
}

function aggregate(rows) {
  const groups = {};
  for (const r of rows) {
    const g = (groups[`${r.engine}|${r.mode}`] ??= {
      engine: r.engine,
      mode: r.mode,
      runs: 0,
      errors: 0,
      ran_search: 0,
      with_citations: 0,
      avg_cited: 0,
      avg_consulted: 0,
      fender_mentioned: 0,
      fender_consulted: 0,
      fender_cited: 0,
      fender_com_cited: 0,
    });
    g.runs++;
    if (r.error) {
      g.errors++;
      continue;
    }
    if (r.queries.length || r.consulted_count) g.ran_search++;
    if (r.cited_count) g.with_citations++;
    g.avg_cited += r.cited_count;
    g.avg_consulted += r.consulted_count;
    for (const f of ["fender_mentioned", "fender_consulted", "fender_cited", "fender_com_cited"]) if (r[f]) g[f]++;
  }
  return Object.values(groups).map((g) => {
    const ok = g.runs - g.errors || 1;
    return { ...g, avg_cited: +(g.avg_cited / ok).toFixed(1), avg_consulted: +(g.avg_consulted / ok).toFixed(1) };
  });
}

function toMarkdown(meta, agg, rows) {
  const lines = [
    `# Citations pilot, ${meta.started_at}`,
    "",
    `Claude model: ${meta.claude_model}. Grok model: ${meta.grok_model}. Questions: ${meta.prompt_keys.join(", ")}.`,
    "",
    "| Engine | Search | Runs | Errors | Ran a search | Answers with citations | Avg cited | Avg consulted | Fender mentioned | Fender consulted | Fender cited | fender.com cited |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...agg.map(
      (g) =>
        `| ${g.engine} | ${g.mode} | ${g.runs} | ${g.errors} | ${g.ran_search} | ${g.with_citations} | ${g.avg_cited} | ${g.avg_consulted} | ${g.fender_mentioned} | ${g.fender_consulted} | ${g.fender_cited} | ${g.fender_com_cited} |`,
    ),
    "",
    "## Per question",
    "",
    "| Engine | Search | Key | Queries run | Consulted | Cited | Fender mentioned / consulted / cited | Top cited domains |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      r.error
        ? `| ${r.engine} | ${r.mode} | ${r.key} | error: ${String(r.error).slice(0, 80).replace(/\|/g, "/")} | | | | |`
        : `| ${r.engine} | ${r.mode} | ${r.key} | ${r.queries.length} | ${r.consulted_count} | ${r.cited_count} | ${+r.fender_mentioned} / ${+r.fender_consulted} / ${+r.fender_cited} | ${r.cited_domains.slice(0, 4).join(", ")} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envLoaded = loadEnv(args.env);
  const prompts = loadPrompts(args.n).filter((p) => !args.questions || args.questions.includes(p.key ?? p.prompt_key ?? p.id));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(ROOT, args.out ?? `.tmp/citations-pilot/${stamp}`);

  const jobs = [];
  for (const engine of args.engines)
    for (const mode of args.modes) for (const p of prompts) jobs.push({ engine, mode, key: p.key, prompt: p.text });

  const missing = [];
  if (args.engines.includes("claude") && !process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (args.engines.includes("grok") && !process.env.XAI_API_KEY) missing.push("XAI_API_KEY");

  if (args.dryRun || missing.length) {
    console.log(`Env file ${args.env}: ${envLoaded ? "loaded" : "not found"}`);
    if (missing.length) console.log(`Missing keys: ${missing.join(", ")}. Dry run only.`);
    console.log(`${jobs.length} calls planned:`);
    for (const j of jobs) console.log(`  ${j.engine.padEnd(6)} search ${j.mode.padEnd(3)} ${j.key}  ${j.prompt}`);
    const sample = prompts[0].text;
    console.log("\nClaude request (search on):");
    console.log(JSON.stringify(claudeRequest(args.claudeModel, sample, "on"), null, 2));
    console.log("\nGrok request (search on), POST https://api.x.ai/v1/responses:");
    console.log(JSON.stringify(grokRequest(args.grokModel, sample, "on"), null, 2));
    process.exit(missing.length && !args.dryRun ? 2 : 0);
  }

  let anthropic = null;
  if (args.engines.includes("claude")) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });
  const meta = {
    started_at: new Date().toISOString(),
    claude_model: args.claudeModel,
    grok_model: args.grokModel,
    prompt_keys: prompts.map((p) => p.key),
    engines: args.engines,
    modes: args.modes,
  };

  const rows = await pool(jobs, 3, async (j) => {
    const base = { engine: j.engine, mode: j.mode, key: j.key, prompt: j.prompt };
    const rawPath = path.join(outDir, "raw", `${j.engine}-${j.mode}-${j.key}.json`);
    const t0 = Date.now();
    try {
      let summary, raw, request;
      if (j.engine === "claude") {
        request = claudeRequest(args.claudeModel, j.prompt, j.mode);
        raw = await callClaude(anthropic, request);
        summary = summarizeClaude(raw);
      } else {
        request = grokRequest(args.grokModel, j.prompt, j.mode);
        raw = await callGrok(process.env.XAI_API_KEY, request);
        summary = summarizeGrok(raw);
      }
      fs.writeFileSync(rawPath, JSON.stringify({ request, response: raw }, null, 2));
      const row = { ...base, ms: Date.now() - t0, ...finalize(summary) };
      console.log(
        `${j.engine} ${j.mode} ${j.key}: ${row.queries.length} queries, ${row.consulted_count} consulted, ${row.cited_count} cited, Fender ${row.fender_mentioned ? "mentioned" : "not mentioned"}`,
      );
      return row;
    } catch (e) {
      fs.writeFileSync(rawPath, JSON.stringify({ error: String(e?.message ?? e), raw: e?.raw ?? e?.error ?? null }, null, 2));
      console.log(`${j.engine} ${j.mode} ${j.key}: ERROR ${e?.message ?? e}`);
      return { ...base, ms: Date.now() - t0, error: String(e?.message ?? e) };
    }
  });

  const agg = aggregate(rows);
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ meta, aggregate: agg, rows }, null, 2));
  fs.writeFileSync(path.join(outDir, "summary.md"), toMarkdown(meta, agg, rows));
  console.log(`\n${toMarkdown(meta, agg, []).split("## Per question")[0]}`);
  console.log(`Wrote ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
