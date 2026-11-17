// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/client-settings.test.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  activeClient,
  buildClientRegistry,
  ClientSettingsError,
  clientHref,
  clientKeyForSetAsideKey,
  clientKeyFromSearch,
  clientProfile,
  defaultClientKey,
  getClientSettings,
  isClientKey,
  listClientKeys,
  listClients,
  parseClientKey,
  registeredClientFiles,
  validateClientSettings,
  type ClientSettings,
} from "@/lib/client";
import { resetActiveClientForTests } from "@/lib/client/active-client";
import { brandOwned, brandSite, leadBrand, leadBrandOr } from "@/lib/brand-copy";

const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
const fender = () => read("data/clients/fender.json");

function problemsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ClientSettingsError, String(error));
    return error.problems;
  }
  assert.fail("expected a ClientSettingsError");
}

test("C1: every settings file in data/clients is registered, valid, and in switcher order", () => {
  const onDisk = readdirSync("data/clients").filter((f) => f.endsWith(".json")).map((f) => `data/clients/${f}`).sort();
  assert.deepEqual([...registeredClientFiles()].sort(), onDisk);
  assert.deepEqual(listClientKeys(), ["fender", "ledlenser"]);
  assert.deepEqual(listClients().map((c) => c.display_name), ["Fender", "Ledlenser"]);
  assert.equal(defaultClientKey(), "fender");
  assert.equal(isClientKey("ledlenser"), true);
  assert.equal(isClientKey("acme"), false);
  assert.equal(parseClientKey("acme"), "fender");
  assert.equal(parseClientKey(null), "fender");
  assert.equal(clientKeyFromSearch("?client=ledlenser"), "ledlenser");
  assert.equal(clientKeyForSetAsideKey("fmic"), "fender");
  assert.equal(clientKeyForSetAsideKey("ledlenser"), "ledlenser");
  assert.equal(clientKeyForSetAsideKey("nobody"), null);
  assert.throws(() => getClientSettings("acme"), /Unknown client "acme". Known clients: fender, ledlenser/);
});

test("C1: profiles match the values the code hard-coded before the settings files", () => {
  const f = clientProfile("fender");
  assert.deepEqual(
    [f.brandName, f.schema, f.setAsideKey, f.logoSrc, f.brandSiteLabel, f.promptsEditable, f.sellerModel, f.roadmapFocusCategory],
    ["Fender", "public", "fmic", "/image.png", "fender.com", true, "Partner-led", null],
  );
  assert.deepEqual([...f.defaultBuyBoxPartners], ["Austin Bazaar", "GearTree"]);
  const l = clientProfile("ledlenser");
  assert.deepEqual(
    [l.brandName, l.schema, l.setAsideKey, l.logoSrc, l.brandSiteLabel, l.promptsEditable, l.sellerModel, l.roadmapFocusCategory],
    ["Ledlenser", "ledlenser", "ledlenser", "/ledlenser-logo-white.png", "ledlenser.com", false, "Brand-led", null],
  );
  assert.deepEqual(l.brandSiteDomains, ["ledlenser.com", "ledlenserusa.com"]);
  assert.deepEqual([...l.defaultBuyBoxPartners], []);
  assert.equal(clientHref("fender", "/dashboard"), "/dashboard");
  assert.equal(clientHref("ledlenser", "/dashboard"), "/dashboard?client=ledlenser");
});

test("C1: settings values equal the constants the screens still read (no behavior change)", async () => {
  // C2 moved owned domains, brand words and site lists into settings and data/reference/; the
  // competitor sites in settings still name the same brand the vertical reference list does.
  const { referenceBrandSites } = await import("@/lib/ai-search/reference-sites");
  const { CATALOG_ROTATION_RULE } = await import("@/lib/ai-search/probe-catalog");
  const { TRUSTED_COLLECTOR_VERSION } = await import("@/lib/ai-search/history-eligibility");
  const { catalogBundleLineLabel } = await import("@/lib/fender-canvas/portfolio-retail");
  const f = getClientSettings("fender");
  const l = getClientSettings("ledlenser");
  assert.deepEqual(f.default_authorized_partners, ["Austin Bazaar", "GearTree"]);
  for (const client of [f, l]) {
    const listed = new Map<string, string>(referenceBrandSites(client.vertical));
    for (const c of client.competitors) for (const d of c.domains) assert.equal(listed.get(d), c.name, d);
  }
  assert.deepEqual(
    [...f.retailers, ...l.retailers].map((r) => `${r.key}:${r.recheck_days}`),
    ["walmart:1", "musiciansfriend:3", "walmart:2"],
  );
  assert.equal(f.catalog_rotation_rule, CATALOG_ROTATION_RULE);
  assert.equal(f.collector_version_pin, TRUSTED_COLLECTOR_VERSION);
  assert.equal(l.collector_version_pin, null);
  for (const [long, short] of Object.entries(f.category_short_labels)) assert.equal(catalogBundleLineLabel(long), short);
  // The guitar word list in question-role.ts is Fender's brand, model-line, and competitor terms.
  const source = readFileSync("lib/ai-search/question-role.ts", "utf8");
  const words = /const BRAND =\s*\/\\b\(([^)]+)\)/.exec(source)![1]!.split("|").sort();
  assert.deepEqual([...f.brand_name_terms, ...f.product_line_terms, ...f.competitors.flatMap((c) => c.terms)].sort(), words);
});

test("C1: analyst estimates in settings match what the screens show", async () => {
  const { phaseOneLiftEstimate, enterprisePotentialEstimate } = await import("@/lib/fender-canvas/analyst-estimates");
  try {
    resetActiveClientForTests("fender");
    const est = getClientSettings("fender").analyst_estimates!;
    assert.equal(phaseOneLiftEstimate(), `${est.phase_one} est.`);
    assert.equal(enterprisePotentialEstimate(), `${est.enterprise} est.`);
    const spec = readFileSync("data/fender-v3-spec.json", "utf8");
    for (const line of [...est.phase_one_lines, ...est.enterprise_lines]) {
      assert.ok(spec.includes(line.value), line.value);
      assert.ok(spec.includes(line.label.replace("&", "&amp;")) || spec.includes(line.label), line.label);
    }
    assert.equal(getClientSettings("ledlenser").analyst_estimates, null);
  } finally {
    resetActiveClientForTests();
  }
});

test("C1: brand copy reads the settings record per call", async () => {
  const { runWithClient } = await import("@/lib/client/server-client");
  try {
    resetActiveClientForTests("fender");
    assert.deepEqual([leadBrand(), leadBrandOr(), brandSite(), brandOwned()], ["Fender/Squier", "Fender or Squier", "fender.com", "Fender-owned"]);
    resetActiveClientForTests("ledlenser");
    assert.deepEqual([leadBrand(), leadBrandOr(), brandSite(), brandOwned()], ["Ledlenser", "Ledlenser", "ledlenser.com", "Ledlenser-owned"]);
    resetActiveClientForTests();
    assert.equal(activeClient().key, "fender");
    assert.equal(await runWithClient("ledlenser", async () => leadBrand()), "Ledlenser");
    assert.equal(leadBrand(), "Fender/Squier");
  } finally {
    resetActiveClientForTests();
  }
});

test("C1: a bad settings file fails with the file name and each problem", () => {
  const missing = fender();
  delete missing.owned_domains;
  assert.throws(() => validateClientSettings(missing, "data/clients/fender.json"), (error: Error) => {
    assert.match(error.message, /Client settings data\/clients\/fender\.json are not valid/);
    assert.match(error.message, /owned_domains is missing/);
    return true;
  });
  assert.deepEqual(problemsOf(() => validateClientSettings({ ...fender(), seller_type: "dealer" }, "x")), [
    "seller_type must be one of partner_led, brand_led, amazon_retail_only, hybrid, no_managed_presence",
  ]);
  assert.deepEqual(problemsOf(() => validateClientSettings({ ...fender(), seller_type: "hybrid" }, "x")), [
    "seller_type hybrid is not built yet; the dashboard draws partner_led and brand_led",
  ]);
  const many = problemsOf(() =>
    validateClientSettings({ ...fender(), client_key: "Fender Co", brand_name_terms: ["Fender"], logo_src: "image.png", colour: "red" }, "x"),
  );
  assert.ok(many.includes("colour is not a settings field"));
  assert.ok(many.includes("brand_name_terms must be lowercase"));
  assert.ok(many.includes("logo_src must be a path under public/, starting with /"));
  assert.ok(many.some((p) => p.startsWith("client_key must be lowercase")));
  const sources = { ...(fender().data_sources as object) } as Record<string, unknown>;
  delete sources.walmart;
  assert.deepEqual(problemsOf(() => validateClientSettings({ ...fender(), data_sources: sources }, "x")), [
    "data_sources.walmart must be true or false",
  ]);
  assert.deepEqual(problemsOf(() => validateClientSettings("not an object", "x")), ["the file must hold one JSON object"]);
  assert.deepEqual(problemsOf(() => validateClientSettings({ ...fender(), analyst_estimates: { phase_one: "+$1" } }, "x")), [
    "analyst_estimates.enterprise must be a non-empty string",
    "analyst_estimates.phase_one_lines must be a list of {label, value}",
    "analyst_estimates.enterprise_lines must be a list of {label, value}",
  ]);
});

test("C1: the client list fails on a key that does not match its file, duplicates, or no single default", () => {
  const f = fender();
  const l = read("data/clients/ledlenser.json");
  assert.deepEqual(problemsOf(() => buildClientRegistry([{ source: "data/clients/acme.json", raw: f }])), [
    "client_key fender must match the file name (acme.json)",
  ]);
  assert.deepEqual(
    problemsOf(() => buildClientRegistry([{ source: "a/fender.json", raw: f }, { source: "b/fender.json", raw: f }])),
    ["client_key fender is used by more than one client", "set_aside_key fmic is used by more than one client", "exactly one client must set is_default (found fender, fender)"],
  );
  assert.deepEqual(problemsOf(() => buildClientRegistry([{ source: "data/clients/ledlenser.json", raw: l }])), [
    "exactly one client must set is_default (found none)",
  ]);
  assert.deepEqual(problemsOf(() => buildClientRegistry([])), [
    "there are no client settings files",
    "exactly one client must set is_default (found none)",
  ]);
});

test("C1: a made-up third client loads from a settings record alone", () => {
  const rods: ClientSettings = {
    ...(read("data/clients/ledlenser.json") as unknown as ClientSettings),
    client_key: "northline-rods",
    set_aside_key: "northline",
    display_name: "Northline Rods",
    legal_name: "Northline Rods Inc.",
    data_schema: "northline",
    logo_src: null,
    lead_brand_label: "Northline",
    lead_brand_phrase: "Northline",
    brand_name_terms: ["northline"],
    portfolio_brands: ["Northline"],
    owned_domains: ["northlinerods.com"],
    brand_site_label: "northlinerods.com",
    brand_seller_ids: [],
    amazon_brand_names: ["Northline"],
    product_types: ["FISHING_ROD"],
    vertical: "fishing",
    competitors: [{ name: "Ugly Stik", terms: ["ugly stik"], domains: ["uglystik.com"] }],
  };
  const clients = buildClientRegistry([
    { source: "data/clients/fender.json", raw: fender() },
    { source: "data/clients/northline-rods.json", raw: rods },
  ]);
  assert.deepEqual(clients.map((c) => c.client_key), ["fender", "northline-rods"]);
});
