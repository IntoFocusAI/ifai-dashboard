#!/usr/bin/env node
// Google Shopping pilot: DataForSEO vs SerpApi on the suppressed (Buy Box withheld) set.
// Read-only. No database access: input is a JSON file of {asin, upc, bench_cents, title},
// where bench_cents is Amazon's Competitive External Price for the ASIN (Keepa competitivePriceThreshold).
// Writes raw API responses, results.json, and summary.json to the output directory.
//
// Usage:
//   node scripts/google-shopping-pilot.mjs <input.json> <out-dir>
//     [--only=serpapi|dataforseo] [--limit=N] [--query=upc|title|upc-then-title] [--concurrency=N]
//
// --query (default upc-then-title): what is typed into Google Shopping. In Nov 2026 a bare UPC
//   either returned 40101 from DataForSEO or unrelated products, so the fallback searches the title.
// --relevance (default 0.6): share of our title's words a result title must contain to count.
// Keys come from .env.local in the current directory, or node --env-file=...:
//   DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, SERPAPI_KEY.

import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local here: rely on the environment.
}

const [inputPath, outDir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")),
);
if (!inputPath || !outDir) {
  console.error(
    "usage: google-shopping-pilot.mjs <input.json> <out-dir> [--only=serpapi|dataforseo] [--limit=N] [--query=upc|title|upc-then-title] [--concurrency=N]",
  );
  process.exit(1);
}
const QUERY = flags.query || "upc-then-title";
const CONCURRENCY = Number(flags.concurrency) || 5;
const queriesFor = (row) => (QUERY === "upc" ? [row.upc] : QUERY === "title" ? [row.title] : [row.upc, row.title]);
const kindOf = (row, q) => (q === row.upc ? "upc" : "title");

const rows = JSON.parse(fs.readFileSync(inputPath, "utf8")).slice(0, Number(flags.limit) || undefined);
fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });
const saveRaw = (name, data) =>
  fs.writeFileSync(path.join(outDir, "raw", `${name}.json`), JSON.stringify(data, null, 1));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cents = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Math.round(v * 100);
  const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Math.round(Number(m[0]) * 100) : null;
};
const isFreeShipping = (s) => typeof s === "string" && /free/i.test(s);
const USED = /\b(used|refurb|renewed|pre-?owned|b-?stock|blemish|open[- ]box|scratch|dent)\b/i;

// Relevance gate. A bare UPC search on Google Shopping often returns unrelated products
// (pet toys for a guitar UPC), so a result only counts when its title carries most of the
// words in our title. Share of our title's words found in theirs, 0..1.
const STOP = new Set(["fender", "squier", "electric", "guitar", "with", "the", "and", "series", "by"]);
const words = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 2 && !STOP.has(w));
const coverage = (ours, theirs) => {
  const want = [...new Set(words(ours))];
  const have = new Set(words(theirs));
  return want.length ? want.filter((w) => have.has(w)).length / want.length : 0;
};
const RELEVANT = Number(flags.relevance) || 0.6;

// ---------- SerpApi ----------
const SERP_KEY = process.env.SERPAPI_KEY;
let serpSearches = 0;
async function serp(params) {
  const u = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries({ ...params, api_key: SERP_KEY })) u.searchParams.set(k, v);
  serpSearches++;
  const r = await fetch(u);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`SerpApi ${params.engine}: ${j.error || r.status}`);
  return j;
}

async function serpApiFor(row) {
  let results = [];
  let query;
  for (query of queriesFor(row)) {
    const shop = await serp({ engine: "google_shopping", q: query, gl: "us", hl: "en", location: "United States" });
    saveRaw(`serpapi_${row.asin}_shopping_${kindOf(row, query)}`, shop);
    results = (shop.shopping_results || []).filter((x) => coverage(row.title, x.title) >= RELEVANT);
    if (results.length) break;
  }
  results.sort((a, b) => coverage(row.title, b.title) - coverage(row.title, a.title));
  const first = results[0];
  const offers = results.map((x) => ({
    seller: x.source,
    title: x.title,
    url: x.product_link || x.link,
    item_cents: cents(x.extracted_price ?? x.price),
    shipping_cents: x.delivery && isFreeShipping(x.delivery) ? 0 : null,
    condition: x.second_hand_condition || null,
    from: "search",
  }));
  let productTitle = first?.title ?? null;
  const token = first?.immersive_product_page_token;
  if (token) {
    const prod = await serp({ engine: "google_immersive_product", page_token: token, more_stores: "true" });
    saveRaw(`serpapi_${row.asin}_product`, prod);
    const pr = prod.product_results || {};
    productTitle = pr.title || productTitle;
    for (const s of pr.stores || []) {
      const item = cents(s.extracted_price ?? s.price);
      const total = cents(s.extracted_total ?? s.total);
      const ship =
        s.shipping_extracted != null ? cents(s.shipping_extracted)
        : isFreeShipping(s.shipping) ? 0
        : total != null && item != null ? total - item
        : null;
      offers.push({
        seller: s.name, title: s.title || null, url: s.link, item_cents: item, shipping_cents: ship,
        condition: [s.tag, ...(s.details_and_offers || [])].filter(Boolean).join("; ") || null, from: "product",
      });
    }
  }
  return { productTitle, offers, query: kindOf(row, query), upc_errors: [] };
}

// ---------- DataForSEO ----------
const D4S_AUTH = "Basic " + Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString("base64");
let d4sCost = 0;
async function d4s(method, p, body) {
  const r = await fetch(`https://api.dataforseo.com/v3/${p}`, {
    method, headers: { Authorization: D4S_AUTH, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok || j.status_code !== 20000) throw new Error(`DataForSEO ${p}: ${j.status_code} ${j.status_message}`);
  d4sCost += j.cost || 0;
  return j;
}
async function d4sTask(kind, payload) {
  const post = await d4s("POST", `merchant/google/${kind}/task_post`, [{ ...payload, location_code: 2840, language_code: "en", priority: 2 }]);
  const t = post.tasks[0];
  if (t.status_code !== 20100) throw new Error(`DataForSEO ${kind} post: ${t.status_code} ${t.status_message}`);
  for (let i = 0; i < 60; i++) {
    await sleep(i < 6 ? 5000 : 15000);
    const g = await d4s("GET", `merchant/google/${kind}/task_get/advanced/${t.id}`);
    const gt = g.tasks[0];
    if (gt.status_code === 20000) return gt;
    if (![40601, 40602].includes(gt.status_code)) throw new Error(`DataForSEO ${kind} get: ${gt.status_code} ${gt.status_message}`);
  }
  throw new Error(`DataForSEO ${kind}: timed out`);
}

async function dataForSeoFor(row) {
  let items = [];
  let query;
  const errors = [];
  for (query of queriesFor(row)) {
    const kind = kindOf(row, query);
    let prodTask;
    try {
      prodTask = await d4sTask("products", { keyword: query });
    } catch (e) {
      errors.push(`${kind}: ${e.message}`);
      continue;
    }
    saveRaw(`dataforseo_${row.asin}_products_${kind}`, prodTask);
    const all = (prodTask.result?.[0]?.items || []).filter((x) => x.type === "google_shopping_serp" || x.product_id);
    items = all.filter((x) => coverage(row.title, x.title) >= RELEVANT);
    if (!items.length) errors.push(`${kind}: ${all.length} results, none relevant`);
    if (items.length) break;
  }
  if (!items.length) throw new Error(errors.join(" | ") || "no results");
  items.sort((a, b) => coverage(row.title, b.title) - coverage(row.title, a.title));
  const offers = items.map((x) => ({
    seller: x.seller, title: x.title, url: x.shopping_url || x.url,
    item_cents: cents(x.price),
    shipping_cents: x.delivery_info?.delivery_price != null ? cents(x.delivery_info.delivery_price.current ?? x.delivery_info.delivery_price)
      : isFreeShipping(x.delivery_info?.delivery_message) ? 0 : null,
    condition: x.product_condition || null, from: "search",
  }));
  // The sellers lookup needs Google's product cluster: use the first organic item that has one.
  const first = items.find((x) => x.product_id || x.gid) || items[0];
  let productTitle = first?.title ?? null;
  if (first?.product_id || first?.gid) {
    // DataForSEO recommends sending every identifier it returned together.
    const ids = Object.fromEntries(["product_id", "gid", "data_docid"].filter((k) => first[k]).map((k) => [k, first[k]]));
    const sellTask = await d4sTask("sellers", ids);
    saveRaw(`dataforseo_${row.asin}_sellers`, sellTask);
    const res = sellTask.result?.[0] || {};
    productTitle = res.title || productTitle;
    for (const s of res.items || []) {
      const item = cents(s.base_price ?? s.price);
      const total = cents(s.total_price);
      offers.push({
        // `details` is the store's own listing title; `title` is the store name.
        seller: s.seller_name || s.domain, title: s.details || null, url: s.url,
        item_cents: item,
        shipping_cents: s.shipping_price != null ? cents(s.shipping_price) : total != null && item != null ? total - item : null,
        condition: s.product_condition || null, from: "product",
      });
    }
  }
  return { productTitle, offers, query: kindOf(row, query), upc_errors: errors };
}

// ---------- compare ----------
// "search" offers come from the results list, which can mix colours and models on a title search.
// "product" offers come from one Google product page (one cluster of sellers for the same item).
function judge(row, offers) {
  return offers.map((o) => {
    const landed = o.item_cents != null && o.shipping_cents != null ? o.item_cents + o.shipping_cents : null;
    const price = landed ?? o.item_cents;
    const used = USED.test(`${o.title || ""} ${o.condition || ""}`);
    return {
      ...o, landed_cents: landed, used,
      landed_match: !used && landed === row.bench_cents,
      item_only_match: !used && landed == null && o.item_cents === row.bench_cents,
      near_match: !used && price != null && Math.abs(price - row.bench_cents) <= 100,
      at_or_below: !used && price != null && price <= row.bench_cents,
    };
  });
}

const vendors = { serpapi: serpApiFor, dataforseo: dataForSeoFor };
const run = flags.only ? { [flags.only]: vendors[flags.only] } : vendors;
const results = new Array(rows.length);

async function doRow(row, idx) {
  const entry = { ...row };
  await Promise.all(Object.entries(run).map(async ([name, fn]) => {
    try {
      const { productTitle, offers, query, upc_errors } = await fn(row);
      const judged = judge(row, offers);
      const priced = judged.filter((o) => !o.used && (o.landed_cents ?? o.item_cents) != null);
      const exact = judged.filter((o) => o.landed_match || o.item_only_match);
      entry[name] = {
        query, upc_errors, product_title: productTitle,
        title_coverage: Number(coverage(row.title, productTitle).toFixed(2)),
        offers: judged.length,
        product_page_offers: judged.filter((o) => o.from === "product").length,
        exact_matches: exact,
        product_page_exact_matches: exact.filter((o) => o.from === "product").length,
        near_matches: judged.filter((o) => o.near_match),
        at_or_below: judged.filter((o) => o.at_or_below).length,
        lowest_new_cents: priced.length ? Math.min(...priced.map((o) => o.landed_cents ?? o.item_cents)) : null,
        all: judged,
      };
    } catch (e) {
      entry[name] = { error: String(e.message || e) };
    }
  }));
  results[idx] = entry;
  const line = Object.keys(run).map((n) => {
    const e = entry[n];
    if (e.error) return `${n}: ERR ${e.error}`;
    const low = e.lowest_new_cents == null ? "n/a" : `$${(e.lowest_new_cents / 100).toFixed(2)}`;
    return `${n} [${e.query}]: ${e.offers} offers (${e.product_page_offers} on product page), ${e.exact_matches.length} exact (${e.product_page_exact_matches} on product page), ${e.near_matches.length} within $1, lowest new ${low}`;
  }).join(" | ");
  console.log(`${row.asin} ${row.upc} $${(row.bench_cents / 100).toFixed(2)}  ${line}`);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results.filter(Boolean), null, 1));
}

let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
  while (next < rows.length) {
    const i = next++;
    await doRow(rows[i], i);
  }
}));

const summary = {
  items: rows.length, query_mode: QUERY,
  serpapi_searches: serpSearches, dataforseo_cost_usd: Number(d4sCost.toFixed(4)),
};
for (const n of Object.keys(run)) {
  const ok = results.filter((r) => r[n] && !r[n].error);
  summary[n] = {
    errors: results.length - ok.length,
    found_by_upc: ok.filter((r) => r[n].query === "upc" && r[n].offers).length,
    found_by_title: ok.filter((r) => r[n].query === "title" && r[n].offers).length,
    exact_benchmark_match_any: ok.filter((r) => r[n].exact_matches.length).length,
    exact_benchmark_match_product_page: ok.filter((r) => r[n].product_page_exact_matches).length,
    product_page_title_has_every_word: ok.filter((r) => r[n].title_coverage === 1).length,
    within_1_dollar: ok.filter((r) => r[n].near_matches.length).length,
    new_offer_at_or_below_benchmark: ok.filter((r) => r[n].at_or_below).length,
  };
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 1));
console.log("\n" + JSON.stringify(summary, null, 1));
