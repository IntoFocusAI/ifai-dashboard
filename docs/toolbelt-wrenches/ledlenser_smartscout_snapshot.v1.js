async function run(inputs) {
  const SS = '81fb9796-8b5d-4eaa-a13e-81b920fad573';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COLLECTOR = 'ledlenser_smartscout_snapshot_v1';
  const brands = (inputs.brands && inputs.brands.length) ? inputs.brands : ['Ledlenser'];
  const limit = Math.max(100, Math.min(50000, Number(inputs.limit || 20000)));
  const t0 = Date.now();
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const q = s => (s == null || s === '') ? 'NULL' : `'${esc(s)}'`;
  const nv = v => (v == null || v === '' || Number.isNaN(Number(v))) ? 'NULL' : Number(v);
  async function sql(query) {
    const r = await callTool(SB, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const NEED = ['ASIN', 'Monthly Unit Sales Estimate', 'Monthly Revenue Estimate', 'TTM Revenue', 'Previous 12 Month Revenue'];
  const perBrand = {};
  const all = new Map();
  for (const b of brands) {
    const first = await callTool(SS, 'query_analytics', { question: `For brand ${b}, list all products by estimated monthly revenue with ASIN, parent ASIN, product title, tracking status, estimated monthly units sold, estimated monthly revenue, TTM revenue, previous 12 month revenue, buy box price, number of sellers, number of FBA sellers, 90-day Amazon in-stock rate, review count, review rating, page score, main category rank, primary subcategory rank, listed since, last refreshed and is out of stock now` });
    if (!first || !first.handle) { perBrand[b] = { error: 'no handle', raw: JSON.stringify(first || null).slice(0, 300) }; continue; }
    const full = await callTool(SS, 'run_query', { handle: first.handle, limit });
    const rows = (full && Array.isArray(full.result)) ? full.result : [];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const missing = NEED.filter(c => !cols.includes(c));
    perBrand[b] = { rows: rows.length, hitLimit: rows.length >= limit, columns: cols, missing, planNote: (full && full.planNote) ? String(full.planNote).slice(0, 200) : null };
    if (missing.length) continue;
    for (const r of rows) if (r.ASIN && !all.has(r.ASIN)) all.set(r.ASIN, Object.assign({ _brand: b }, r));
  }
  const bad = Object.entries(perBrand).filter(([, v]) => v.error || (v.missing && v.missing.length));
  if (bad.length) return { success: false, error: 'SmartScout columns changed or query failed; nothing written', perBrand };
  const today = new Date().toISOString().slice(0, 10);
  const rows = Array.from(all.values());
  if (inputs.dryRun) return { success: true, dryRun: true, snapshot_date: today, distinctAsins: rows.length, perBrand, sample: rows.slice(0, 3) };
  const now = new Date().toISOString();
  const ref = `raw/smartscout/${today}/products_${now.replace(/[:.]/g, '-')}.json`;
  let rawRef = ref;
  try { await callTool('workspace', 'write_text_file', { fileName: ref, content: JSON.stringify({ source: 'smartscout.query_analytics', brands, fetched_at: now, rows }), allowOverwrite: false }); } catch (e) { rawRef = null; }
  const TS = `'${now}'::timestamptz`;
  const blank = v => v == null || v === '';
  const iv = v => blank(v) || Number.isNaN(Number(v)) || Math.abs(Number(v)) > 2147483647 ? 'NULL' : Math.round(Number(v));
  const dv = v => { if (blank(v)) return 'NULL'; const t = Date.parse(v + ' UTC'); return Number.isNaN(t) ? 'NULL' : `'${new Date(t).toISOString().slice(0, 10)}'`; };
  const bv = v => v === true || v === 'true' ? 'true' : (v === false || v === 'false' ? 'false' : 'NULL');
  const vals = rows.map(r => `(${q(r.ASIN)}, '${today}', ${q(r['Product Title'])}, ${q(r['Tracking Status'])}, ${iv(r['Monthly Unit Sales Estimate'])}, ${nv(r['Monthly Revenue Estimate'])}, ${nv(r['Buy Box Price'])}, ${iv(r['Main Category Rank'])}, ${iv(r['Review Count'])}, ${nv(r['Review Rating'])}, ${q(r._brand)}, NULL, ${q(COLLECTOR)}, ${TS}, ${q(r['Parent ASIN'])}, ${nv(r['TTM Revenue'])}, ${nv(r['Previous 12 Month Revenue'])}, ${iv(r['Number of Sellers'])}, ${iv(r['Number of FBA Sellers'])}, ${nv(r['90-Day Amazon In-Stock Rate'])}, ${nv(r['Page Score'])}, ${iv(r['Primary Subcategory Rank'])}, ${dv(r['Listed Since'])}, ${dv(r['Last Refreshed'])}, ${bv(r['Is Out of Stock Now'])})`);
  const cols = 'asin, snapshot_date, title, tracking_status, est_monthly_units, est_monthly_revenue, buybox_price, main_category_rank, review_count, review_rating, brand_query, raw, collector_version, loaded_at, parent_asin, ttm_revenue, prev_12m_revenue, seller_count, fba_seller_count, amazon_in_stock_rate_90, page_score, primary_subcategory_rank, listed_since, smartscout_last_refreshed, is_out_of_stock';
  const set = cols.split(', ').filter(c => c !== 'asin' && c !== 'snapshot_date').map(c => `${c}=EXCLUDED.${c}`).join(', ');
  for (let k = 0; k < vals.length; k += 1000) await sql(`INSERT INTO ledlenser.smartscout_products (${cols}) VALUES\n${vals.slice(k, k + 1000).join(',\n')}\nON CONFLICT (asin, snapshot_date) DO UPDATE SET ${set};`);
  const caps = await callTool(SS, 'get_account_capabilities', {});
  const TS2 = `'${new Date().toISOString()}'::timestamptz`;
  const summary = { snapshot_date: today, distinctAsins: rows.length, perBrand: Object.fromEntries(Object.entries(perBrand).map(([k, v]) => [k, { rows: v.rows, hitLimit: v.hitLimit }])), usedThisMonth: caps && caps.usedThisMonth, includedThisMonth: caps && caps.includedThisMonth, rawRef };
  await sql(`INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('smartscout_snapshot', 0, ${TS2}, '${esc(JSON.stringify(summary))}'::jsonb, ${TS2}) ON CONFLICT (job_key) DO UPDATE SET last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`);
  return { success: true, ...summary, elapsedSec: Math.round((Date.now() - t0) / 1000) };
}