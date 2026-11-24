async function run(inputs) {
  const K = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const batch = Math.max(1, Math.min(1000, Number(inputs.batch || 300)));
  const concurrency = Math.max(1, Math.min(8, Number(inputs.concurrency || 4)));
  const minTokens = Number(inputs.minTokens || 800);
  const budgetMs = Number(inputs.timeBudgetSec || 240) * 1000;
  const t0 = Date.now();
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const q = s => (s == null || s === '') ? 'NULL' : `'${esc(s)}'`;
  const j = v => (v == null) ? 'NULL' : `'${esc(JSON.stringify(v))}'::jsonb`;
  async function sql(query) {
    const r = await callTool(SB, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const DUE = `FROM ledlenser.listing_content l JOIN ledlenser.catalog c USING (asin) WHERE (c.brand_sku IS NOT NULL OR c.title ~* 'led[- ]?lenser') AND (COALESCE(c.current_price, 0) > 0 OR c.brand_sku IS NOT NULL) AND (l.content_checked_at IS NULL OR l.content_checked_at < now() - interval '7 days')`;
  const ask = asin => callTool(K, 'get_product_content', { asin, domain: 'com', includeAPlus: true, includeVideos: true });
  let picks;
  if (Array.isArray(inputs.asins) && inputs.asins.length) picks = inputs.asins.map(a => ({ asin: a }));
  else picks = await sql(`SELECT l.asin ${DUE} ORDER BY l.content_checked_at NULLS FIRST, (COALESCE(c.current_price, 0) > 0) DESC, l.asin LIMIT ${batch}`);
  let tok = await callTool(K, 'get_token_status', {});
  const tokensStart = tok && tok.tokensLeft;
  const raw = [], rows = [], errors = [];
  let idx = 0, stopReason = picks.length ? 'batch_done' : 'nothing_due';
  const textOf = v => v == null ? '' : (typeof v === 'string' ? v : (Array.isArray(v) ? v.map(textOf).join('\n') : (typeof v === 'object' ? Object.values(v).map(textOf).join('\n') : String(v))));
  async function one(p) {
    let res;
    try { res = await ask(p.asin); } catch (e) { errors.push([p.asin, String(e.message || e).slice(0, 150)]); return; }
    if (!res || res.error) { errors.push([p.asin, JSON.stringify(res || null).slice(0, 150)]); return; }
    raw.push({ asin: p.asin, res });
    const desc = res.description == null ? null : textOf(res.description).trim();
    const ap = res.aPlusText || res.aPlus || res.aplus || res.aPlusContent || null;
    const modules = Array.isArray(ap) ? ap : (ap && Array.isArray(ap.modules) ? ap.modules : null);
    const apText = ap == null ? null : textOf(ap).trim();
    const vids = Array.isArray(res.videos) ? res.videos : null;
    rows.push({ asin: p.asin, desc: desc || null, apText: apText || null, apCount: modules ? modules.length : (apText ? 1 : 0), vids, vCount: vids ? vids.length : 0 });
  }
  async function worker() {
    while (idx < picks.length) {
      if (Date.now() - t0 > budgetMs) { stopReason = 'time_budget'; return; }
      if (tok && tok.tokensLeft < minTokens) { stopReason = 'token_floor'; return; }
      const p = picks[idx++];
      await one(p);
      if (idx % 20 === 0) tok = await callTool(K, 'get_token_status', {});
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const now = new Date().toISOString();
  let ref = null;
  if (raw.length) {
    ref = `raw/keepa/content/${now.slice(0, 10)}/content_${now.replace(/[:.]/g, '-')}.json`;
    try { await callTool('workspace', 'write_text_file', { fileName: ref, content: JSON.stringify({ source: 'keepa.get_product_content', fetched_at: now, items: raw }), allowOverwrite: false }); }
    catch (e) { ref = null; errors.push(['storage', String(e.message || e).slice(0, 150)]); }
  }
  const TS = `'${now}'::timestamptz`;
  const stmts = rows.map(r => `UPDATE ledlenser.listing_content SET description=${q(r.desc)}, description_length=${r.desc ? r.desc.length : 'NULL'}, aplus_text=${q(r.apText)}, aplus_module_count=${r.apCount}, aplus_state=${q(r.apCount > 0 ? 'present' : 'none_reported')}, videos=${j(r.vids)}, video_count=${r.vCount}, video_state=${q(r.vCount > 0 ? 'present' : 'none_reported')}, content_checked_at=${TS}, content_payload_ref=${q(ref)}, updated_at=${TS} WHERE asin=${q(r.asin)};`);
  for (let k = 0; k < stmts.length; k += 50) await sql('BEGIN;\n' + stmts.slice(k, k + 50).join('\n') + '\nCOMMIT;');
  tok = await callTool(K, 'get_token_status', {});
  const left = (await sql(`SELECT count(*)::int n ${DUE}`))[0].n;
  return { success: errors.length === 0, picked: picks.length, updated: rows.length, withDescription: rows.filter(r => r.desc).length, withAPlus: rows.filter(r => r.apCount > 0).length, withVideo: rows.filter(r => r.vCount > 0).length, errors: errors.slice(0, 10), stopReason, remainingDue: left, tokensStart, tokensLeft: tok && tok.tokensLeft, elapsedSec: Math.round((Date.now() - t0) / 1000), rawRef: ref };
}