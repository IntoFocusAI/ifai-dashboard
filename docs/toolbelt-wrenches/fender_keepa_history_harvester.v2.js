async function run(inputs) {
  const K = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const WRENCH = 'fender_keepa_history_harvester';
  const COLLECTOR = 'keepa_history_v1';
  const TYPES = ['SALES', 'NEW', 'AMAZON', 'BUY_BOX_SHIPPING', 'RATING', 'COUNT_REVIEWS'];
  const batch = Math.max(1, Math.min(500, Number(inputs.batch || 150)));
  const concurrency = Math.max(1, Math.min(8, Number(inputs.concurrency || 4)));
  const minTokens = Number(inputs.minTokens || 800);
  const budgetMs = Number(inputs.timeBudgetSec || 240) * 1000;
  const backfillDays = Math.max(7, Math.min(3650, Number(inputs.backfillDays || 365)));
  const t0 = Date.now();
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const q = s => (s == null || s === '') ? 'NULL' : `'${esc(s)}'`;
  const nv = v => (v == null || Number.isNaN(Number(v))) ? 'NULL' : Number(v);
  async function sqlOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const sql = query => sqlOn(SB, query);
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  async function write(query) {
    const res = await sqlOn(SB, query);
    await Promise.all(MIRRORS.map(async t => {
      try { await sqlOn(t.id, query); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES (${q(WRENCH)}, ${q(t.name)}, ${q(String(e.message || e).slice(0, 2000))}, ${q(query)})`); } catch (_) {}
      }
    }));
    return res;
  }
  const dayStr = ms => new Date(ms).toISOString().slice(0, 10);
  const DAY = 86400000;
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());

  // Job state: ASINs Keepa returned nothing for are skipped for 7 days.
  const st = (await sql(`SELECT extra FROM command.fmic_job_state WHERE job_key='keepa_history'`))[0];
  const extra = (st && st.extra) || {};
  const skip = Object.assign({}, extra.no_history || {});
  for (const [a, d] of Object.entries(skip)) if (Date.parse(d) < Date.now() - 7 * DAY) delete skip[a];

  let picks;
  if (Array.isArray(inputs.asins) && inputs.asins.length) {
    const rows = await sql(`SELECT c.asin, (SELECT max(day) FROM command.fmic_keepa_daily k WHERE k.asin=c.asin)::text last_day FROM command.fmic_electric_catalog c WHERE c.asin IN (${inputs.asins.map(q).join(',')})`);
    picks = rows.map(r => ({ asin: r.asin, last_day: r.last_day }));
  } else {
    // Never fetched first, then live offers older than yesterday, then inactive older than 7 days; oldest first.
    // A delisted ASIN has a NULL current_price, so live must be false for it, never NULL (NULL sorts first under DESC).
    picks = await sql(`WITH x AS (SELECT c.asin, (COALESCE(c.current_price, 0) > 0) live, (SELECT max(day) FROM command.fmic_keepa_daily k WHERE k.asin=c.asin) last_day FROM command.fmic_electric_catalog c)
      SELECT asin, last_day::text FROM x
      WHERE last_day IS NULL OR (live AND last_day < current_date - 1) OR (NOT live AND last_day < current_date - 7)
      ORDER BY (last_day IS NOT NULL), live DESC, last_day NULLS FIRST, asin LIMIT ${batch + Object.keys(skip).length}`);
    picks = picks.filter(p => !skip[p.asin]).slice(0, batch);
  }
  let tok = await callTool(K, 'get_token_status', {});
  const tokensStart = tok && tok.tokensLeft;
  const stats = { picked: picks.length, fetched: 0, noHistory: 0, errors: [], rows: 0, downsampled: 0 };
  let stopReason = picks.length ? 'batch_done' : 'nothing_due';
  const raw = [];
  let idx = 0;

  // Decode a step-function series into per-day aggregates from startMs to today.
  function daily(points, startMs) {
    const pts = (points || []).map(p => ({ t: Date.parse(p.date), v: p.value == null ? null : Number(p.value), s: p.shipping })).filter(p => !Number.isNaN(p.t)).sort((a, b) => a.t - b.t);
    const out = {};
    let i = 0, carry = null, carryShip = null, seen = false;
    while (i < pts.length && pts[i].t < startMs) { carry = pts[i].v; carryShip = pts[i].s; seen = true; i++; }
    for (let d = startMs; d <= today; d += DAY) {
      const vals = []; let drops = 0, prev = carry;
      if (seen) vals.push(carry);
      while (i < pts.length && pts[i].t < d + DAY) {
        if (prev != null && pts[i].v != null && pts[i].v < prev) drops++;
        prev = pts[i].v; carry = pts[i].v; carryShip = pts[i].s; seen = true; vals.push(carry); i++;
      }
      if (!seen) continue;
      const nn = vals.filter(v => v != null);
      out[dayStr(d)] = { close: carry, ship: carryShip, min: nn.length ? Math.min(...nn) : null, avg: nn.length ? nn.reduce((a, b) => a + b, 0) / nn.length : null, drops };
    }
    return out;
  }

  async function one(p) {
    const startMs = p.last_day ? Math.max(today - (backfillDays - 1) * DAY, Date.parse(p.last_day + 'T00:00:00Z') - 2 * DAY) : today - (backfillDays - 1) * DAY;
    const days = Math.round((today - startMs) / DAY) + 1;
    let res;
    try { res = await callTool(K, 'get_price_history', { asin: p.asin, domain: 'com', dataTypes: TYPES, days, maxPointsPerSeries: 1000 }); }
    catch (e) { stats.errors.push([p.asin, String(e.message || e).slice(0, 150)]); return; }
    const s = (res && res.series) || {};
    if (!Object.keys(s).length || !Object.values(s).some(x => x && Array.isArray(x.points) && x.points.length)) { stats.noHistory++; skip[p.asin] = new Date().toISOString(); return; }
    stats.fetched++;
    raw.push({ asin: p.asin, days, series: s });
    const sales = daily(s.SALES && s.SALES.points, startMs), nw = daily(s.NEW && s.NEW.points, startMs), amz = daily(s.AMAZON && s.AMAZON.points, startMs);
    const bb = daily(s.BUY_BOX_SHIPPING && s.BUY_BOX_SHIPPING.points, startMs), rt = daily(s.RATING && s.RATING.points, startMs), rc = daily(s.COUNT_REVIEWS && s.COUNT_REVIEWS.points, startMs);
    const downs = TYPES.some(t => s[t] && Array.isArray(s[t].points) && s[t].points.length >= 1000);
    if (downs) stats.downsampled++;
    const dates = Array.from(new Set([sales, nw, amz, bb, rt, rc].flatMap(o => Object.keys(o)))).sort();
    const TS = `'${new Date().toISOString()}'::timestamptz`;
    const src = downs ? 'keepa_price_history:downsampled' : 'keepa_price_history';
    const r2 = v => v == null ? null : Math.round(v * 100) / 100;
    const rows = dates.map(d => {
      const S = sales[d] || {}, N = nw[d] || {}, A = amz[d], B = bb[d] || {}, R = rt[d] || {}, C = rc[d] || {};
      return `(${q(p.asin)}, '${d}', ${nv(S.min != null ? Math.round(S.min) : null)}, ${nv(S.avg != null ? Math.round(S.avg) : null)}, ${nv(S.close != null ? Math.round(S.close) : null)}, ${nv(sales[d] ? S.drops : null)}, ${nv(r2(N.min))}, ${nv(r2(N.close))}, ${nv(A ? r2(A.close) : null)}, ${A ? (A.close != null ? 'true' : 'false') : 'NULL'}, ${nv(r2(B.close))}, ${nv(B.ship != null ? r2(Number(B.ship)) : null)}, ${nv(R.close != null ? Math.round(R.close * 10) / 10 : null)}, ${nv(C.close != null ? Math.round(C.close) : null)}, ${q(src)}, ${q(COLLECTOR)}, ${TS})`;
    });
    if (!rows.length) return;
    const cols = 'asin, day, sales_rank_min, sales_rank_avg, sales_rank_close, sales_rank_drops, new_price_min, new_price_close, amazon_price_close, amazon_in_stock, buybox_price_close, buybox_shipping_close, rating, review_count, source, collector_version, loaded_at';
    const set = cols.split(', ').filter(c => c !== 'asin' && c !== 'day').map(c => `${c}=EXCLUDED.${c}`).join(', ');
    for (let k = 0; k < rows.length; k += 400) {
      await write(`INSERT INTO command.fmic_keepa_daily (${cols}) VALUES\n${rows.slice(k, k + 400).join(',\n')}\nON CONFLICT (asin, day) DO UPDATE SET ${set};`);
    }
    stats.rows += rows.length;
  }

  async function worker() {
    while (idx < picks.length) {
      if (Date.now() - t0 > budgetMs) { stopReason = 'time_budget'; return; }
      if (tok && tok.tokensLeft < minTokens) { stopReason = 'token_floor'; return; }
      const p = picks[idx++];
      await one(p);
      if (idx % 10 === 0) tok = await callTool(K, 'get_token_status', {});
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  let rawRef = null;
  if (raw.length) {
    const now = new Date().toISOString();
    rawRef = `raw/keepa/history/${now.slice(0, 10)}/history_${now.replace(/[:.]/g, '-')}.json`;
    try { await callTool('workspace', 'write_text_file', { fileName: rawRef, content: JSON.stringify({ source: 'keepa.get_price_history', collector: COLLECTOR, fetched_at: now, types: TYPES, items: raw }), allowOverwrite: false }); }
    catch (e) { rawRef = 'ERROR ' + String(e.message || e).slice(0, 150); }
  }
  tok = await callTool(K, 'get_token_status', {});
  const remaining = (await sql(`WITH x AS (SELECT c.asin, (COALESCE(c.current_price, 0) > 0) live, (SELECT max(day) FROM command.fmic_keepa_daily k WHERE k.asin=c.asin) last_day FROM command.fmic_electric_catalog c) SELECT count(*) FILTER (WHERE last_day IS NULL)::int never, count(*) FILTER (WHERE last_day IS NOT NULL AND ((live AND last_day < current_date - 1) OR (NOT live AND last_day < current_date - 7)))::int stale FROM x`))[0];
  const out = { picked: stats.picked, processed: Math.min(idx, picks.length), fetched: stats.fetched, noHistory: stats.noHistory, rowsUpserted: stats.rows, downsampled: stats.downsampled, errors: stats.errors.slice(0, 10), stopReason, remainingNeverFetched: remaining.never - Object.keys(skip).length, remainingStale: remaining.stale, skippedNoHistory: Object.keys(skip).length, tokensStart, tokensLeft: tok && tok.tokensLeft, elapsedSec: Math.round((Date.now() - t0) / 1000), rawRef };
  const TS2 = `'${new Date().toISOString()}'::timestamptz`;
  await write(`INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('keepa_history', 0, ${TS2}, '${esc(JSON.stringify({ last: out, no_history: skip }))}'::jsonb, ${TS2}) ON CONFLICT (job_key) DO UPDATE SET last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`);
  return { success: stats.errors.length === 0, ...out, dualWrite: dw };
}