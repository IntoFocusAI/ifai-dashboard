// npm test -- or: node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/security-disclosure.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SECURITY_PAGE,
  SECURITY_PATH,
  securityPageStrings,
} from "../app/(canvas)/dashboard/security/security-copy.ts";

/** The client portal says nothing about IntoFocus fees or commercial terms, in any form. */
const COMMERCIAL =
  /\b(fees?|pric(e|es|ed|ing)|retainers?|monthly|per month|charges?|billing|invoices?|subscriptions?|commercial|costs?|contracts?|ROI|paid|payments?|tiers?|plans? and pricing)\b/i;

/** No certification, standard, or control is claimed unless the repo shows it. */
const UNVERIFIED_CONTROLS =
  /\b(SOC ?2|ISO|27001|HIPAA|GDPR|CCPA|PCI|encrypt\w*|certif\w*|complian\w*|guarantee\w*|audited|penetration|pen test)\b/i;

const ROUTE_DIR = "app/(canvas)/dashboard/security";
const SOURCES = [
  `${ROUTE_DIR}/page.tsx`,
  `${ROUTE_DIR}/SecurityThemeRoot.tsx`,
  `${ROUTE_DIR}/security-copy.ts`,
];

test("the security page shows no fee, pricing, retainer, or commercial wording", () => {
  for (const line of securityPageStrings()) {
    assert.doesNotMatch(line, COMMERCIAL, `commercial wording on the page: "${line}"`);
    assert.doesNotMatch(line, /[$€£]/, `currency on the page: "${line}"`);
  }
  for (const file of SOURCES) {
    assert.doesNotMatch(readFileSync(file, "utf8"), COMMERCIAL, `commercial wording in ${file}`);
  }
});

test("the security page claims no certification or control it cannot point to", () => {
  for (const line of securityPageStrings()) {
    assert.doesNotMatch(line, UNVERIFIED_CONTROLS, `unverified control on the page: "${line}"`);
  }
});

test("the security page shows exactly the approved claims, with planned and undecided items labeled", () => {
  const byId = Object.fromEntries(SECURITY_PAGE.sections.map((s) => [s.id, s]));
  assert.deepEqual(
    SECURITY_PAGE.sections.map((s) => [s.heading, s.status]),
    [
      ["In place now", "live"],
      ["Planned", "planned"],
      ["Not decided yet", "undecided"],
    ],
  );
  assert.deepEqual(
    byId["in-place"].items.map((i) => i.text),
    [
      "No secret keys ship in the browser bundle.",
      "IntoFocus's internal notes never appear in your evidence views.",
    ],
  );
  assert.deepEqual(byId.planned.items.map((i) => i.text), ["Separating client data by brand"]);
  assert.match(byId.planned.items[0].detail ?? "", /^Planned before a second client joins\.$/);
  assert.deepEqual(byId.undecided.items.map((i) => i.text), [
    "Single sign-on (SSO)",
    "Audit export",
    "Data-processing agreement wording",
  ]);
  const live = byId["in-place"].items.flatMap((i) => [i.text, i.detail ?? ""]).join(" ");
  assert.doesNotMatch(live, /brand|SSO|single sign-on|audit export|data-processing/i);
});

test("security copy follows the dashboard copy rules", () => {
  for (const line of securityPageStrings()) {
    assert.doesNotMatch(line, /\u2014/, `em dash in "${line}"`);
    assert.doesNotMatch(line, /!/, `exclamation mark in "${line}"`);
  }
});

test("the user menu links to the security page", () => {
  const menu = readFileSync("components/auth/UserMenuDropdown.tsx", "utf8");
  assert.equal(SECURITY_PATH, "/dashboard/security");
  assert.match(menu, /SECURITY_PATH/);
  assert.match(menu, /<span>Security<\/span>/);
  assert.doesNotMatch(menu, /\btitle=\{?["'`]Security/);
});
