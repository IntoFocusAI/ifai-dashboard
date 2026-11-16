// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/actuation-score.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTUATION_WEIGHTS,
  E1_TARGET,
  expiresOn,
  itemsInWindow,
  ownedAnswersFromEngines,
  programInPlace,
  scoreActuation,
  type ActuationInputs,
  type ProgramBasis,
} from "../lib/fender-canvas/actuation-score.ts";
import {
  clientBasis,
  itemPayload,
  programPayload,
  readActuationBasis,
  type ClientBasisRow,
} from "../lib/fender-canvas/actuation-records.ts";

const TODAY = "2026-11-16";

function program(factor: "P1" | "P2", verifiedOn: string | null, extra: Partial<ProgramBasis> = {}): ProgramBasis {
  return {
    factor,
    hasOwner: true,
    hasEvidence: true,
    verifiedOn,
    targetDomainCount: 3,
    cadencePer30Days: factor === "P1" ? 4 : null,
    targetCount: factor === "P2" ? 10 : null,
    ...extra,
  };
}

function inputs(extra: Partial<ActuationInputs> = {}): ActuationInputs {
  return { asOf: TODAY, programs: [], items: { E2: 0, E3: 0 }, ownedAnswers: null, ...extra };
}

test("weights follow decision 96 and add to 100; planned at most 40", () => {
  assert.deepEqual(ACTUATION_WEIGHTS, { P1: 20, P2: 20, E1: 30, E2: 15, E3: 15 });
  assert.equal(Object.values(ACTUATION_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.ok(ACTUATION_WEIGHTS.P1 + ACTUATION_WEIGHTS.P2 <= 40);
});

test("a program with owner, evidence, verification and an unexpired date earns its full weight", () => {
  const score = scoreActuation(inputs({ programs: [program("P1", "2026-11-01"), program("P2", "2026-10-01")] }));
  assert.equal(score.factors.P1.points, 20);
  assert.equal(score.factors.P2.points, 20);
  assert.equal(score.score, 40);
  assert.deepEqual(score.factors.P1.basis, {
    verifiedOn: "2026-11-01",
    expiresOn: "2027-01-30",
    targetDomainCount: 3,
    cadencePer30Days: 4,
    targetCount: null,
  });
});

test("no points without owner, evidence or verification date (SC-03 acceptance)", () => {
  for (const missing of [{ hasOwner: false }, { hasEvidence: false }, { verifiedOn: null }]) {
    const score = scoreActuation(inputs({ programs: [program("P1", "2026-11-01", missing)] }));
    assert.equal(score.factors.P1.points, 0, JSON.stringify(missing));
    assert.equal(score.factors.P1.basis, null);
  }
  // A future verification date does not count either.
  assert.equal(programInPlace(program("P1", "2026-11-17"), TODAY), false);
});

test("verification holds 90 days: in place the day before expiry, lapsed on it", () => {
  const verified = "2026-08-18";
  assert.equal(expiresOn(verified), "2026-11-16");
  assert.equal(programInPlace(program("P1", verified), "2026-11-15"), true);
  assert.equal(programInPlace(program("P1", verified), "2026-11-16"), false);
});

test("a lapsed factor looks exactly like one never in place (decision 78)", () => {
  const lapsed = scoreActuation(inputs({ programs: [program("P1", "2026-05-01"), program("P2", "2026-01-01")], items: { E2: 5, E3: 2 } }));
  const never = scoreActuation(inputs({ programs: [], items: { E2: 5, E3: 2 } }));
  const incomplete = scoreActuation(
    inputs({ programs: [program("P1", null, { hasOwner: false }), program("P2", "2026-11-01", { hasEvidence: false })], items: { E2: 5, E3: 2 } }),
  );
  assert.deepEqual(lapsed, never);
  assert.deepEqual(incomplete, never);
  assert.doesNotMatch(JSON.stringify(never), /await|confirm|lapsed|expired/i);
});

test("E2 scales to the P1 cadence over 90 days; E3 to the P2 target count", () => {
  const programs = [program("P1", "2026-11-01"), program("P2", "2026-11-01")];
  const half = scoreActuation(inputs({ programs, items: { E2: 6, E3: 5 } }));
  assert.equal(half.factors.E2.basis.target, 12);
  assert.equal(half.factors.E2.points, 7.5);
  assert.equal(half.factors.E3.basis.target, 10);
  assert.equal(half.factors.E3.points, 7.5);
  const capped = scoreActuation(inputs({ programs, items: { E2: 40, E3: 40 } }));
  assert.equal(capped.factors.E2.points, 15);
  assert.equal(capped.factors.E3.points, 15);
  assert.equal(capped.score, 70);
});

test("without its program, E2 or E3 has no target and earns nothing", () => {
  const score = scoreActuation(inputs({ items: { E2: 9, E3: 9 } }));
  assert.equal(score.factors.E2.points, 0);
  assert.equal(score.factors.E2.status, "no_target");
  assert.equal(score.factors.E3.basis.count, 9);
  assert.equal(score.score, 0);
});

test("E1 is pending while E1_TARGET is unset: no points, 70 available", () => {
  assert.equal(E1_TARGET, null);
  const score = scoreActuation(inputs({ ownedAnswers: { withOwned: 30, resolved: 40 } }));
  assert.equal(score.factors.E1.status, "pending");
  assert.equal(score.factors.E1.points, 0);
  assert.equal(score.available, 70);
  assert.deepEqual(score.factors.E1.basis, { withOwned: 30, resolved: 40, target: null });
});

test("E1 scales the owned-answer share to its target once one is set", () => {
  const score = scoreActuation(inputs({ ownedAnswers: { withOwned: 3, resolved: 10 }, e1Target: 0.5 }));
  assert.equal(score.factors.E1.points, 18);
  assert.equal(score.available, 100);
  assert.equal(scoreActuation(inputs({ ownedAnswers: { withOwned: 9, resolved: 10 }, e1Target: 0.5 })).factors.E1.points, 30);
  assert.equal(scoreActuation(inputs({ ownedAnswers: { withOwned: 0, resolved: 0 }, e1Target: 0.5 })).factors.E1.status, "no_answers");
});

test("expiries due within 30, 14 and 3 days, soonest first; none for lapsed or later ones", () => {
  // Expires = verified + 90. Today 2026-11-16.
  const score = scoreActuation(
    inputs({ programs: [program("P1", "2026-08-20"), program("P2", "2026-09-10")] }),
  );
  assert.deepEqual(score.expiries, [
    { factor: "P1", expiresOn: "2026-11-18", daysLeft: 2, reminder: 3 },
    { factor: "P2", expiresOn: "2026-12-09", daysLeft: 23, reminder: 30 },
  ]);
  const fourteen = scoreActuation(inputs({ programs: [program("P1", "2026-08-28")] }));
  assert.deepEqual(fourteen.expiries.map((due) => [due.daysLeft, due.reminder]), [[10, 14]]);
  assert.deepEqual(scoreActuation(inputs({ programs: [program("P1", "2026-11-01")] })).expiries, []);
  assert.deepEqual(scoreActuation(inputs({ programs: [program("P1", "2026-08-01")] })).expiries, []);
});

test("items count when verified and posted in the 90 days ending today", () => {
  const items = [
    { postedOn: "2026-11-16", verifiedOn: "2026-11-16" },
    { postedOn: "2026-08-19", verifiedOn: "2026-08-20" },
    { postedOn: "2026-08-18", verifiedOn: "2026-08-20" },
    { postedOn: "2026-11-17", verifiedOn: "2026-11-17" },
    { postedOn: "2026-11-01", verifiedOn: null },
  ];
  assert.equal(itemsInWindow(items, TODAY), 2);
});

const lapsedRows: ClientBasisRow[] = [
  { factor: "P1", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: null },
  { factor: "P2", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: null },
  { factor: "E2", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: 3 },
  { factor: "E3", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: 0 },
];

test("the client basis maps rows not in place to nothing, so lapsed reads as never", () => {
  const basis = clientBasis(lapsedRows);
  assert.deepEqual(basis, { programs: [], items: { E2: 3, E3: 0 } });
  const inPlace = clientBasis([
    { ...lapsedRows[0], in_place: true, verified_on: "2026-11-01", expires_on: "2027-01-30", target_domain_count: 2, cadence_per_30_days: 4 },
    ...lapsedRows.slice(1),
  ]);
  const score = scoreActuation(inputs({ ...inPlace, ownedAnswers: null }));
  assert.equal(score.factors.P1.points, 20);
  assert.equal(score.factors.E2.points, 3.8);
});

test("the client read asks the database for that client only (decision 84)", async () => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const fake = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      return Promise.resolve({ data: lapsedRows, error: null });
    },
  };
  assert.ok(await readActuationBasis(fake, "fender"));
  assert.ok(await readActuationBasis(fake, "ledlenser"));
  assert.deepEqual(calls, [
    ["actuation_basis", { p_client_key: "fmic" }],
    ["actuation_basis", { p_client_key: "ledlenser" }],
  ]);
  const missing = { rpc: () => Promise.resolve({ data: null, error: { code: "PGRST202" } }) };
  assert.equal(await readActuationBasis(missing, "fender"), null);
});

const MIGRATION = readFileSync(
  new URL("../supabase/migrations/20261116200000_actuation_records.sql", import.meta.url),
  "utf8",
);

function fnBody(name: string): string {
  const start = MIGRATION.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, name);
  const end = MIGRATION.indexOf("$$;", start);
  return MIGRATION.slice(start, end);
}

test("migration: every read filters to the client asked for; staff reads and writes check staff", () => {
  const basis = fnBody("actuation_basis");
  assert.match(basis, /p\.client_key = p_client_key/);
  assert.match(basis, /i\.client_key = p_client_key/);
  const returns = basis.slice(basis.indexOf("returns table"), basis.indexOf("language"));
  assert.doesNotMatch(returns, /name|note|url|owner/);
  for (const name of ["actuation_programs_for_staff", "actuation_items_for_staff"]) {
    const body = fnBody(name);
    assert.match(body, /command\.is_intofocus_admin\(\)/);
    assert.match(body, /client_key = p_client_key/);
    assert.match(body, /security definer/);
  }
  for (const name of ["actuation_program_save", "actuation_item_save", "actuation_item_remove"]) {
    const body = fnBody(name);
    assert.match(body, /if not command\.is_intofocus_admin\(\) then\s+raise exception [^;]+errcode = '42501'/);
    assert.match(body, /security definer\s+set search_path/);
  }
  assert.match(MIGRATION, /grant execute on function public\.actuation_basis\(text\) to anon, authenticated;/);
  assert.doesNotMatch(MIGRATION, /grant [^;]*(_for_staff|_save|_remove)[^;]* to anon/);
  assert.match(MIGRATION, /revoke all on table public\.actuation_programs from public, anon, authenticated;/);
  assert.match(MIGRATION, /revoke all on table public\.actuation_items from public, anon, authenticated;/);
  assert.match(MIGRATION, /expires_on date generated always as \(verified_on \+ 90\) stored/);
  assert.match(MIGRATION, /-- How to undo/);
});

test("migration only adds: no alter or drop outside the undo notes", () => {
  const code = MIGRATION.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
  assert.doesNotMatch(code, /\bdrop\b/i);
  assert.doesNotMatch(code, /alter table (?!public\.actuation_(programs|items) enable row level security)/i);
});

test("program payloads normalize domains and refuse future dates", () => {
  const ok = programPayload(
    {
      client: "ledlenser",
      factor: "P1",
      ownerName: " Pat ",
      targetDomains: "https://www.Reddit.com/r/flashlight, reddit.com\nbackpackinglight.com",
      amount: "4",
      evidenceUrl: "https://docs.example.com/plan",
      verifiedOn: "2026-11-10",
      note: "",
    },
    TODAY,
  );
  assert.deepEqual(ok, {
    ok: true,
    payload: {
      p_client_key: "ledlenser",
      p_factor: "P1",
      p_owner_name: "Pat",
      p_target_domains: ["backpackinglight.com", "reddit.com"],
      p_cadence_per_30_days: 4,
      p_target_count: null,
      p_evidence_url: "https://docs.example.com/plan",
      p_verified_on: "2026-11-10",
      p_note: null,
    },
  });
  const base = { client: "fender" as const, factor: "P2" as const, ownerName: "", targetDomains: "", amount: "5", evidenceUrl: "", verifiedOn: "", note: "" };
  assert.equal(programPayload({ ...base, verifiedOn: "2026-11-17" }, TODAY).ok, false);
  assert.equal(programPayload({ ...base, amount: "0" }, TODAY).ok, false);
  assert.equal(programPayload({ ...base, targetDomains: "not a domain" }, TODAY).ok, false);
  assert.equal(programPayload({ ...base, evidenceUrl: "ftp://x" }, TODAY).ok, false);
  const p2 = programPayload(base, TODAY);
  assert.ok(p2.ok && p2.payload.p_client_key === "fmic" && p2.payload.p_target_count === 5 && p2.payload.p_cadence_per_30_days === null);
});

test("item payloads need a link and dates, verified on or after posted", () => {
  const base = { client: "fender" as const, factor: "E3" as const, url: "https://www.guitarworld.com/review", postedOn: "2026-11-01", verifiedOn: "2026-11-02", note: "" };
  const ok = itemPayload(base, TODAY);
  assert.ok(ok.ok && ok.payload.p_client_key === "fmic" && ok.payload.p_factor === "E3");
  assert.equal(itemPayload({ ...base, url: "guitarworld.com" }, TODAY).ok, false);
  assert.equal(itemPayload({ ...base, verifiedOn: "2026-10-31" }, TODAY).ok, false);
  assert.equal(itemPayload({ ...base, postedOn: "2026-11-17", verifiedOn: "2026-11-17" }, TODAY).ok, false);
});

test("the page shows the staff message, not data, to anyone but staff (decision 85)", () => {
  const page = readFileSync(new URL("../app/(canvas)/dashboard/actuation-records/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!session\?\.isIntoFocusAdmin && !preview\) \{\s+return <StaffOnlyNotice[^>]*title="Actuation records"/);
  assert.ok(page.indexOf("<StaffOnlyNotice") < page.indexOf("loadActuationRecords(client)"), "nothing is read before the check");
  assert.match(page, /process\.env\.E2E_AUTH_BYPASS !== "1" \|\| process\.env\.NODE_ENV === "production"/);
  const actions = readFileSync(new URL("../components/staff/actuation-actions.ts", import.meta.url), "utf8");
  assert.match(actions, /session\?\.isIntoFocusAdmin \? createClient\(\) : null/);
  assert.equal((actions.match(/await staffClient\(\);\n\s+if \(!supabase\) return \{ ok: false, message: STAFF_ONLY \};/g) ?? []).length, 3);
});

test("E1 counts only engines that returned a citation in the window, decided from the data (decision 97)", () => {
  const engines = [
    { engine: "chatgpt_search", citations: 120, withOwned: 6, resolved: 20 },
    { engine: "perplexity", citations: 80, withOwned: 4, resolved: 20 },
    // An API engine with no citations yet is left out, answers and all.
    { engine: "openai_api", citations: 0, withOwned: 0, resolved: 20 },
  ];
  assert.deepEqual(ownedAnswersFromEngines(engines), { withOwned: 10, resolved: 40 });
  // The same API engine joins on its own once it returns citations.
  const joined = engines.map((row) => (row.engine === "openai_api" ? { ...row, citations: 5, withOwned: 2 } : row));
  assert.deepEqual(ownedAnswersFromEngines(joined), { withOwned: 12, resolved: 60 });
  assert.equal(ownedAnswersFromEngines([{ engine: "gemini", citations: 0, withOwned: 0, resolved: 9 }]), null);
  assert.equal(ownedAnswersFromEngines([]), null);
  // E1_TARGET stays null, so E1 stays pending and the score still counts from 0.
  const score = scoreActuation(inputs({ ownedAnswers: ownedAnswersFromEngines(engines) }));
  assert.equal(score.factors.E1.status, "pending");
  assert.equal(score.score, 0);
});
