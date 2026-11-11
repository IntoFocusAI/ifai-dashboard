// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/site-types.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { classifySource } from "../lib/ai-search/citations.ts";
import {
  ensureSiteTypes,
  loadSiteTypes,
  lookupSiteType,
  parseSiteTypeRows,
  setSiteTypes,
  siteTypeIndex,
  siteTypeNeedsReview,
  storedSourceClass,
  type SiteTypeReadClient,
  type SiteTypeRow,
} from "../lib/ai-search/site-types.ts";
import { siteType } from "../lib/fender-canvas/roadmap-sources.ts";
import { resetActiveClientForTests } from "../lib/client/active-client.ts";

/* Decision 21a: site types are stored data, read through public.canvas_site_types. With no view,
   or a failed read, every answer comes from the lists in code, exactly as before. */

afterEach(() => {
  setSiteTypes(null);
  resetActiveClientForTests(null);
});

const row = (domain: string, site_type: string, extra: Record<string, unknown> = {}) => ({
  client_key: "fmic",
  domain,
  site_type,
  source: "ai",
  confidence: 0.9,
  needs_review: false,
  ...extra,
});

function fakeView(pages: unknown[][] | { error: string } | "throw"): { client: SiteTypeReadClient; asked: string[] } {
  const asked: string[] = [];
  let call = 0;
  const client = {
    from(view: string) {
      asked.push(view);
      return {
        select: () => ({
          eq: (_column: string, value: string) => {
            asked.push(value);
            return {
              order: () => ({
                range: () => {
                  if (pages === "throw") throw new Error("network down");
                  if (!Array.isArray(pages)) return Promise.resolve({ data: null, error: { message: pages.error } });
                  return Promise.resolve({ data: pages[call++] ?? [], error: null });
                },
              }),
            };
          },
        }),
      };
    },
  } as unknown as SiteTypeReadClient;
  return { client, asked };
}

test("parse keeps known types and drops rows it cannot read", () => {
  const rows = parseSiteTypeRows([
    row("WWW.Example.com", "retailer"),
    row("bad.com", "not-a-type"),
    row("", "video"),
    row("x.com", "community", { source: "staff", confidence: null, needs_review: true }),
  ]);
  assert.deepEqual(rows.map((r) => [r.domain, r.site_type, r.source, r.needs_review]), [
    ["example.com", "retailer", "ai", false],
    ["x.com", "community", "staff", true],
  ]);
  assert.deepEqual(parseSiteTypeRows(null), []);
});

test("load reads the active client's rows and pages through a full page", async () => {
  const full = Array.from({ length: 1000 }, (_, i) => row(`site${i}.com`, "retailer"));
  const { client, asked } = fakeView([full, [row("last.com", "video")]]);
  const read = await loadSiteTypes(client, "fmic");
  assert.equal(read.phase, "stored");
  if (read.phase === "stored") assert.equal(read.rows.length, 1001);
  assert.ok(asked.includes("canvas_site_types") && asked.includes("fmic"));
});

test("an absent view, a failed page, and a thrown error all fall back", async () => {
  for (const pages of [{ error: 'relation "canvas_site_types" does not exist' }, "throw"] as const) {
    const read = await loadSiteTypes(fakeView(pages).client, "fmic");
    assert.equal(read.phase, "fallback");
  }
  const notRows = await loadSiteTypes(
    { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: () => Promise.resolve({ data: null, error: null }) }) }) }) }) } as unknown as SiteTypeReadClient,
    "fmic",
  );
  assert.equal(notRows.phase, "fallback");
});

test("lookup finds the domain, then its nearest parent", () => {
  const index = siteTypeIndex(parseSiteTypeRows([row("fender.com", "brand_owned"), row("shop.fender.com", "retailer")]));
  assert.equal(lookupSiteType(index, "fender.com")?.site_type, "brand_owned");
  assert.equal(lookupSiteType(index, "uk.fender.com")?.site_type, "brand_owned");
  assert.equal(lookupSiteType(index, "shop.fender.com")?.site_type, "retailer");
  assert.equal(lookupSiteType(index, "www.shop.fender.com")?.site_type, "retailer");
  assert.equal(lookupSiteType(index, "com"), null);
  assert.equal(lookupSiteType(index, "gibson.com"), null);
});

test("with no stored types, classifySource and the roadmap read the lists in code", () => {
  assert.equal(storedSourceClass("guitarworld.com"), null);
  assert.equal(classifySource("guitarworld.com"), "editorial");
  assert.equal(classifySource("uk.fender.com"), "fender_owned");
  assert.equal(classifySource("unlisted-site.com"), "other");
  assert.equal(siteType("reddit.com"), "community");
  assert.equal(siteType("unlisted-site.com"), "unclassified");
});

test("a stored type wins over the lists, including a staff Other; unlisted domains keep the lists", () => {
  setSiteTypes(
    siteTypeIndex(
      parseSiteTypeRows([
        row("guitarworld.com", "retailer", { source: "staff", confidence: null }),
        row("reddit.com", "other", { source: "staff", confidence: null }),
        row("newsite.com", "video", { confidence: 0.62, needs_review: true }),
      ]),
    ),
  );
  assert.equal(classifySource("guitarworld.com"), "retailer");
  assert.equal(siteType("guitarworld.com"), "retailer");
  assert.equal(classifySource("reddit.com"), "other");
  assert.equal(siteType("reddit.com"), "unclassified");
  assert.equal(classifySource("newsite.com"), "video");
  assert.equal(classifySource("musicradar.com"), "editorial");
  assert.equal(siteTypeNeedsReview("newsite.com"), true);
  assert.equal(siteTypeNeedsReview("reddit.com"), false);
  assert.equal(siteTypeNeedsReview("musicradar.com"), false);
});

test("ensureSiteTypes installs the rows once per client and leaves the lists alone on failure", async () => {
  const ok = fakeView([[row("zzz-example-site.com", "community")]]);
  await ensureSiteTypes(ok.client, "fmic");
  await ensureSiteTypes(ok.client, "fmic");
  assert.equal(ok.asked.filter((v) => v === "canvas_site_types").length, 1);
  assert.equal(classifySource("zzz-example-site.com"), "community");

  const broken = fakeView({ error: "missing" });
  await ensureSiteTypes(broken.client, "fmic");
  assert.equal(classifySource("zzz-example-site.com"), "other");
  assert.equal(classifySource("guitarworld.com"), "editorial");

  const empty = fakeView([[]]);
  await ensureSiteTypes(empty.client, "fmic");
  assert.equal(classifySource("guitarcenter.com"), "retailer");
});

/* Day one: the seed rows in the migration must give the same answer as the lists in code. */
test("the migration seed matches classifySource for both clients", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261111150000_site_types.sql", import.meta.url), "utf8");
  const seed = [...sql.matchAll(/^ {2}\('([a-z]+)', '([a-z0-9.-]+)', '([a-z_]+)'\)/gm)].map((m) => ({
    client: m[1]!,
    domain: m[2]!,
    type: m[3]!,
  }));
  assert.equal(seed.length, 193);
  const toClass: Record<string, string> = {
    brand_owned: "fender_owned",
    publication: "editorial",
    retailer: "retailer",
    community: "community",
    video: "video",
    reference: "reference",
    competitor_brand: "competitor_brand",
  };
  for (const [client, key] of [["fmic", "fender"], ["ledlenser", "ledlenser"]] as const) {
    const rows: SiteTypeRow[] = parseSiteTypeRows(
      seed.filter((s) => s.client === client).map((s) => row(s.domain, s.type, { client_key: client, source: "seed", confidence: null })),
    );
    assert.ok(rows.length > 50, client);
    resetActiveClientForTests(key);
    setSiteTypes(null);
    const fromCode = rows.map((r) => classifySource(r.domain));
    setSiteTypes(siteTypeIndex(rows));
    const fromSeed = rows.map((r) => classifySource(r.domain));
    assert.deepEqual(fromSeed, fromCode, client);
    assert.deepEqual(fromSeed, rows.map((r) => toClass[r.site_type]), client);
  }
});
