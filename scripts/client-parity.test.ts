// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/client-parity.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildClientRegistry, listClientKeys, validateClientSettings } from "@/lib/client";
import { testClientFilesFrom } from "@/lib/client/registry";
import { lintRepo, lintSource } from "./lint-client-branches.mjs";
import {
  applyDeclared,
  DECLARED_DIFFERENCES,
  declaredChannelColumns,
  findForeign,
  foreignTerms,
  layoutGaps,
  normalizeLine,
  parityClients,
  type ParitySettings,
  withDeclaredDifferences,
} from "../e2e/client-parity-lib.ts";

/* Parity chunk C8 (X-35): the lint that flags client branches, and the helpers the
   client-parity e2e spec uses to compare screens and scan for another client's words. */

const TERMS = ["fender", "ledlenser", "fmic", "squier", "northline"];
const lint = (source: string, file = "lib/x.ts") => lintSource(source, file, TERMS);

test("C8 lint: flags a client key or brand name compared to a literal", () => {
  assert.deepEqual(lint(`if (client === "fender") go();`).map((f) => f.line), [1]);
  assert.deepEqual(lint(`const a = 1;\nreturn key !== 'ledlenser';`).map((f) => f.line), [2]);
  assert.deepEqual(lint(`return "fmic" == setAsideKey;`).map((f) => f.line), [1]);
  assert.deepEqual(lint(`switch (k) {\n  case "Fender":\n    break;\n}`).map((f) => f.line), [2]);
  assert.deepEqual(lint("if (name.includes(`Squier`)) a();").map((f) => f.line), [1]);
  assert.deepEqual(lint(`if (host.startsWith("northline")) a();`).map((f) => f.line), [1]);
});

test("C8 lint: flags helpers named after a client", () => {
  assert.equal(lint(`const x = isFenderClient() ? a : b;`).length, 1);
  assert.equal(lint(`const x = isLedlenser(key);`).length, 1);
  assert.equal(lint(`export function isFenderClient(): boolean {`).length, 0);
  assert.equal(lint(`import { isFenderClient } from "@/lib/brand-copy";`).length, 0);
  assert.equal(lint(`const ok = isFinite(x);`).length, 0);
});

test("C8 lint: leaves comments, other literals and non-comparisons alone", () => {
  assert.equal(lint(`// client === "fender" was the old rule`).length, 0);
  assert.equal(lint(`/* if (key === "ledlenser") {} */\nconst a = 1;`).length, 0);
  assert.equal(lint(`/**\n * key === "fender"\n */`).length, 0);
  assert.equal(lint(`if (retailer === "walmart") a();`).length, 0);
  assert.equal(lint(`const brand = "fender";`).length, 0);
  assert.equal(lint(`const url = "https://fender.com"; // client === "fender"`).length, 0);
  assert.equal(lint(`if (name === "Fenders and more") a();`).length, 0);
});

test("lint:clients says what to use instead: a settings field or a brand helper", () => {
  const fix = (source: string, file = "lib/x.ts") => lint(source, file)[0].fix as string;
  assert.match(fix(`x = isFenderClient() ? RECHECK_DAYS.walmartFender : 2;`), /recheck_days/);
  assert.match(fix(`return isFenderClient() ? FMIC_OWNED_DOMAINS : d;`), /owned_domains/);
  assert.match(fix("const s = `names ${isFenderClient() ? \"Fender, Squier,\" : brandName()}`;"), /leadBrandOr\(\)/);
  assert.match(fix(`if (lead === "fender") return true;`), /leadBrand\(\)/);
  assert.match(fix(`function hasFenderEstimates() {\n  return activeClient().key === "fender";\n}`), /analyst_estimates/);
  assert.match(fix(`export function isFenderClient(): boolean {\n  return activeClient().key === "fender";\n}`), /remove this helper/);
  assert.match(fix(`if (key === "fender") go();`), /brandName\(\)/, "anything else gets the general advice");
  for (const finding of lintRepo()) assert.ok(finding.fix && finding.fix.length > 20, `${finding.file}:${finding.line} has a fix`);
});

test("C8 lint: reports each line once with file and line", () => {
  const found = lint(`x = a === "fender" || b === "ledlenser";\ny = 2;`, "lib/a.ts");
  assert.deepEqual(found.map((f) => `${f.file}:${f.line}`), ["lib/a.ts:1"]);
});

test("C8 lint: the repo scan skips lib/client and data/clients and reads literals from settings", () => {
  const files = new Set(lintRepo().map((f) => f.file));
  for (const f of files) {
    assert.ok(!f.startsWith("lib/client/") && !f.startsWith("data/clients/"), f);
    assert.ok(/^(app|components|lib)\//.test(f) || f === "proxy.ts", f);
  }
});

const rods = (): ParitySettings => JSON.parse(readFileSync("e2e/fixtures/clients/fishingrods.json", "utf8"));
const clients = parityClients();
const byKey = (key: string) => clients.find((c) => c.client_key === key)!;

test("C8 fixture: the made-up fishing client is a valid settings record that ships to no one", () => {
  const settings = validateClientSettings(JSON.parse(readFileSync("e2e/fixtures/clients/fishingrods.json", "utf8")), "e2e/fixtures/clients/fishingrods.json");
  assert.equal(settings.display_name, "Northline Rods");
  assert.deepEqual(settings.owned_domains, ["northlinerods.example"]);
  assert.deepEqual(settings.product_types, ["FISHING_ROD"]);
  assert.deepEqual(settings.competitors.map((c) => c.name), ["Shimano", "St. Croix"]);
  // Not registered unless the build sets NEXT_PUBLIC_TEST_CLIENT_FILES is set.
  assert.ok(!listClientKeys().includes("fishingrods"));
  assert.deepEqual(clients.map((c) => c.client_key).slice(-1), ["fishingrods"]);
  assert.equal(clients[0].is_default, true);
});

test("C8 fixture: the test build variable adds clients, and an unset variable adds none", () => {
  assert.deepEqual(testClientFilesFrom(undefined), []);
  assert.deepEqual(testClientFilesFrom(""), []);
  const raw = JSON.parse(readFileSync("e2e/fixtures/clients/fishingrods.json", "utf8"));
  const files = testClientFilesFrom(JSON.stringify([{ source: "e2e/fixtures/clients/fishingrods.json", raw }]));
  const all = buildClientRegistry([
    { source: "data/clients/fender.json", raw: JSON.parse(readFileSync("data/clients/fender.json", "utf8")) },
    ...files,
  ]);
  assert.deepEqual(all.map((c) => c.client_key), ["fender", "fishingrods"]);
  assert.throws(() => testClientFilesFrom("{}"), /JSON list/);
});

test("C8 helpers: foreign words come from the other clients and a short vertical list", () => {
  const forFishing = foreignTerms(byKey("fishingrods"), clients).map((t) => t.term);
  for (const want of ["Fender", "Squier", "fender.com", "Yamaha", "Ledlenser", "ledlenser.com", "Petzl", "guitar", "flashlight", "headlamp", "lumens"]) {
    assert.ok(forFishing.includes(want), want);
  }
  assert.ok(!forFishing.includes("Shimano"));
  assert.ok(!forFishing.includes("fishing rod") && !forFishing.includes("Northline"));
  const forFender = foreignTerms(byKey("fender"), clients).map((t) => t.term);
  assert.ok(forFender.includes("Northline") && forFender.includes("Shimano") && forFender.includes("fishing rod"));
  assert.ok(!forFender.includes("Fender") && !forFender.includes("guitar") && !forFender.includes("Stratocaster"));
  // A Fender catalog row names Stratocasters, and a Ledlenser row names headlamps: that is each client's own data.
  assert.ok(!foreignTerms(byKey("ledlenser"), clients).some((t) => t.term === "headlamp"));
});

test("C8 helpers: a foreign word on a screen is a hit, an own word is not", () => {
  const client = byKey("fishingrods");
  const terms = foreignTerms(client, clients);
  const hit = (text: string) => findForeign(client, { id: "t", lines: [], text }, terms).map((h) => h.term);
  assert.deepEqual(hit("Fender, Squier, and Yamaha lead this question"), ["Fender", "Squier", "Yamaha"]);
  assert.deepEqual(hit("Brightness in lumens for each headlamp").sort(), ["headlamp", "lumens"]);
  assert.ok(hit("Visit www.fender.com/shop today").includes("fender.com"));
  assert.deepEqual(hit("Northline Rods against Shimano and St. Croix"), []);
  // Names that are also ordinary words count only when capitalized.
  assert.deepEqual(hit("the coast road and a spark of boss energy"), []);
  assert.ok(hit("Taylor and Martin guitars").includes("Taylor"));
});

test("C8 helpers: lines match across clients once the brand and numbers are normalized", () => {
  const fender = byKey("fender");
  const light = byKey("ledlenser");
  assert.equal(normalizeLine("Fender/Squier listings (1,204)", fender), "{brand} listings (#)");
  assert.equal(normalizeLine("Ledlenser listings (37)", light), "{brand} listings (#)");
  assert.equal(normalizeLine("fender.com pages", fender), "{brand} pages");
  assert.equal(rods().display_name, "Northline Rods");
});

test("C8 helpers: layout gaps list the lines not every client has", () => {
  const cap = (client_key: string, lines: string[]) => ({ client_key, surfaces: [{ id: "spoke-a/Tab", lines, text: "" }] });
  const gaps = layoutGaps(
    [cap("one", ["a", "b", "c"]), cap("two", ["a", "c"]), cap("three", ["a", "c", "d"])],
    (id) => id.startsWith("spoke-a"),
  );
  assert.deepEqual(gaps, [
    { line: "b", has: ["one"], lacks: ["two", "three"] },
    { line: "d", has: ["three"], lacks: ["one", "two"] },
  ]);
  assert.deepEqual(layoutGaps([cap("one", ["a"]), cap("two", ["a"])], () => true), []);
  assert.deepEqual(layoutGaps([cap("one", ["a"]), cap("two", ["a"])], () => false), []);
});

test("decision 113: declared differences are keyed to settings fields, never to a client name", () => {
  const keys = clients.map((c) => c.client_key.toLowerCase());
  for (const rule of DECLARED_DIFFERENCES) {
    assert.ok(rule.why.length > 20, `${rule.id} says why`);
    assert.ok(Object.keys(byKey("fender")).includes(rule.field as string), `${rule.id} is keyed to a real settings field`);
    const src = rule.apply.toString().toLowerCase();
    for (const key of keys) assert.ok(!src.includes(`"${key}"`), `${rule.id} names client ${key}`);
  }
  const lib = readFileSync("e2e/client-parity-lib.ts", "utf8");
  assert.ok(!/client_key\s*===?\s*["']/.test(lib), "no client key compared to a literal");
});

test("decision 113: a retailer column is allowed only where the client's settings list that retailer", () => {
  const fender = byKey("fender");
  assert.deepEqual(declaredChannelColumns(fender), ["Walmart", "Musician's Friend", "Amazon"]);
  assert.deepEqual(declaredChannelColumns(byKey("ledlenser")), ["Walmart", "Amazon"]);
  assert.deepEqual(declaredChannelColumns(byKey("fishingrods")), [], "data sources off: no channel column declared");
  const mapLine = (cols: string) => `catalog/MAP Leakage > columns: LISTING | ASIN | MAP | ${cols}`;
  const cap = (client_key: string, lines: string[]) => ({ client_key, surfaces: [{ id: "catalog/MAP Leakage", lines, text: "" }] });
  const raw = [cap("fender", [mapLine("AMAZON | WALMART | MUSICIAN’S FRIEND")]), cap("ledlenser", [mapLine("AMAZON | WALMART")])];
  assert.equal(layoutGaps(raw, () => true).length, 2, "without the rule the column reports");
  assert.deepEqual(layoutGaps(withDeclaredDifferences(raw, clients), () => true), []);
  // A client that shows a retailer column its settings do not list still reports.
  const undeclared = [cap("fender", [mapLine("AMAZON | WALMART")]), cap("ledlenser", [mapLine("AMAZON | WALMART | MUSICIAN'S FRIEND")])];
  assert.equal(layoutGaps(withDeclaredDifferences(undeclared, clients), () => true).length, 2);
  // Other columns are untouched.
  assert.deepEqual(applyDeclared(["x > columns: ASIN | Amazon completeness"], fender), ["x > columns: ASIN | Amazon completeness"]);
});

test("decision 113: seller-model copy and the logo follow seller_type and logo_src", () => {
  const partner = { ...byKey("fender"), seller_type: "partner_led" };
  const brand = { ...byKey("ledlenser"), seller_type: "brand_led" };
  assert.deepEqual(applyDeclared(["retail > heading: Authorized partners", "retail > heading: Buy Box"], partner), ["retail > heading: Buy Box"]);
  assert.deepEqual(applyDeclared(["retail > heading: Authorized partners"], brand), ["retail > heading: Authorized partners"], "the other model's copy reports");
  assert.deepEqual(applyDeclared(["retail > heading: {brand}'s own seller account"], brand), []);
  const logo = applyDeclared(["map > bubble hub: Summary"], byKey("fender"));
  assert.deepEqual(applyDeclared(["map > bubble hub: {brand} Summary"], byKey("fishingrods")), logo);
  assert.deepEqual(applyDeclared(["map > bubble hub: {brand}"], byKey("fishingrods")), applyDeclared(["map > bubble hub: "], byKey("fender")));
  assert.deepEqual(applyDeclared(["map > bubble hub: Something else"], byKey("fishingrods")), ["map > bubble hub: Something else"]);
});
