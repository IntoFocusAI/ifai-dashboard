#!/usr/bin/env node
// R-15 pilot (docs/r15-price-match-plan.md): Google Shopping by title through SerpApi, then the first
// product page's store list. Flags exact matches to Amazon's benchmark. Read-only: writes files, never the database.
// Input JSON: [{asin, q, bench_cents}]. Key: SERPAPI_KEY in .env.local.
// Usage (repo root): node scripts/price-match-pilot.mjs <input.json> <out-dir>
import fs from "node:fs";
process.loadEnvFile?.(".env.local");
const [input, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const rows = JSON.parse(fs.readFileSync(input, "utf8"));
const key = process.env.SERPAPI_KEY;
let searches = 0;
async function serp(params) {
  const u = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries({ ...params, api_key: key })) u.searchParams.set(k, v);
  searches++;
  const j = await (await fetch(u)).json();
  if (j.error) throw new Error(j.error);
  return j;
}
const cents = (v) => (v == null ? null : Math.round(Number(String(v).replace(/[^0-9.]/g, "")) * 100));
const USED = /\b(used|refurb|renewed|pre-?owned|b-?stock|blemish|open[- ]box|scratch|dent)\b/i;
const results = [];
for (const r of rows) {
  const entry = { ...r, matches: [], offers: 0 };
  try {
    const shop = await serp({ engine: "google_shopping", q: r.q, gl: "us", hl: "en", location: "United States" });
    fs.writeFileSync(`${out}/${r.asin}_shopping.json`, JSON.stringify(shop));
    const offers = (shop.shopping_results || []).map((x) => ({
      from: "shopping", seller: x.source, title: x.title, url: x.product_link || x.link,
      item: cents(x.extracted_price), total: null, cond: x.second_hand_condition || "",
    }));
    const first = (shop.shopping_results || []).find((x) => x.immersive_product_page_token);
    if (first) {
      const prod = await serp({ engine: "google_immersive_product", page_token: first.immersive_product_page_token, more_stores: "true" });
      fs.writeFileSync(`${out}/${r.asin}_product.json`, JSON.stringify(prod));
      const pr = prod.product_results || {};
      entry.product_page = pr.title || null;
      for (const s of pr.stores || []) {
        offers.push({
          from: "store", seller: s.name, title: pr.title, url: s.link,
          item: cents(s.extracted_price), total: cents(s.extracted_total), cond: [s.tag, ...(s.details_and_offers || [])].filter(Boolean).join("; "),
        });
      }
    }
    entry.offers = offers.length;
    for (const o of offers) {
      if (USED.test(`${o.title || ""} ${o.cond || ""}`)) continue;
      const kind = o.total === r.bench_cents ? "landed" : o.item === r.bench_cents ? "item" : null;
      if (kind) entry.matches.push({ kind, ...o });
    }
  } catch (e) {
    entry.error = String(e.message || e);
  }
  results.push(entry);
  const m = entry.matches.map((x) => `${x.seller} (${x.kind})`).join("; ");
  console.log(`${r.asin} $${(r.bench_cents / 100).toFixed(2)} offers=${entry.offers} matches=${entry.matches.length}${m ? " " + m : ""}${entry.error ? " ERR " + entry.error : ""}`);
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
}
const hit = results.filter((x) => x.matches.length).length;
console.log(`\nListings with at least one exact match: ${hit} of ${results.length}. SerpApi searches: ${searches}.`);
