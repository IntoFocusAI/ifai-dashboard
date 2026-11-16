// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/roadmap-v2.test.ts
// Roadmap v2 (Brian, 11 Nov 2026): own product pages (21c), always a focus (21d), rolling 90 days.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AiCallRow, AiCitationRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import type { SpecPage } from "../lib/fender-canvas/machine-readability.ts";
import type { ListingContentRow } from "../lib/fender-canvas/listing-content.ts";
import { summarizeListingContent } from "../lib/fender-canvas/listing-content.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";
import { phaseWindow, windowLabel } from "../lib/fender-canvas/roadmap-dates.ts";
import {
  BRAND_FOCUS,
  focusActions,
  focusOptions,
  movingSites,
  staffFocus,
  weakestEngine,
  weakestQuestions,
} from "../lib/fender-canvas/roadmap-focus.ts";
import { ownPagesAction } from "../lib/fender-canvas/roadmap-own-pages.ts";
import { focusWindowRuns, poolFocusWindow, previousWindowEnd, windowSummary } from "../lib/fender-canvas/roadmap-window.ts";
import { buildPlan, focusPlan, phaseItems } from "../lib/fender-canvas/roadmap-plan.ts";

const root = new URL("..", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");

// ---------- fixtures ----------

let seq = 0;
function call(engine: string, prompt: string, outcome: string, category = "electric"): AiCallRow {
  seq += 1;
  return {
    id: `c${seq}`,
    audit_run_id: "run",
    sim_id: seq,
    engine,
    model: null,
    category,
    prompt,
    prompt_key: null,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome,
    primary_brand: null,
    material_hallucination: null,
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: null,
  };
}

/** `wins` of `total` answers lead with the brand. */
function answers(engine: string, prompt: string, wins: number, total: number, category = "electric"): AiCallRow[] {
  return Array.from({ length: total }, (_, i) => call(engine, prompt, i < wins ? "fender_win" : "competitor_win", category));
}

function snapshot(calls: AiCallRow[], citations: AiCitationRow[] = []): AiSearchSnapshot {
  return { run: { audit_run_id: "run" } as AiSearchSnapshot["run"], calls, probes: [], citations };
}

function cite(c: AiCallRow, url: string): AiCitationRow {
  return {
    audit_run_id: "run",
    sim_id: c.sim_id,
    simulation_id: c.id,
    prompt_key: null,
    prompt_kind: "commercial",
    category: c.category,
    engine: c.engine,
    position: 1,
    url,
    domain: new URL(url).hostname,
    title: null,
  };
}

/** A run of `total` shopping answers with sources; `share` maps a site to how many of them cite it. */
function citedRun(total: number, share: Record<string, number>): AiSearchSnapshot {
  const calls = Array.from({ length: total }, () => call("chatgpt", "best electric guitar", "fender_win"));
  const citations: AiCitationRow[] = [];
  calls.forEach((c, i) => {
    citations.push(cite(c, `https://shop-${i}.example.test/p`));
    for (const [site, count] of Object.entries(share)) if (i < count) citations.push(cite(c, `https://www.${site}/page-${i % 2}`));
  });
  return snapshot(calls, citations);
}

function metrics(over: Partial<CanvasMetricsRow>): CanvasMetricsRow {
  return {
    spec_checked: 100,
    spec_fender_found: 99,
    spec_fender_found_pct: 99,
    spec_avg_fender_pct: 99,
    spec_avg_amazon_pct: 95,
    spec_missing_additional_property: 0,
    ...over,
  } as CanvasMetricsRow;
}

function specPages(total: number, missing: number) {
  const pages: SpecPage[] = Array.from({ length: total }, (_, i) => ({
    url: `https://www.fender.com/p/${i}`,
    model: `Model ${i}`,
    asins: [],
    missingFields: i < missing ? ["additionalProperty"] : [],
    hasSpecBlock: i >= missing,
    basicsPresent: 7,
    missingBasics: [],
    checkedAt: null,
  }));
  return { pages, withSpecBlock: total - missing, withAllBasics: total, listings: total };
}

function content(total: number, aplus: number) {
  const rows: ListingContentRow[] = Array.from({ length: total }, (_, i) => ({
    asin: `A${i}`,
    title: null,
    bullet_count: 5,
    image_count: 7,
    aplus_state: i < aplus ? "present" : "absent",
    aplus_module_count: null,
    video_state: "absent",
    video_count: null,
    checked_at: null,
    aplus_source: "live_page",
    video_source: "live_page",
  }));
  return summarizeListingContent(rows);
}

function bundle(m: Partial<CanvasMetricsRow>, pagesMissing = 0, aplus = 100): CanvasBundle {
  return {
    m: metrics(m),
    cats: [],
    engines: [],
    sov: [],
    divisions: [],
    missing: [],
    fresh: [],
    specPages: specPages(100, pagesMissing),
    listingContent: content(100, aplus),
  };
}

// ---------- rule 1: own product pages (21c) ----------

test("21c: a red factor puts the own-page action in Days 1 to 30, worst first", () => {
  const own = ownPagesAction(bundle({ spec_fender_found_pct: 80, spec_fender_found: 80 }, 0, 96), null);
  assert.equal(own.action?.id, "own:pages");
  assert.equal(own.action?.phase, "days_1_30");
  assert.equal(own.action?.tone, "danger");
  assert.equal(own.action?.percent, "80.0%");
  assert.match(own.action!.fact, /^fender\.com page found reads 80\.0% \(Poor\) and A\+ content reads 96\.0% \(Fair\)\.$/);
  assert.equal(own.action!.label, "Fender pages and listings: fender.com page found");
  assert.equal(
    own.action!.action,
    "Work through the product pages and listings Fender controls until each of these reads Good, starting with fender.com page found.",
  );
  assert.equal(own.action?.open.tab, "Brand-Site Specs");
});

test("21c: only yellow factors put the own-page action in Days 31 to 60", () => {
  const own = ownPagesAction(bundle({ spec_avg_amazon_pct: 90 }, 4), null);
  assert.equal(own.action?.phase, "days_31_60");
  assert.match(own.action!.fact, /^Found pages missing machine-readable specs reads 4\.0% \(Fair\) and Amazon/, "a sentence opens with a capital");
  assert.match(own.action!.fact, /Amazon attribute completeness reads 90\.0% \(Fair\)/);
});

test("21c: all green and the brand site cited under 30% gives the Days 61 to 90 wording action; 30% or more gives none", () => {
  const green = bundle({});
  const rare = citedRun(40, { "fender.com": 10 });
  const own = ownPagesAction(green, rare);
  assert.equal(own.action?.id, "own:wording");
  assert.equal(own.action?.phase, "days_61_90");
  assert.equal(own.action?.urgent, false);
  assert.equal(own.action?.ratio, "10 of 40");
  assert.match(own.action!.fact, /^fender\.com is cited in 25\.0% of shopping answers with sources \(10 of 40\)\. Every Fender-controlled page factor reads Good\.$/);
  assert.equal(own.action!.action, "Word the fender.com product pages to match the questions shoppers ask.");
  assert.equal(ownPagesAction(green, citedRun(40, { "fender.com": 12 })).action, null, "12 of 40 is 30%");
  const unread = ownPagesAction({ ...green, listingContent: null }, rare);
  assert.equal(unread.action, null, "a factor with no reading is not judged green");
  assert.match(unread.reason, /no reading for A\+ content/);
});

// ---------- rule 2: always a focus (21d) ----------

const ENGINES = ["chatgpt", "gemini", "perplexity", "claude", "copilot", "grok"];

test("21d weakest engine: a gap of 10 points or more is a Days 31 to 60 priority action in Brian's wording", () => {
  const calls = [...answers("chatgpt", "best electric guitar", 30, 40), ...answers("gemini", "best electric guitar", 10, 40)];
  const { actions, held } = weakestEngine(snapshot(calls));
  assert.equal(held.length, 0);
  assert.equal(actions[0]!.tier, "priority");
  assert.equal(actions[0]!.fact, "Fender/Squier is named most in 10 of 40 resolved unbranded discovery answers on Gemini, the lowest of the engines checked.");
  assert.equal(actions[0]!.action, "Review the Gemini answers that name another brand most, and the sources they cite.");
  const plan = buildPlan({ findings: [], signals: [], sources: [], focus: actions });
  assert.equal(plan[0]!.phase, "days_31_60");
  assert.equal(plan[0]!.statusLabel, "Recommended");
  assert.equal(plan[0]!.evidence?.engine, "gemini");
});

test("21d weakest engine: under 10 points is a Days 61 to 90 watch line; five engines at 5% and one at 1% still shows the 1%", () => {
  const close = weakestEngine(snapshot([...answers("chatgpt", "best electric guitar", 30, 40), ...answers("gemini", "best electric guitar", 27, 40)]));
  assert.equal(close.actions[0]!.tier, "watch", "7.5 points behind");
  assert.equal(close.actions[0]!.action, "Watch Gemini.");

  const calls = ENGINES.flatMap((engine) => answers(engine, "best electric guitar", engine === "grok" ? 1 : 5, 100));
  const { actions } = weakestEngine(snapshot(calls));
  assert.equal(actions.length, 1);
  assert.equal(actions[0]!.evidence?.engine, "grok");
  assert.match(actions[0]!.fact, /1 of 100 resolved unbranded discovery answers on /);
  const plan = buildPlan({ findings: [], signals: [], sources: [], focus: actions });
  assert.equal(plan[0]!.phase, "days_61_90");
  assert.equal(plan[0]!.statusLabel, "Watch");
});

test("21d weakest engine: the 30-answer floor holds engines back, and one engine alone has nothing to compare", () => {
  const thin = weakestEngine(snapshot([...answers("chatgpt", "best electric guitar", 30, 40), ...answers("gemini", "best electric guitar", 2, 20)]));
  assert.equal(thin.actions.length, 0);
  assert.deepEqual(thin.held.map((h) => `${h.id}:${h.guardrail}`), ["focus:engine:gemini:data", "focus:engine:chatgpt:data"]);
  assert.match(thin.held[0]!.detail, /2 of 20 resolved answers in the window/);
});

test("21d weakest questions: five weakest past the floor; 10 points behind the best is priority, under 10 is watch", () => {
  const calls = [
    ...answers("chatgpt", "best electric guitar", 36, 40),
    ...answers("chatgpt", "best acoustic guitar", 8, 40, "acoustics"),
    ...answers("chatgpt", "best bass guitar", 10, 40, "bass"),
    ...answers("chatgpt", "best guitar amp", 33, 40, "amps"),
    ...answers("chatgpt", "best guitar pedal", 0, 10, "pedals"),
  ];
  const { actions, held } = weakestQuestions(snapshot(calls));
  assert.deepEqual(
    actions.map((a) => `${a.label}:${a.tier}`),
    ['"best acoustic guitar":priority', '"best bass guitar":priority', '"best guitar amp":watch', '"best electric guitar":watch'],
  );
  assert.equal(actions[0]!.fact, 'Fender/Squier is named most in 8 of 40 resolved answers to "best acoustic guitar".');
  assert.equal(actions[0]!.action, "Word the fender.com product pages to answer this question.");
  assert.equal(actions[2]!.action, "Watch this question.");
  assert.deepEqual(actions[0]!.categories, ["acoustics"]);
  assert.deepEqual(held.map((h) => `${h.label}:${h.guardrail}`), ["best guitar pedal:data"]);
});

function dayRun(id: string, day: string, wins: number, total: number): AiSearchSnapshot {
  const calls = [...answers("chatgpt", "best electric guitar", 18, 20), ...answers("chatgpt", "best acoustic guitar", wins, total, "acoustics")];
  return { ...snapshot(calls), run: { audit_run_id: id, is_published: true, published_at: `${day}T12:00:00Z` } as AiSearchSnapshot["run"] };
}

test("21d window: the floor counts the window total, pooled across runs, never one run", () => {
  const single = weakestQuestions(dayRun("a", "2026-11-01", 2, 20));
  assert.equal(single.actions.length, 0, "20 answers in one run is under the floor");
  const runs = [dayRun("a", "2026-11-01", 2, 20), dayRun("b", "2026-11-08", 3, 20)];
  const pooled = poolFocusWindow(runs, []);
  const { actions } = weakestQuestions(pooled!);
  assert.deepEqual(actions.map((a) => `${a.label}:${a.numerator}/${a.denominator}:${a.tier}`), [
    '"best acoustic guitar":5/40:priority',
    '"best electric guitar":36/40:watch',
  ]);
  assert.equal(previousWindowEnd("2026-11-10"), "2026-10-11");
  const summary = windowSummary(pooled, runs, []);
  assert.deepEqual(summary.questions.map((q) => q.resolved), [40, 40]);
  assert.deepEqual(summary.runs.map((r) => `${r.day}:${r.resolved}:${r.questions}`), ["2026-11-01:40:2", "2026-11-08:40:2"]);
});

test("21d window runs: the 30 days ending on the published run, and the 30 days before", () => {
  const summary = (id: string, day: string) => ({
    audit_run_id: id,
    run_kind: "ai_simulation",
    run_state: "completed",
    collector_version: "v11",
    prompt_set_hash: "h",
    expected_calls: 10,
    attempted_calls: 10,
    answered_calls: 10,
    error_calls: 0,
    is_published: true,
    published_at: `${day}T12:00:00Z`,
    completed_at: `${day}T12:00:00Z`,
  });
  const runs = [summary("old", "2026-09-11"), summary("prev", "2026-10-11"), summary("first", "2026-10-12"), summary("last", "2026-11-10")];
  const { current, previous } = focusWindowRuns(runs, "2026-11-10");
  assert.deepEqual(current.map((r) => r.audit_run_id), ["first", "last"]);
  assert.deepEqual(previous.map((r) => r.audit_run_id), ["prev"]);
});

test("21d moving sites: share 3% or more and 10 answers, flagged at a 10% relative change, top three each way", () => {
  const current = citedRun(40, { "guitarworld.com": 20, "reddit.com": 10, "musicradar.com": 6, "sweetwater.com": 11, "guitarcenter.com": 12 });
  const previous = citedRun(40, { "guitarworld.com": 8, "reddit.com": 20, "musicradar.com": 4, "sweetwater.com": 10, "guitarcenter.com": 13, "fender.com": 30 });
  const { actions, held } = movingSites(current, previous);
  assert.equal(held.length, 0);
  assert.deepEqual(actions.map((a) => a.label), ["guitarworld.com rising", "sweetwater.com rising", "reddit.com falling"]);
  assert.equal(
    actions[0]!.fact,
    "guitarworld.com is cited in 50.0% of shopping answers with sources in the last 30 days (20 of 40), against 20.0% (8 of 40) in the 30 days before.",
  );
  assert.match(actions[2]!.action, /reddit\.com accurate/);
  assert.ok(!actions.some((a) => a.label.startsWith("musicradar.com")), "6 answers is under 10");
  assert.ok(!actions.some((a) => a.label.startsWith("guitarcenter.com")), "30.0% from 32.5% is under a 10% change");
  assert.ok(!actions.some((a) => a.label.startsWith("fender.com")), "the brand's own site is the own-page action's");
});

test("21d moving sites: skipped and held when the prior window has fewer than 30 answers", () => {
  const thin = movingSites(citedRun(40, { "guitarworld.com": 20 }), citedRun(20, { "guitarworld.com": 2 }));
  assert.equal(thin.actions.length, 0);
  assert.equal(thin.held[0]!.id, "focus:site");
  assert.equal(thin.held[0]!.detail, "40 shopping answers with sources in the last 30 days and 20 in the 30 days before");
  assert.equal(movingSites(citedRun(40, {}), null).held[0]!.guardrail, "data");
});

test("21d: a moving site with a source action joins it instead of a second row", () => {
  const focus = movingSites(citedRun(40, { "guitarworld.com": 20 }), citedRun(40, { "guitarworld.com": 4 })).actions;
  const plan = buildPlan({
    findings: [],
    signals: [],
    sources: [
      {
        domain: "guitarworld.com",
        type: "publication",
        answers: 20,
        answersWithSources: 40,
        share: 0.5,
        runsOver: 2,
        runsRead: 3,
        categories: [],
        categoryKeys: ["electric"],
        pages: [],
        fact: "guitarworld.com is cited.",
        action: "Outreach.",
      },
    ],
    focus,
  });
  assert.deepEqual(plan.map((item) => item.id), ["source:guitarworld.com"]);
  assert.equal(
    plan[0]!.fact,
    "guitarworld.com is cited. It is cited in 50.0% of shopping answers with sources in the last 30 days (20 of 40), against 10.0% (4 of 40) in the 30 days before.",
  );
});

test("plan order: ecommerce, urgent own pages, answer actions, focus items, rewording, then watch lines last", () => {
  const ownUrgent = ownPagesAction(bundle({ spec_fender_found_pct: 80, spec_fender_found: 80 }), null).action;
  const engine = weakestEngine(snapshot([...answers("chatgpt", "best electric guitar", 30, 40), ...answers("gemini", "best electric guitar", 10, 40)])).actions;
  const signal = { id: "signal:out_of_stock", group: "ecommerce" as const, label: "Out of stock", share: 0.2, numerator: 2, denominator: 10, fact: "f", action: "a", open: { spokeId: "ecommerce", tab: "Out of Stock" }, partial: null };
  const plan = buildPlan({ findings: [], signals: [signal], sources: [], ownPages: ownUrgent, focus: engine });
  assert.deepEqual(plan.map((item) => item.id), ["signal:out_of_stock", "own:pages", "focus:engine:gemini"]);
  assert.equal(plan[1]!.statusLabel, "Critical");
  assert.deepEqual(phaseItems(plan, "days_1_30").map((item) => item.id), ["signal:out_of_stock", "own:pages"]);

  const watch = weakestQuestions(snapshot([...answers("chatgpt", "best electric guitar", 36, 40), ...answers("chatgpt", "best guitar amp", 33, 40)])).actions;
  const wording = ownPagesAction(bundle({}), citedRun(40, { "fender.com": 4 })).action;
  const later = buildPlan({ findings: [], signals: [signal], sources: [], ownPages: wording, focus: [...watch, ...engine] });
  assert.deepEqual(later.map((item) => item.id), [
    "signal:out_of_stock",
    "focus:engine:gemini",
    "own:wording",
    "focus:question:best-guitar-amp",
    "focus:question:best-electric-guitar",
  ]);
  assert.deepEqual(phaseItems(later, "days_61_90").map((item) => item.id), [
    "own:wording",
    "focus:question:best-guitar-amp",
    "focus:question:best-electric-guitar",
  ]);
});

// ---------- rule 3: rolling 90 days, client focus ----------

test("rolling 90 days: each refresh dates the phases from today", () => {
  const today = new Date(2026, 10, 11);
  assert.equal(phaseWindow("days_1_30", today).label, "Nov 11 to Dec 10, 2026");
  assert.equal(phaseWindow("days_31_60", today).label, "Dec 11, 2026 to Jan 9, 2027");
  assert.equal(phaseWindow("days_61_90", today).label, "Jan 10 to Feb 8, 2027");
  const later = new Date(2026, 11, 20);
  assert.equal(phaseWindow("days_1_30", later).label, "Dec 20, 2026 to Jan 18, 2027", "a later refresh starts Days 1 to 30 on that day");
  assert.equal(windowLabel(new Date(2027, 2, 1), new Date(2027, 2, 30)), "Mar 1 to Mar 30, 2027");
});

test("rolling plan: an action whose trigger clears drops off, a new one enters", () => {
  const before = buildPlan({ findings: [], signals: [], sources: [], ownPages: ownPagesAction(bundle({ spec_avg_amazon_pct: 90 }), null).action });
  assert.deepEqual(before.map((item) => item.id), ["own:pages"]);
  const engine = weakestEngine(snapshot([...answers("chatgpt", "best electric guitar", 30, 40), ...answers("gemini", "best electric guitar", 10, 40)])).actions;
  const after = buildPlan({ findings: [], signals: [], sources: [], ownPages: ownPagesAction(bundle({}), citedRun(40, { "fender.com": 20 })).action, focus: engine });
  assert.deepEqual(after.map((item) => item.id), ["focus:engine:gemini"]);
});

test("client focus: the model narrows to one category and keeps brand-wide items; the default is the brand", () => {
  const calls = [
    ...answers("chatgpt", "best electric guitar", 36, 40),
    ...answers("chatgpt", "best acoustic guitar", 8, 40, "acoustics"),
    ...answers("chatgpt", "best bass guitar", 10, 40, "bass"),
  ];
  const run = snapshot(calls);
  assert.deepEqual(focusOptions(run).map((o) => o.key), ["acoustics", "bass", "electric"]);
  const brand = focusActions({ windows: { current: run, previous: null }, focus: BRAND_FOCUS });
  const plan = buildPlan({ findings: [], signals: [], sources: [], ownPages: ownPagesAction(bundle({ spec_avg_amazon_pct: 90 }), null).action, focus: brand.actions });
  assert.deepEqual(focusPlan(plan, BRAND_FOCUS).map((item) => item.id), plan.map((item) => item.id));
  const bass = focusPlan(plan, { kind: "category", key: "bass" });
  assert.deepEqual(bass.map((item) => item.id), ["own:pages", "focus:question:best-bass-guitar"]);
  assert.deepEqual(bass.map((item) => item.rank), [1, 2]);
  const scoped = focusActions({ windows: { current: run, previous: null }, focus: { kind: "category", key: "acoustics" } });
  assert.deepEqual(scoped.actions.map((a) => `${a.id}:${a.tier}`), ["focus:question:best-acoustic-guitar:watch"], "one question in a focus is its own best");
});

test("copy: brand voice, no promised result, and the Roadmap bubble stays static", () => {
  const files = ["lib/fender-canvas/roadmap-focus.ts", "lib/fender-canvas/roadmap-own-pages.ts", "lib/fender-canvas/roadmap-dates.ts", "lib/fender-canvas/roadmap-window.ts"];
  for (const file of files) {
    const text = read(file);
    const strings = [...text.matchAll(/`([^`]*)`/g)].map((m) => m[1]).join("\n");
    assert.doesNotMatch(strings, /—|n't|will (raise|increase|improve|lift)|guarantee/i, file);
  }
  assert.match(read("lib/fender-canvas/roadmap-bubble.ts"), /"30-60-90"/);
  assert.match(read("components/v3/live/RoadmapPlanData.ts"), /useSummaryAiRead\(\)/);
});

test("client focus is staff-set per client in configuration; the default is the whole brand", () => {
  assert.equal(staffFocus(), BRAND_FOCUS, "both clients default to the whole brand");
  assert.deepEqual(staffFocus("acoustics"), { kind: "category", key: "acoustics" });
  assert.equal(staffFocus("acoustics"), staffFocus("acoustics"), "one object per category");
  assert.match(read("lib/client/active-client.ts"), /roadmapFocusCategory: null,[\s\S]*roadmapFocusCategory: null,/);
});
