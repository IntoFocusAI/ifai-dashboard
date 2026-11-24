async function run(inputs) {
  // Weekly fender.com Findability recheck. Writes through command.record_spec_findability_attempt,
  // the same function that loaded the 12 Oct 2026 run (collector findability-w17.7).
  const DRY = inputs.dryRun === true;
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const MIRRORS = [{ id: '5528f699-8878-4b19-b26b-93ca0ee6bee7', name: 'sandbox' }, { id: 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532', name: 'mirror' }, { id: 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c', name: 'claude' }];
  const WRENCH = 'fender_findability_recheck';
  const VERSION = 'findability-recheck-v1';
  const JOB = 'findability_recheck';
  const batchSize = Math.max(1, Math.min(20, Number(inputs.batchSize || 6)));
  const refreshDays = Math.max(1, Number(inputs.refreshDays || 7));
  const MAX_READS = 6;
  const sq = s => `'${String(s == null ? '' : s).replace(/'/g, "''")}'`;

  async function sqlOn(id, q) {
    const r = await callTool(id, 'execute_sql', { query: q });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const sql = q => sqlOn(SB, q);
  const dw = { mirrored: 0, failed: 0, lastError: null };
  async function write(q) {
    if (DRY) return [];
    const res = await sqlOn(SB, q);
    await Promise.all(MIRRORS.map(async t => {
      try { await sqlOn(t.id, q); dw.mirrored++; }
      catch (e) {
        dw.failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES (${sq(WRENCH)}, ${sq(t.name)}, ${sq(String(e.message || e).slice(0, 2000))}, ${sq(q)}); SELECT 1 ok`); } catch (_) {}
      }
    }));
    return res;
  }

  // Population: the listings the dashboard's Findability view counts (catalog rows with a Buy Box seller).
  const SELECT = `SELECT c.asin::text AS asin, c.title, c.color, c.model_number, c.upc, c.category::text AS category,
      f.product_kind, f.findability_state AS prev_state, f.canonical_url AS prev_url, f.variant_sku AS prev_variant,
      f.last_success_url, f.last_success_variant_sku, f.source_method AS prev_source, f.match_confidence AS prev_conf,
      encode(sha256(convert_to(concat_ws('|', c.asin, c.model_number, c.upc, c.title, c.color), 'UTF8')), 'hex') AS ihash
    FROM command.fmic_electric_catalog c
    LEFT JOIN command.fmic_spec_findability_current f ON f.asin::text = c.asin::text`;
  const QUEUE = `c.buybox_seller IS NOT NULL AND (f.asin IS NULL OR f.attempt_at < now() - interval '${refreshDays} days')`;
  let rows;
  if (Array.isArray(inputs.asins) && inputs.asins.length) {
    rows = await sql(`${SELECT} WHERE c.asin IN (${inputs.asins.map(sq).join(',')})`);
  } else {
    rows = await sql(`${SELECT} WHERE ${QUEUE} ORDER BY f.attempt_at ASC NULLS FIRST, c.asin LIMIT ${batchSize}`);
  }
  if (!rows.length) return { success: true, done: true, dryRun: DRY };

  // ---------- matching helpers ----------
  const norm = s => String(s || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
  const toks = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const SHAPES = ['stratocaster','telecaster','jazzmaster','jaguar','mustang','precision','jazz','starcaster','duo','toronado','meteora','bronco','musicmaster','esquire'];
  const LINES = ['sonic','affinity','classic','vibe','bullet','debut','mini','player','ii','plus','professional','ultra','vintera','deluxe','modified','performer','elite','acoustasonic','custom','shop','american','paranormal','contemporary','standard','signature'];
  const pickFrom = (list, t) => list.filter(x => t.includes(x));
  // Loose gate for title-search links and ambiguous pages. Acceptance always needs a Fender SKU, barcode or prior-variant match.
  function handleAgrees(handle, title) {
    const h = toks(handle), t = toks(title);
    const ts = pickFrom(SHAPES, t);
    if (ts.length && pickFrom(SHAPES, h).join() !== ts.join()) return false;
    if (pickFrom(LINES, h).sort().join('|') !== pickFrom(LINES, t).sort().join('|')) return false;
    return true;
  }
  const headOf = title => String(title || '').split(',')[0].replace(/\s+-\s+.*$/, '').trim();
  const coreOf = title => headOf(title).replace(/\b(fender|squier|electric guitar|electric|guitar)\b/gi, ' ').replace(/[®™]/g, ' ').replace(/\s+/g, ' ').trim();
  const slug = s => toks(s).join('-');
  function kindOf(title) {
    const t = String(title || '');
    if (/\bstrings\b|\bstring set\b/i.test(t)) return 'strings';
    if (/\b(case|gig bag|cover)\b/i.test(t)) return 'case';
    if (/\b(pack|bundle|kit)\b/i.test(t)) return 'pack';
    if (/\b(guitar|bass|stratocaster|telecaster|jazzmaster|jaguar|mustang|precision|starcaster|toronado|meteora|bronco|esquire)\b/i.test(t)) return 'instrument';
    return 'part';
  }
  const handleOf = u => { const m = String(u || '').match(/\/products\/([^\/?#]+)/); return m ? m[1].toLowerCase() : null; };

  // ---------- browser ----------
  function extractEvalJson(text) {
    const marker = 'eval returned:\n';
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    let rest = text.slice(idx + marker.length).trim();
    if (rest.startsWith('"')) { try { rest = JSON.parse(rest.slice(0, rest.lastIndexOf('"') + 1)); } catch (e) { } }
    const start = rest.indexOf('{');
    if (start === -1) return null;
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let i = start; i < rest.length; i++) {
      const ch = rest[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    try { return JSON.parse(rest.slice(start, end + 1)); } catch (e) { return null; }
  }
  const PAGE_EVAL = "(async()=>{const h=location.pathname.replace(/\\/$/,'').split('/').pop();let f=null,st=null;try{const r=await fetch('/products/'+h+'.js');st=r.status;if(r.ok)f=await r.json()}catch(e){}const can=document.querySelector('link[rel=canonical]');const body=document.body?document.body.innerText.slice(0,400):'';return JSON.stringify({url:location.href,title:document.title,canonical:can?can.href:null,feedStatus:st,handle:f?f.handle:null,name:f?f.title:null,variants:f?(f.variants||[]).map(v=>({id:v.id,sku:v.sku||null,barcode:v.barcode||null,title:v.title||null})):[],blocked:/access denied|captcha|are you a robot|verify you are human/i.test(body)})})()";
  const SEARCH_EVAL = "JSON.stringify({links:[...new Set([...document.querySelectorAll('a[href*=\"/products/\"]')].map(a=>(a.getAttribute('href')||'').split('?')[0]))].slice(0,30),blocked:/access denied|captcha|are you a robot|verify you are human/i.test(document.body?document.body.innerText.slice(0,400):'')})";
  async function browse(session, url, expr, waitMs) {
    const res = await callTool('browser', 'browser_interact', { session, url, steps: [{ wait: { ms: waitMs || 2500 } }, { eval: { expression: expr } }] });
    return extractEvalJson((res && res.text) || '');
  }

  // ---------- per listing ----------
  const results = [], payloads = [];
  let errored = 0;
  for (const row of rows) {
    const session = 'find_' + row.asin;
    const pn = norm(row.model_number).length >= 7 ? norm(row.model_number) : null;
    const pn10 = pn ? pn.padStart(10, '0') : null;
    const upc = norm(row.upc) || null;
    const priorVariant = row.prev_variant || row.last_success_variant_sku || null;
    const trail = [];
    let reads = 0, readErrors = 0, blocked = false, success = null, ambiguous = null, lastError = null;

    const cand = [];
    const add = (url, source) => { const h = handleOf(url); if (h && /^[a-z0-9][a-z0-9-]*$/.test(h) && !cand.some(c => c.h === h)) cand.push({ h, url: 'https://www.fender.com/products/' + h, source }); };

    async function tryCandidate(c) {
      if (reads >= MAX_READS || success) return;
      reads++;
      let pe = null;
      try {
        pe = await browse(session, c.url, PAGE_EVAL, 2500);
        if (!pe || (!pe.handle && !pe.blocked && pe.feedStatus == null)) pe = await browse(session, c.url, PAGE_EVAL, 6000);
      } catch (e) { readErrors++; lastError = String(e.message || e).slice(0, 300); trail.push(c.h + ':read_error'); return; }
      if (!pe) { readErrors++; lastError = 'page eval returned nothing'; trail.push(c.h + ':read_error'); return; }
      if (pe.blocked) { blocked = true; trail.push(c.h + ':blocked'); return; }
      if (!pe.handle || !pe.variants.length) { trail.push(c.h + ':not_a_product_page'); return; }
      const v = pe.variants;
      let match = null, conf = 'none';
      if (pn) { match = v.find(x => norm(x.sku) === pn) || null; if (match) conf = 'sku'; }
      if (!match && upc) { match = v.find(x => norm(x.barcode) === upc) || null; if (match) conf = 'gtin'; }
      if (!match && priorVariant) { match = v.find(x => norm(x.sku) === norm(priorVariant)) || null; if (match) conf = 'variant_options'; }
      if (!match) {
        trail.push(c.h + ':no_variant_match');
        if (!ambiguous && handleAgrees(c.h, row.title)) ambiguous = { c, pe };
        return;
      }
      const matched = [], conflicts = [];
      if (pn && norm(match.sku) === pn) matched.push('fender_sku');
      if (upc && match.barcode) { if (norm(match.barcode) === upc) matched.push('barcode'); else conflicts.push('barcode_differs'); }
      if (conf === 'variant_options') matched.push('prior_variant');
      trail.push(c.h + ':matched(' + conf + ')');
      success = { c, pe, match, conf, matched, conflicts };
    }

    // 1. The page found last time, 2. fender.com search by Fender SKU, 3. search by title, 4. a handle built from the title.
    if (row.prev_url || row.last_success_url) add(row.prev_url || row.last_success_url, row.prev_source || 'derived_handle');
    for (const c of cand.slice()) await tryCandidate(c);
    if (!success && !blocked && pn10) {
      try {
        const sj = await browse(session, `https://www.fender.com/search?q=${encodeURIComponent(pn10)}&type=product`, SEARCH_EVAL, 2500);
        if (sj && sj.blocked) blocked = true;
        const before = cand.length;
        for (const l of ((sj && sj.links) || []).slice(0, 3)) add(l, 'model_number_search');
        for (const c of cand.slice(before)) await tryCandidate(c);
      } catch (e) { readErrors++; lastError = String(e.message || e).slice(0, 300); trail.push('sku_search:error'); }
    }
    if (!success && !blocked) {
      try {
        const sj = await browse(session, `https://www.fender.com/search?q=${encodeURIComponent(headOf(row.title))}&type=product`, SEARCH_EVAL, 2500);
        if (sj && sj.blocked) blocked = true;
        const before = cand.length;
        for (const l of ((sj && sj.links) || [])) { const h = handleOf(l); if (h && handleAgrees(h, row.title)) add(l, 'search_meta'); }
        for (const c of cand.slice(before, before + 3)) await tryCandidate(c);
      } catch (e) { readErrors++; lastError = String(e.message || e).slice(0, 300); trail.push('title_search:error'); }
    }
    if (!success && !blocked) {
      const base = slug(coreOf(row.title));
      const before = cand.length;
      if (base) { add('/products/' + base, 'derived_handle'); add('/products/squier-' + base, 'derived_handle'); }
      for (const c of cand.slice(before)) await tryCandidate(c);
    }
    try { await callTool('browser', 'browser_interact', { session, closeSession: true }); } catch (_) { }

    const at = new Date().toISOString();
    const kind = row.product_kind || kindOf(row.title);
    const p = {
      attempt_key: `${VERSION}|${row.asin}|${at}`, asin: row.asin, attempt_at: at, collector_version: VERSION,
      title: row.title, category: row.category, product_kind: kind, catalog_identity_hash: row.ihash,
      jsonld_status: 'not_checked', matched_identifiers: [], conflicting_identifiers: [], match_confidence: 'none',
      canonical_url: null, variant_sku: null, source_method: null, page_title: null, resolved_url: null,
      browser_outcome: trail.join(' | ').slice(0, 1000), last_error: null, http_status: null
    };
    if (success) {
      const n = success.pe.variants.length;
      const exact = n === 1;
      Object.assign(p, {
        findability_state: exact ? 'exact_official_product' : 'official_family_page',
        canonical_url: 'https://www.fender.com/products/' + String(success.pe.handle).toLowerCase(),
        resolved_url: String(success.pe.url || '').split('?')[0], canonical_tag: success.pe.canonical,
        source_method: success.c.source, match_confidence: success.conf,
        matched_identifiers: success.matched, conflicting_identifiers: success.conflicts,
        variant_sku: success.match.sku || null, page_title: success.pe.name, http_status: 200,
        match_explanation: exact
          ? `Official page has one variant and ${success.conf === 'gtin' ? 'barcode' : 'Fender SKU'} ${success.conf === 'gtin' ? success.match.barcode : success.match.sku} matches.${success.match.title ? ' ' + success.match.title : ''}`
          : `Official family page with ${n} variants. Variant SKU ${success.match.sku} matches${success.match.title ? ': ' + success.match.title : ''}.`
      });
      if (!p.variant_sku) { p.findability_state = 'ambiguous_candidate'; p.canonical_url = null; p.match_confidence = 'none'; p.match_explanation = 'Matching variant has no Fender SKU on the page.'; }
    } else if (blocked) {
      Object.assign(p, { findability_state: 'blocked', last_error: 'fender.com returned a bot check', match_explanation: 'fender.com blocked the check.' });
    } else if (ambiguous) {
      Object.assign(p, { findability_state: 'ambiguous_candidate', resolved_url: 'https://www.fender.com/products/' + ambiguous.c.h, page_title: ambiguous.pe.name, http_status: 200, match_explanation: `Closest official page has ${ambiguous.pe.variants.length} variant(s), and none carries this listing's Fender SKU or barcode.` });
    } else if (readErrors && readErrors >= reads) {
      Object.assign(p, { findability_state: 'timeout', last_error: lastError, match_explanation: 'fender.com pages did not load.' });
    } else {
      Object.assign(p, { findability_state: 'completed_not_found', http_status: 200, match_explanation: reads ? 'Search finished without an official page carrying this listing\'s Fender SKU or barcode.' : 'Search returned no candidate page.' });
    }
    if (['blocked', 'timeout'].includes(p.findability_state)) errored++;
    payloads.push(p);
    results.push({ asin: row.asin, state: p.findability_state, prev: row.prev_state || 'not_checked', url: p.canonical_url || p.resolved_url, conf: p.match_confidence, variant: p.variant_sku, source: p.source_method, reads, trail: trail.slice(0, 10) });
  }

  // If most of the batch failed to load, write nothing: a site-wide problem should not overwrite good readings.
  const abort = errored * 2 > rows.length;
  if (!abort && payloads.length) {
    const calls = payloads.map(p => `SELECT command.record_spec_findability_attempt($frk$${JSON.stringify(p)}$frk$::jsonb);`).join('\n');
    await write('BEGIN;\n' + calls + '\nCOMMIT;\nSELECT 1 AS ok;');
  }
  const left = await sql(`SELECT count(*)::int n FROM command.fmic_electric_catalog c LEFT JOIN command.fmic_spec_findability_current f ON f.asin::text = c.asin::text WHERE ${QUEUE}`);
  const remaining = Number((left[0] || {}).n || 0);
  const by = {};
  for (const r of results) by[r.state] = (by[r.state] || 0) + 1;
  const stats = { version: VERSION, checked: results.length, states: by, errored, aborted: abort, remaining };
  if (!Array.isArray(inputs.asins) || !inputs.asins.length) {
    await write(`INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('${JOB}', ${remaining}, now(), ${sq(JSON.stringify(stats))}::jsonb, now()) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at; SELECT 1 ok;`);
  }
  return { success: !abort, dryRun: DRY, ...stats, results, dualWrite: dw };
}