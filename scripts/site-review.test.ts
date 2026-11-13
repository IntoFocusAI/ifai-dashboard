// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/site-review.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  answersByDomain,
  citedReviewRows,
  overridePayload,
  reviewCells,
  reviewRows,
  SITE_TYPE_LABELS,
} from "../lib/ai-search/site-review.ts";
import { STORED_SITE_TYPES } from "../lib/ai-search/site-types.ts";

/* Staff Sites to review: the list filter and the override payload. */

const view = (domain: string, extra: Record<string, unknown> = {}) => ({
  client_key: "fmic",
  domain,
  site_type: "retailer",
  source: "ai",
  confidence: 0.5,
  needs_review: true,
  ...extra,
});

test("the list keeps flagged AI rows only, lowest confidence first", () => {
  const rows = reviewRows(
    [
      view("musiciangoods.com", { confidence: 0.55 }),
      view("adorama.com", { confidence: 0.28 }),
      view("sweetwater.com", { needs_review: false, confidence: 0.95 }),
      view("fender.com", { source: "seed", confidence: null, needs_review: false }),
      view("staff-set.com", { source: "staff", needs_review: false }),
      view("odd.com", { site_type: "blog" }),
      view("noconf.com", { confidence: null }),
      view("WWW.Long-McQuade.com", { site_type: "other", confidence: 0.41 }),
    ],
    { fromStaffRead: false },
  );
  assert.deepEqual(
    rows.map((row) => [row.domain, row.confidence]),
    [
      ["adorama.com", 0.28],
      ["long-mcquade.com", 0.41],
      ["musiciangoods.com", 0.55],
    ],
  );
  assert.equal(rows[0].reason, null, "the public view has no reason");
  assert.equal(rows[0].isGlobal, false);
  assert.equal(rows[0].answers, 0, "no answers passed, none counted");
});

test("a site staff decided in this visit leaves the list; duplicates show once", () => {
  const rows = reviewRows([view("adorama.com"), view("adorama.com"), view("gearcaddy.co.uk")], {
    fromStaffRead: false,
    decided: new Set(["gearcaddy.co.uk"]),
  });
  assert.deepEqual(rows.map((row) => row.domain), ["adorama.com"]);
});

test("the staff read carries the reason and the global flag, and skips the view-only checks", () => {
  const rows = reviewRows(
    [
      { domain: "adorama.com", site_type: "retailer", confidence: "0.28", reason: "Camera store.\nSecond line.", is_global: true },
      { domain: "byroncustomguitars.com", site_type: "competitor_brand", confidence: 0.65, reason: " ", is_global: false },
    ],
    { fromStaffRead: true, answers: new Map([["adorama.com", 3]]) },
  );
  assert.deepEqual(rows[0], {
    domain: "adorama.com",
    siteType: "retailer",
    confidence: 0.28,
    reason: "Camera store.",
    isGlobal: true,
    answers: 3,
  });
  assert.equal(rows[1].reason, null);
  assert.equal(rows[1].answers, 0, "a listed site no answer cites reads 0");
});

test("answers count distinct answers citing the site or a subdomain", () => {
  const counts = answersByDomain(
    [
      { domain: "adorama.com", simulationId: "a" },
      { domain: "adorama.com", simulationId: "a" },
      { domain: "shop.adorama.com", simulationId: "b" },
      { domain: "notadorama.com", simulationId: "c" },
      { domain: "files.kraftmusic.com", simulationId: "d" },
      { domain: "kraftmusic.com", simulationId: "e" },
    ],
    ["adorama.com", "files.kraftmusic.com", "tonestakr.com"],
  );
  assert.deepEqual(Object.fromEntries(counts), { "adorama.com": 2, "files.kraftmusic.com": 1, "tonestakr.com": 0 });
});

test("the list holds only flagged sites this client's answers cite in the window (decision 84)", () => {
  const raw = [
    view("adorama.com", { confidence: 0.28 }),
    view("ledlenser-only.de", { confidence: 0.3 }),
    view("musiciangoods.com", { confidence: 0.55 }),
    view("sweetwater.com", { needs_review: false }),
  ];
  const cited = [
    { domain: "shop.adorama.com", simulationId: "run1:a" },
    { domain: "adorama.com", simulationId: "run2:b" },
    { domain: "musiciangoods.com", simulationId: "run2:b" },
    { domain: "sweetwater.com", simulationId: "run2:c" },
  ];
  const rows = citedReviewRows(raw, { fromStaffRead: false }, cited);
  assert.deepEqual(
    rows.map((row) => [row.domain, row.answers]),
    [
      ["adorama.com", 2],
      ["musiciangoods.com", 1],
    ],
    "an uncited flagged site is hidden; a cited unflagged site is not listed",
  );
  assert.deepEqual(citedReviewRows(raw, { fromStaffRead: false }, []), [], "no answers in the window, no list");
  assert.deepEqual(
    citedReviewRows(raw, { fromStaffRead: false, decided: new Set(["adorama.com"]) }, cited).map((row) => row.domain),
    ["musiciangoods.com"],
  );
});

test("the page shows a staff message, not data, to anyone but staff (decision 85)", () => {
  const page = readFileSync(new URL("../app/(canvas)/dashboard/sites-to-review/page.tsx", import.meta.url), "utf8");
  const notice = readFileSync(new URL("../components/staff/StaffOnlyNotice.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!session\?\.isIntoFocusAdmin\) return <StaffOnlyNotice/);
  assert.ok(page.indexOf("StaffOnlyNotice client") < page.indexOf("loadSitesToReview(client)"), "nothing is read before the check");
  assert.match(notice, /This page is for IntoFocus staff\./);
  assert.doesNotMatch(notice, /site-review-read|loadSitesToReview/);
});

test("the override payload confirms or changes the AI type at the classification's level", () => {
  assert.deepEqual(
    overridePayload({ domain: " Adorama.com ", clientKey: "fmic", siteType: "retailer", isGlobal: false, aiType: "retailer" }),
    { p_domain: "adorama.com", p_client_key: "fmic", p_site_type: "retailer", p_note: "Confirmed the AI type on Sites to review." },
  );
  assert.deepEqual(
    overridePayload({ domain: "long-mcquade.com", clientKey: "ledlenser", siteType: "retailer", isGlobal: true, aiType: "other" }),
    { p_domain: "long-mcquade.com", p_client_key: null, p_site_type: "retailer", p_note: "Changed from Other on Sites to review." },
  );
});

test("the override payload refuses a bad type, domain, or client key", () => {
  const base = { domain: "adorama.com", clientKey: "fmic", siteType: "retailer", isGlobal: false, aiType: "retailer" };
  assert.equal(overridePayload({ ...base, siteType: "blog" }), null);
  assert.equal(overridePayload({ ...base, domain: "not a domain" }), null);
  assert.equal(overridePayload({ ...base, domain: "https://adorama.com/x" }), null);
  assert.equal(overridePayload({ ...base, clientKey: "fmic'; drop" }), null);
  assert.equal(overridePayload({ ...base, clientKey: "" }), null);
  assert.notEqual(overridePayload({ ...base, clientKey: "", isGlobal: true }), null, "a global save needs no client");
});

test("every stored type has a label, and the CSV cells follow the header", () => {
  for (const type of STORED_SITE_TYPES) assert.ok(SITE_TYPE_LABELS[type]);
  assert.deepEqual(
    reviewCells({ domain: "adorama.com", siteType: "retailer", confidence: 0.281, reason: null, isGlobal: false, answers: 1234 }),
    ["adorama.com", "Retailer", "28%", "", "1,234"],
  );
});

test("the migration checks staff in both functions and grants nothing to anon", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261112160000_site_type_staff_review.sql", import.meta.url), "utf8");
  const body = sql.replace(/^--.*$/gm, "");
  assert.equal(body.match(/command\.is_intofocus_admin\(\)/g)?.length, 2);
  assert.match(body, /revoke all on function public\.site_type_override\(text, text, text, text\) from public, anon;/);
  assert.doesNotMatch(body, /grant[^;]*to[^;]*anon/);
  assert.doesNotMatch(body, /\b(drop|alter|delete|truncate)\b/i, "additive only");
  assert.match(sql, /How to undo/);
});
