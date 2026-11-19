async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const JOB = 'map_leakage_walmart';
  const COLLECTOR = 'ledlenser_walmart_v2';
  const VERSION = 7;
  // v7: a stored Walmart price is dropped after this many passes in a row whose search returned
  // results but no match (Brian Magazu, 18 Nov 2026). Empty and failed searches don't count.
  const DROP_AFTER_MISSES = 2;
  const started = Date.now();
  const batchSize = Math.max(1, Math.min(60, Number(inputs.batchSize || 30)));
  const concurrency = Math.max(1, Math.min(6, Number(inputs.concurrency || 4)));
  const budgetMs = Math.max(30, Number(inputs.timeBudgetSec || 200)) * 1000;
  const asinList = Array.isArray(inputs.asins) && inputs.asins.length ? inputs.asins : null;
  const log = [];

  async function sbq(query) {
    const r = await callTool(SB, 'execute_sql', { query });
    const txt = typeof r === 'string' ? r : (r && typeof r.result === 'string' ? r.result : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (!m) throw new Error('Supabase error: ' + txt.slice(0, 500));
    return JSON.parse(m[1]);
  }
  const esc = s => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;

  const COLS = `r.asin, r.wmt_title AS stored_wmt_title, r.wmt_price AS stored_wmt, r.wmt_miss_streak AS miss_streak, c.title, c.color, c.brand_sku, c.model_number, b.label AS sheet_label, r.offer_price, r.map_price, COALESCE(c.is_bundle, false) AS is_bundle`;
  const FROM = `FROM ledlenser.retail_buybox_map r JOIN ledlenser.catalog c ON c.asin = r.asin LEFT JOIN ledlenser.brand_catalog b ON b.sku = c.brand_sku`;
  const GENUINE = `(c.brand_sku IS NOT NULL OR c.title ILIKE '%led%lenser%')`;
  let offset = 0, wrapped = false, rows;
  if (asinList) {
    rows = await sbq(`SELECT ${COLS} ${FROM} WHERE r.asin IN (${asinList.map(esc).join(',')})`);
  } else {
    const st = await sbq(`SELECT cursor_offset FROM ledlenser.job_state WHERE job_key='${JOB}'`);
    offset = st.length ? Number(st[0].cursor_offset || 0) : 0;
    const q = off => `SELECT ${COLS} ${FROM} WHERE ${GENUINE} ORDER BY r.asin LIMIT ${batchSize} OFFSET ${off}`;
    rows = await sbq(q(offset));
    if (!rows.length) { offset = 0; wrapped = true; rows = await sbq(q(0)); }
  }

  const EDITIONS = ['core', 'pro', 'signature', 'work', 'rgb', 'qc', 'lep', 'warm', 'tac', 'kids', 'mini', 'plus', 'x'];
  const COLORS = ['black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple', 'gray', 'grey', 'silver', 'gold', 'camo', 'sand'];
  const NOT_THE_LIGHT = /\b(used|refurb\w*|pre-?owned|replacement|headband only|battery pack|spare battery|charging cable|charger|mount(ing)? kit|holster|pouch|case only|filter|lens cap)\b/i;
  const BUNDLE = /\b(bundle|gift ?box|combo|kit|set|pack of|\d+[- ]pack|and flex\d+|\+ ?flex)\b/i;
  const toks = s => String(s || '').toLowerCase().replace(/®|™/g, '').replace(/[^a-z0-9.]+/g, ' ').split(' ').filter(Boolean);
  // Model code: letters then digits, optional letters (H7R, HF8R, MH10, P7R, ML6, K4R, iH5, Kidbeam4, EX7R, H3.2).
  const isModel = t => /^[a-z]{1,8}\d{1,2}(\.\d)?[a-z]{0,3}$/.test(t) && !/^(ip\d+|usb|aaa?|\d)/.test(t) && !/^(c\d|lm|mah)$/.test(t);
  function modelOf(text) {
    const t = toks(String(text || '').replace(/^\s*(zweibr\S*\s+)?led[\s-]*lenser[\s,:\-|]*/i, ''));
    for (let i = 0; i < Math.min(t.length, 6); i++) if (isModel(t[i])) return { code: t[i], editions: t.slice(i + 1, i + 4).filter(w => EDITIONS.includes(w)) };
    return null;
  }
  const editionsIn = (title, code) => { const t = toks(title); const i = t.indexOf(code); return i < 0 ? [] : [...new Set(t.slice(i + 1, i + 4).filter(w => EDITIONS.includes(w)))]; };
  const colorsIn = s => { const t = new Set(toks(s)); return COLORS.filter(c => t.has(c)).map(c => c === 'grey' ? 'gray' : c).sort(); };
  const overlap = (a, b) => { const A = new Set(toks(a).filter(w => w.length > 2)), B = new Set(toks(b)); if (!A.size) return 0; let h = 0; for (const w of A) if (B.has(w)) h++; return h / A.size; };

  async function checkOne(row) {
    // Prefer the sheet label for the model; fall back to the Amazon title.
    const fromSheet = modelOf(row.sheet_label);
    const m = fromSheet || modelOf(row.title);
    if (!m) return { asin: row.asin, status: 'no_model_code', title: row.title };
    const editions = [...new Set(fromSheet ? m.editions : (m.editions.length ? m.editions : editionsIn(row.title, m.code)))].sort();
    const amzBundle = BUNDLE.test(String(row.title || '')) || !!row.is_bundle;
    const ref = row.map_price != null ? Number(row.map_price) : (row.offer_price != null ? Number(row.offer_price) : null);
    const myColors = colorsIn(`${row.color || ''} ${row.sheet_label || ''}`);
    const query = ['Ledlenser', m.code.toUpperCase(), ...editions.map(e => e[0].toUpperCase() + e.slice(1))].join(' ');
    let items = [];
    try {
      const w = await callTool('E-Commerce', 'search_products', { marketplace: 'walmart', query, maxItems: 20 });
      const pages = w && Array.isArray(w.pages) ? w.pages : [w];
      for (const p of pages) items.push(...((p && (p.results || p.items || p.products)) || []));
    } catch (e) { return { asin: row.asin, status: 'search_error', err: String(e.message || e).slice(0, 160), query }; }
    // v7: an empty result is not evidence the listing is gone (Walmart search hiccup); stamp only.
    if (!items.length) return { asin: row.asin, status: 'no_results', query };
    const rej = {}; const r = k => { rej[k] = (rej[k] || 0) + 1; };
    let best = null, bestScore = -1;
    for (const it of items) {
      const t = String(it.title || ''); const price = Number(it.price); const seller = String(it.seller || '');
      if (!price || isNaN(price)) { r('no_price'); continue; }
      const branded = /led\s*-?\s*lenser/i.test(t) || /river city tools/i.test(seller);
      if (!branded) { r('not_ledlenser'); continue; }
      if (/\bcoast\b/i.test(t)) { r('coast_era'); continue; }
      if (!toks(t).includes(m.code)) { r('model'); continue; }
      if (editionsIn(t, m.code).sort().join('|') !== editions.join('|')) { r('edition'); continue; }
      if (NOT_THE_LIGHT.test(t)) { r('accessory_or_used'); continue; }
      if (!amzBundle && BUNDLE.test(t)) { r('bundle'); continue; }
      const wc = colorsIn(t);
      if (myColors.length && wc.length && wc.join('|') !== myColors.join('|')) { r('color'); continue; }
      if (ref) { const ratio = price / ref; if (ratio < 0.5 || ratio > 1.6) { r('price_band'); continue; } }
      // Prefer the brand seller, then title overlap with the Amazon title.
      const score = (/river city tools/i.test(seller) ? 1 : 0) + overlap(t, row.title);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    if (!best) {
      const st = String(row.stored_wmt_title || '');
      const staleStored = !!st && (/\bcoast\b/i.test(st) || !toks(st).includes(m.code) || editionsIn(st, m.code).sort().join('|') !== editions.join('|'));
      const streak = Number(row.miss_streak || 0) + 1;
      const dropped = !staleStored && streak >= DROP_AFTER_MISSES && row.stored_wmt != null;
      return { asin: row.asin, status: 'no_match', query, seen: items.length, rejected: rej, clearStored: staleStored, miss_streak: streak, dropped_price: dropped ? Number(row.stored_wmt) : undefined };
    }
    const price = Number(best.price);
    const map = row.map_price != null ? Number(row.map_price) : null;
    return {
      asin: row.asin, status: 'matched', query, wmt: price, map, amz: row.offer_price != null ? Number(row.offer_price) : null,
      leak: map != null ? +(price - map).toFixed(2) : null, conf: +Math.min(1, overlap(best.title, row.title) + 0.5).toFixed(2),
      seller: best.seller || null, title: String(best.title || '').slice(0, 300), url: best.url || null,
    };
  }

  const results = []; let next = 0, skippedForTime = 0;
  async function worker() {
    while (next < rows.length) {
      if (Date.now() - started > budgetMs) { skippedForTime = rows.length - next; next = rows.length; break; }
      const row = rows[next++];
      try { results.push(await checkOne(row)); } catch (e) { log.push(`${row.asin}: ${String(e.message || e).slice(0, 160)}`); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));

  const summary = { version: VERSION, processed: results.length, matched: results.filter(x => x.status === 'matched').length, below_map: results.filter(x => x.leak != null && x.leak < 0).length, no_match: results.filter(x => x.status === 'no_match').length, no_results: results.filter(x => x.status === 'no_results').length, dropped: results.filter(x => x.dropped_price != null).length, errors: results.filter(x => x.status === 'search_error').length };
  if (inputs.dryRun) return { dryRun: true, collector: COLLECTOR, ...summary, skippedForTime, results, log };

  const TS = `'${new Date().toISOString()}'::timestamptz`;
  const DROP = `wmt_miss_streak + 1 >= ${DROP_AFTER_MISSES}`;
  const sql = ['BEGIN;'];
  for (const x of results) {
    if (x.status === 'search_error') continue; // not checked; try again next pass
    if (x.status === 'matched') {
      sql.push(`UPDATE ledlenser.retail_buybox_map SET wmt_price=${x.wmt}, wmt_title=${esc(x.title)}, wmt_url=${esc(x.url)}, wmt_seller=${esc(x.seller)}, wmt_leakage=${x.leak == null ? 'NULL' : x.leak}, wmt_match_conf=${x.conf}, wmt_checked_at=${TS}, wmt_last_matched_at=${TS}, wmt_miss_streak=0, channels = CASE WHEN channels IS NULL OR channels = '' THEN 'WMT' WHEN channels NOT LIKE '%WMT%' THEN channels || ',WMT' ELSE channels END, updated_at=${TS} WHERE asin=${esc(x.asin)};`);
    } else if (x.status === 'no_match' && x.clearStored) {
      // The stored match is for a different model or the Coast era: wrong data, cleared at once.
      sql.push(`UPDATE ledlenser.retail_buybox_map SET wmt_price=NULL, wmt_title=NULL, wmt_url=NULL, wmt_seller=NULL, wmt_leakage=NULL, wmt_match_conf=NULL, wmt_miss_streak=0, channels = NULLIF(array_to_string(array_remove(string_to_array(channels, ','), 'WMT'), ','), ''), wmt_checked_at=${TS}, updated_at=${TS} WHERE asin=${esc(x.asin)};`);
    } else if (x.status === 'no_match') {
      // v7: results but no match. Count the miss; on the 2nd in a row, drop the stored price.
      sql.push(`UPDATE ledlenser.retail_buybox_map SET wmt_checked_at=${TS}, wmt_miss_streak = wmt_miss_streak + 1,
        wmt_price = CASE WHEN ${DROP} THEN NULL ELSE wmt_price END, wmt_title = CASE WHEN ${DROP} THEN NULL ELSE wmt_title END,
        wmt_url = CASE WHEN ${DROP} THEN NULL ELSE wmt_url END, wmt_seller = CASE WHEN ${DROP} THEN NULL ELSE wmt_seller END,
        wmt_match_conf = CASE WHEN ${DROP} THEN NULL ELSE wmt_match_conf END,
        channels = CASE WHEN ${DROP} THEN NULLIF(array_to_string(array_remove(string_to_array(channels, ','), 'WMT'), ','), '') ELSE channels END,
        updated_at = CASE WHEN ${DROP} AND wmt_price IS NOT NULL THEN ${TS} ELSE updated_at END
        WHERE asin=${esc(x.asin)};`);
    } else {
      // no_results or no_model_code: stamp only.
      sql.push(`UPDATE ledlenser.retail_buybox_map SET wmt_checked_at=${TS} WHERE asin=${esc(x.asin)};`);
    }
  }
  const newOffset = asinList ? offset : offset + results.length;
  if (!asinList) {
    const extra = JSON.stringify({ collector: COLLECTOR, ...summary, skipped_for_time: skippedForTime, wrapped, elapsed_sec: Math.round((Date.now() - started) / 1000), errors_sample: log.slice(0, 5) });
    sql.push(`INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('${JOB}', ${newOffset}, ${TS}, ${esc(extra)}::jsonb, ${TS}) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`);
  }
  sql.push('COMMIT;', 'SELECT 1 AS ok;');
  await sbq(sql.join('\n'));
  return { collector: COLLECTOR, ...summary, skippedForTime, offset, newOffset, wrapped, elapsedSec: Math.round((Date.now() - started) / 1000), results: results.map(x => ({ asin: x.asin, status: x.status, cleared: x.clearStored || undefined, miss_streak: x.miss_streak, dropped_price: x.dropped_price, q: x.query, wmt: x.wmt, map: x.map, leak: x.leak, seller: x.seller, t: x.title && x.title.slice(0, 80), rejected: x.rejected })), log };
}
