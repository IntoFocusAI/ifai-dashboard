// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/client-brand-words.test.ts
// Parity chunk C2 (X-35, decision 105): AI Search brand words, owned domains, vertical reference
// lists and competitor sites come from the client settings and data/reference/, never from a
// branch on the client name. Site types are kept per client (X-16).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  brandTermPattern,
  countsWithLeadSentence,
  leadBrandNames,
  namedBrandsPhrase,
  ownedSitesOwner,
  productLineExample,
} from "../lib/ai-search/brand-words.ts";
import { classifySource, isOwnedDomain, SOURCE_CLASS_LABELS } from "../lib/ai-search/citations.ts";
import { unbrandedBrandSites } from "../lib/ai-search/citation-insights.ts";
import { AI_DEFINITIONS } from "../lib/ai-search/definitions.ts";
import {
  matchesDomain,
  referenceBrandSites,
  referenceDomains,
  referenceVerticals,
  verticalReference,
} from "../lib/ai-search/reference-sites.ts";
import {
  ensureSiteTypes,
  installedSiteTypes,
  resetSiteTypeLoadsForTests,
  storedSourceClass,
  type SiteTypeReadClient,
} from "../lib/ai-search/site-types.ts";
import { whyNotBrand } from "../lib/ai-search/why-not-brand.ts";
import { getClientSettings, listClients, resetActiveClientForTests } from "../lib/client/active-client.ts";
import { runWithClient } from "../lib/client/server-client.ts";

afterEach(() => {
  resetSiteTypeLoadsForTests();
  resetActiveClientForTests(null);
});

test("brand matching is tolerant of case and spacing, and whole-word only", () => {
  const led = brandTermPattern(getClientSettings("ledlenser").brand_name_terms)!;
  for (const text of ["Ledlenser P7R", "the LED Lenser MH10", "a Led-Lenser torch", "LEDLENSER", "led  lenser"]) {
    assert.ok(led.test(text), text);
  }
  assert.equal(led.test("a ledger of lenses"), false);
  const fender = brandTermPattern(getClientSettings("fender").brand_name_terms)!;
  assert.ok(fender.test("A Squier Strat"));
  assert.ok(fender.test("FENDER amps"));
  assert.equal(fender.test("Fenderbender"), false);
  assert.equal(brandTermPattern([]), null);
});

test("Ledlenser lists led lenser, and an answer naming LED Lenser counts as a brand mention", () => {
  assert.deepEqual(getClientSettings("ledlenser").brand_name_terms, ["ledlenser", "led lenser"]);
  resetActiveClientForTests("ledlenser");
  assert.equal(whyNotBrand({ answerText: "Pick the LED Lenser MH10.", winner: "Petzl", pages: [] }).brandMentioned, true);
  assert.equal(whyNotBrand({ answerText: "Pick the Petzl Actik.", winner: "Petzl", pages: [] }).brandMentioned, false);
  resetActiveClientForTests("fender");
  assert.equal(whyNotBrand({ answerText: "A Squier Affinity is fine.", winner: "Yamaha", pages: [] }).brandMentioned, true);
  assert.equal(whyNotBrand({ answerText: "Pick the LED Lenser MH10.", winner: "Yamaha", pages: [] }).brandMentioned, false);
});

test("brand words come from the settings record", () => {
  resetActiveClientForTests("fender");
  assert.deepEqual(leadBrandNames(), ["Fender", "Squier"]);
  assert.equal(countsWithLeadSentence(), "Squier counts with Fender.");
  assert.equal(namedBrandsPhrase(), "Fender, Squier,");
  assert.equal(productLineExample(), ", such as Stratocaster,");
  assert.equal(ownedSitesOwner(), "Fender or a brand it owns (Squier, Jackson, EVH, Gretsch)");
  assert.match(AI_DEFINITIONS["Branded Consideration"], /names Fender, Squier, or a rival/);
  assert.match(AI_DEFINITIONS["brand-associated discovery"], /model line, such as Stratocaster, while/);
  resetActiveClientForTests("ledlenser");
  assert.deepEqual(leadBrandNames(), ["Ledlenser"]);
  assert.equal(countsWithLeadSentence(), null);
  assert.equal(namedBrandsPhrase(), "Ledlenser");
  assert.equal(productLineExample(), "");
  assert.equal(ownedSitesOwner(), "Ledlenser");
  // Definitions read the client per call, not the one at import.
  assert.match(AI_DEFINITIONS["Branded Consideration"], /names Ledlenser or a rival/);
  assert.match(AI_DEFINITIONS["Fender-owned"], /controlled by Ledlenser,/);
  assert.match(AI_DEFINITIONS["product fact check"], /a Ledlenser product/);
});

test("no AI Search file in chunk C2 branches on a client name or holds a client's site list", () => {
  const files = [
    "lib/ai-search/citations.ts",
    "lib/ai-search/citation-insights.ts",
    "lib/ai-search/why-not-brand.ts",
    "lib/ai-search/definitions.ts",
    "lib/ai-search/run-metrics.ts",
    "lib/ai-search/brand-words.ts",
    "lib/ai-search/reference-sites.ts",
    "lib/ai-search/site-types.ts",
    "components/v3/live/ai-search/CitationEcosystemPanel.tsx",
    "components/v3/live/ai-search/CategoryBattlecardsPanel.tsx",
  ];
  for (const file of files) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(code, /isFenderClient|isLedlenser|["'`](fender|ledlenser|fmic|squier)["'`]\s*[=!]==?|[=!]==?\s*["'`](fender|ledlenser|fmic|squier)["'`]/i, file);
    assert.doesNotMatch(code, /guitarworld\.com|1lumen\.com|petzl\.com|yamaha\.com|fender\.com|ledlenser\.com/, file);
  }
});

test("owned domains and the regional rule come from settings", () => {
  resetActiveClientForTests("fender");
  for (const d of getClientSettings("fender").owned_domains) assert.equal(isOwnedDomain(d), true, d);
  assert.equal(isOwnedDomain("uk.fender.com"), true);
  assert.equal(isOwnedDomain("fender.co.uk"), false, "regional_site_rule is off for Fender");
  assert.equal(isOwnedDomain("ledlenser.com"), false);
  resetActiveClientForTests("ledlenser");
  assert.equal(isOwnedDomain("ledlenserusa.com"), true);
  assert.equal(isOwnedDomain("ledlenser.co.uk"), true, "regional_site_rule is on for Ledlenser");
  assert.equal(isOwnedDomain("media.ledlenser.com"), true);
  assert.equal(isOwnedDomain("fender.com"), false);
});

test("site lists are keyed by vertical; a client never reads another vertical's list", () => {
  assert.deepEqual(referenceVerticals().sort(), ["lighting", "music_instruments"]);
  for (const c of listClients()) assert.ok(verticalReference(c.vertical), `${c.client_key} has a reference list`);
  resetActiveClientForTests("fender");
  assert.equal(classifySource("guitarworld.com"), "editorial");
  assert.equal(classifySource("1lumen.com"), "other", "a lighting review site is not a Fender editorial site");
  assert.equal(classifySource("petzl.com"), "other");
  assert.equal(classifySource("gibson.com"), "competitor_brand");
  assert.equal(classifySource("youtube.com"), "video");
  resetActiveClientForTests("ledlenser");
  assert.equal(classifySource("1lumen.com"), "editorial");
  assert.equal(classifySource("guitarworld.com"), "other", "a guitar magazine is not a Ledlenser editorial site");
  assert.equal(classifySource("gibson.com"), "other");
  assert.equal(classifySource("petzl.com"), "competitor_brand");
  assert.equal(classifySource("milwaukeetool.com"), "competitor_brand", "listed lighting brand outside the competitor set");
  // A vertical with no list reads only the shared sites, and its Other bucket reads Not available*.
  assert.equal(verticalReference("fishing"), null);
  assert.deepEqual(referenceBrandSites("fishing"), []);
  assert.ok(referenceDomains("fishing", "video").includes("youtube.com"));
  for (const kind of ["retailer", "editorial", "community", "reference"] as const) {
    const fishing = referenceDomains("fishing", kind);
    for (const d of ["guitarworld.com", "sweetwater.com", "1lumen.com", "homedepot.com", "talkbass.com", "budgetlightforum.com"]) {
      assert.equal(fishing.includes(d), false, `${kind} ${d}`);
    }
  }
  assert.equal(SOURCE_CLASS_LABELS.other, "Other sites");
  assert.equal(matchesDomain("uk.fender.com", "fender.com"), true);
  assert.equal(matchesDomain("myfender.com", "fender.com"), false);
});

test("brand websites in Unbranded Discovery name each brand from settings and the vertical list", () => {
  const domains = ["fender.com", "squier.com", "gretschguitars.com", "gibson.com", "ledlenser.com", "ledlenser.co.uk", "petzl.com", "milwaukeetool.com"];
  const calls = domains.map((_, i) => ({ id: `c${i}`, prompt_kind: "commercial", call_status: "answered", prompt: "what is the best one to buy" }));
  const slicesFor = (key: string) => {
    resetActiveClientForTests(key);
    const rows = domains.map((domain, i) => ({ simulationId: `c${i}`, domain, sourceClass: classifySource(domain) }));
    return Object.fromEntries(unbrandedBrandSites(calls as never, { rows } as never)!.slices.map((s) => [s.brand, [s.links, s.fenderOwned]]));
  };
  assert.deepEqual(slicesFor("fender"), { Fender: [2, true], Gretsch: [1, true], Gibson: [1, false] });
  assert.deepEqual(slicesFor("ledlenser"), { Ledlenser: [2, true], Petzl: [1, false], Milwaukee: [1, false] });
});

/* X-16: lib/ai-search/site-types.ts kept one index for the whole server process, so an export for
   one client after another client's load classified sites with the other client's stored types. */
function fakeView(rows: Record<string, unknown[]>): SiteTypeReadClient {
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, key: string) => ({
          order: () => ({ range: async () => ({ data: rows[key] ?? [], error: null }) }),
        }),
      }),
    }),
  };
}

test("two clients loaded in one process keep their own stored site types", async () => {
  const view = fakeView({
    fmic: [{ client_key: "fmic", domain: "shared-example.com", site_type: "retailer", source: "staff" }],
    ledlenser: [{ client_key: "ledlenser", domain: "shared-example.com", site_type: "publication", source: "staff" }],
  });
  await runWithClient("fender", () => ensureSiteTypes({}, undefined, view));
  await runWithClient("ledlenser", () => ensureSiteTypes({}, undefined, view));
  // Before the fix, the Ledlenser load replaced the one index and Fender read "editorial" here.
  assert.equal(await runWithClient("fender", async () => classifySource("shared-example.com")), "retailer");
  assert.equal(await runWithClient("ledlenser", async () => classifySource("shared-example.com")), "editorial");
  const [fender, ledlenser] = await Promise.all([
    runWithClient("fender", async () => storedSourceClass("shared-example.com")),
    runWithClient("ledlenser", async () => storedSourceClass("shared-example.com")),
  ]);
  assert.deepEqual([fender, ledlenser], ["retailer", "editorial"]);
  assert.notEqual(installedSiteTypes("fmic"), installedSiteTypes("ledlenser"));
});
