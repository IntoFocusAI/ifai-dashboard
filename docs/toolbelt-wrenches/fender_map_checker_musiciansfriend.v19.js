async function run(inputs) {
  const DRY = inputs.dryRun === true;
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const EXA = 'Exa AI Provided By Apexti';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const WRENCH = 'fender_map_checker_musiciansfriend';
  const VERSION = 19;
  // v19 (R-10 step 2): every check also appends one row to command.retail_price_observations on
  // PROD only (the sandbox/mirror/claude copies don't have the table): priced / no_match /
  // check_failed, source retailer_checker. Written after, and apart from, the column write, so a
  // failure of either (or of a copy) never blocks the other. mf_* and PR 244 streak columns as v18.
  // v19 false-miss fix (23 Nov 2026): a search page whose cards hold no Fender-family product
  // (Fender, Squier, Gretsch, Jackson, Charvel, EVH) is off_topic: stamp only, check_failed, streak
  // unchanged. Before a 2nd miss drops a stored price, the stored mf_url is re-read; if it is still
  // the same Fender product with a price (identity rules, see judge), the price is kept from it.
  const COLLECTOR = 'fender_map_checker_musiciansfriend_v19';
  const RUN_ID = `fender_map_checker_musiciansfriend:v19:${new Date().toISOString()}`;
  const OBS = 'command.retail_price_observations';
  const FENDER_FAMILY = /\b(fender|squier|squire|gretsch|jackson|charvel|evh)\b/i;
  // v18: a stored MF price is dropped after this many passes in a row whose search returned
  // product cards but none matched (Brian Magazu, 18 Nov 2026). An empty search page, a failed
  // read or an unparsable page doesn't count. v14-v17 cleared the price on the first no-match.
  const DROP_AFTER_MISSES = 2;
  const batchSize = Number(inputs.batchSize || 8);
  const refreshDays = Math.max(1, Number(inputs.refreshDays || 3));
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  async function sqlOn(id, q) {
    const r = await callTool(id, 'execute_sql', { query: q });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const sql = q => sqlOn(SB, q);
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  async function write(q) {
    if (DRY) return [];
    q = q.replace(/\bnow\(\)/g, `'${new Date().toISOString()}'::timestamptz`);
    const res = await sqlOn(SB, q);
    await Promise.all(MIRRORS.map(async t => {
      try { await sqlOn(t.id, q); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES ('${WRENCH}', '${t.name}', '${esc(String(e.message || e).slice(0, 2000))}', '${esc(q)}')`); } catch (_) {}
      }
    }));
    return res;
  }

  const STOP = new Set(['fender','electric','guitar','with','the','and','series','beginner','fingerboard','limited','edition']);
  const words = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>1 && !STOP.has(w));
  const cover = (a,b) => { const A=new Set(words(a)),B=new Set(words(b)); if(!A.size) return 0; let h=0; for(const t of A) if(B.has(t)) h++; return h/A.size; };
  const TIER = ['mini','affinity','sonic','debut','bullet','classic','vibe','contemporary','paranormal','player','ii','professional','ultra','vintera','deluxe','modified','performer','elite','signature','acoustasonic','custom','shop','american','junior','thinline','hss','hh','ht','fsr'];
  const SHAPE = ['stratocaster','telecaster','jazzmaster','jaguar','mustang','precision','jazz','bass','starcaster','duo','toronado','meteora'];
  const BOARD = ['rosewood','maple','ebony','laurel','ferro'];
  const pick = (t, list) => { const w = new Set(words(t)); return list.filter(x => w.has(x)).sort().join('|'); };
  // v14: Squier-only lines count as Squier even when the Amazon title omits the brand (e.g. "Affinity Series Telecaster").
  const isSquier = t => /squier|squire|\baffinity\b|\bsonic\b|classic vibe|\bbullet\b|paranormal|\bdebut\b/i.test(t||'');
  const isLtd = t => /limited|\bfsr\b|exclusive/i.test(t||'');
  // v14: configuration words must agree on both sides (a fretted Jazz Bass matched the Fretless one in testing).
  const config = t => ['fretless','12-string|12 string','short scale|short-scale'].map(r => new RegExp(r,'i').test(t||'') ? '1' : '0').join('');
  const stripTail = t => String(t||'').replace(/\s+(bundle|w\/|with)\b.*$/i,'');
  // v17: also drop brackets and quote marks from search queries; "Telecaster (Black)" and
  // "\"Mini\" Strat" made odd search URLs.
  const clean = t => stripTail(t).replace(/\b(beginner|electric guitar|electric|guitar)\b/gi,' ').replace(/[,\-()\[\]"“”]/g,' ').replace(/\s+/g,' ').trim();
  const reEsc = s => String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  // v14 queue: never-checked rows first, then any row last checked more than refreshDays ago.
  // (v13 only took rows never checked, so nothing was ever refreshed after the first pass.)
  const QUEUE_WHERE = `c.current_price >= 100 AND NOT COALESCE(c.is_bundle,false) AND (r.mf_checked_at IS NULL OR r.mf_checked_at < now() - interval '${refreshDays} days')`;
  const COLS = `r.asin, c.title, c.color, c.current_price, r.map_price, r.mf_price AS stored_mf, r.mf_url AS stored_mf_url, r.mf_miss_streak AS miss_streak`;
  let skus;
  if (Array.isArray(inputs.asins) && inputs.asins.length) {
    skus = await sql(`SELECT ${COLS}
      FROM command.fmic_retail_buybox_map r JOIN command.fmic_electric_catalog c USING (asin)
      WHERE r.asin IN (${inputs.asins.map(a=>`'${esc(a)}'`).join(',')})`);
  } else {
    skus = await sql(`SELECT ${COLS}
      FROM command.fmic_retail_buybox_map r JOIN command.fmic_electric_catalog c USING (asin)
      WHERE ${QUEUE_WHERE}
      ORDER BY r.mf_checked_at ASC NULLS FIRST, c.sales_rank ASC NULLS LAST LIMIT ${batchSize}`);
  }
  if (!skus.length) return { success: true, done: true, dryRun: DRY, version: VERSION };

  // v14 fetch: Musician's Friend's bot protection returns "Access Denied" to the headless
  // browser (since about 8 Oct 2026). Exa's crawler reads the search page; each result card
  // carries a "SkuInfo [key=value, ...]" block with the same fields the old parser read.
  function parseCards(text) {
    const cards = [];
    const re = /SkuInfo \[([\s\S]*?)\](?=\s)/g;
    let m;
    while ((m = re.exec(text)) && cards.length < 12) {
      const body = m[1];
      const g = k => { const mm = body.match(new RegExp('(?:^|, )' + k + ' ?=([\\s\\S]*?)(?=, [A-Za-z]+ ?=|$)')); const v = mm ? mm[1].trim() : null; return v === 'null' ? null : v; };
      const link = g('linkUrl');
      cards.push({ t: g('displayName'), lp: parseFloat(g('lowPrice')), msrp: parseFloat(g('maxSavingMSRP')), used: g('allUsed'), url: link ? 'https://www.musiciansfriend.com' + link : null });
    }
    return cards;
  }
  async function search(q) {
    const url = 'https://www.musiciansfriend.com/search?Ntt=' + encodeURIComponent(q);
    const res = await callTool(EXA, 'crawling', { url, auto_database_threshold: 0 });
    const obj = typeof res === 'string' ? JSON.parse(res) : (res && typeof res.result === 'string' ? JSON.parse(res.result) : (res && Array.isArray(res.content) && res.content[0] && res.content[0].text ? JSON.parse(res.content[0].text) : res));
    const page = obj && obj.results && obj.results[0];
    const st = obj && obj.statuses && obj.statuses[0];
    if (!page || (st && st.status && st.status !== 'success')) throw new Error('fetch_failed: ' + JSON.stringify(st || {}).slice(0, 200));
    const text = String(page.text || '');
    if (/Access Denied|errors\.edgesuite\.net/i.test(text)) throw new Error('blocked');
    const cards = parseCards(text);
    const hasSkuBlocks = /SkuInfo \[/.test(text);
    return { cards, parseFailed: hasSkuBlocks && cards.length > 0 && cards.every(c => !c.t), url };
  }

  // v19: re-read the stored MF product page. Exa returns a product entity with name and offer price.
  // { card } when the page loads with a product, { err } otherwise.
  async function readProduct(url) {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await callTool(EXA, 'crawling', { url, auto_database_threshold: 0 });
        const obj = typeof res === 'string' ? JSON.parse(res) : (res && typeof res.result === 'string' ? JSON.parse(res.result) : (res && Array.isArray(res.content) && res.content[0] && res.content[0].text ? JSON.parse(res.content[0].text) : res));
        const page = obj && obj.results && obj.results[0];
        const st = obj && obj.statuses && obj.statuses[0];
        if (!page || (st && st.status && st.status !== 'success')) { last = 'fetch_failed: ' + JSON.stringify(st || {}).slice(0, 160); continue; }
        if (/Access Denied|errors\.edgesuite\.net/i.test(String(page.text || ''))) { last = 'blocked'; continue; }
        const ent = (page.entities || []).find(e => e && e.type === 'product');
        const pr = ent && ent.properties;
        if (pr) {
          const offer = pr.offer || {};
          return { card: { t: pr.name || page.title || null, brand: pr.brand && pr.brand.name, lp: Number(offer.price && offer.price.amount), availability: offer.availability || null, url } };
        }
        // Exa sometimes returns the page without the product entity (seen 23 Nov). The page text
        // starts "# <name>" then "<price> $ <formatted price>".
        const text = String(page.text || '');
        const hm = text.match(/^#\s+(.+)\n+\s*(\d+(?:\.\d{1,2})?)\s+\$/m);
        if (hm) return { card: { t: hm[1].trim(), brand: null, lp: Number(hm[2]), availability: null, url } };
        last = 'no_product_entity';
      } catch (e) { last = String(e.message || e).slice(0, 160); }
    }
    return { err: last };
  }

  // v18: results came back but none matched. Count the miss; on the 2nd in a row, drop the stored
  // MF price and its details and take MF out of channels. The trigger recomputes mf_leakage.
  // v19: missed(asin, after) drops at `after` misses in a row. When the stored page could not be
  // re-read (Exa failed), the miss counts but the price is kept one pass longer (drop at 3).
  const missed = (asin, after = DROP_AFTER_MISSES) => { const DROP = `mf_miss_streak + 1 >= ${after}`; return `UPDATE command.fmic_retail_buybox_map SET mf_checked_at=now(), mf_miss_streak = mf_miss_streak + 1,
    mf_price = CASE WHEN ${DROP} THEN NULL ELSE mf_price END, mf_msrp = CASE WHEN ${DROP} THEN NULL ELSE mf_msrp END,
    mf_title = CASE WHEN ${DROP} THEN NULL ELSE mf_title END, mf_url = CASE WHEN ${DROP} THEN NULL ELSE mf_url END,
    channels = CASE WHEN ${DROP} THEN NULLIF(array_to_string(array_remove(string_to_array(channels, ','), 'MF'), ','), '') ELSE channels END,
    updated_at = CASE WHEN ${DROP} AND mf_price IS NOT NULL THEN now() ELSE updated_at END
    WHERE asin='${esc(asin)}';`; };

  const out = [], updates = [];
  let fetchFailed = 0, blocked = 0, recovered = 0;
  for (const s of skus) {
    const base = clean(s.title);
    const model = clean(stripTail(s.title).replace(new RegExp(reEsc(s.color),'i'),'')).replace(/\bfender\b/gi,'').replace(/\s+/g,' ').trim();
    const tries = [base.slice(0,80), model.split(' ').slice(0,6).join(' ')].filter((v,i,a)=>v && a.indexOf(v)===i);
    let cards = [], used = null, parseFailed = false, okReads = 0;
    const errs = [];
    // v17: a fetch error on one query no longer abandons the SKU. Each query gets one retry
    // (Exa returned transient 404 CRAWL_NOT_FOUND for MF search pages on 14 Nov), then the
    // shorter query is tried. The SKU counts as fetch_failed only when every read failed.
    for (const q of tries) {
      let r = null;
      for (let attempt = 0; attempt < 2 && !r; attempt++) {
        try { r = await search(q); if (attempt > 0) recovered++; }
        catch (e) { errs.push(String(e.message || e).slice(0, 200)); if (/blocked/.test(String(e.message))) break; }
      }
      if (!r) continue;
      okReads++;
      if (r.parseFailed) { parseFailed = true; used = q; break; }
      if (r.cards.length) { cards = r.cards; used = q; break; }
    }
    if (!okReads) {
      fetchFailed++;
      if (errs.some(e => /blocked/.test(e))) blocked++;
      out.push({asin:s.asin, status:'fetch_failed', err:errs[errs.length-1]});
      continue;
    }
    // A page we could not parse is not evidence of "no listing": write nothing for this ASIN.
    if (parseFailed) { out.push({asin:s.asin, status:'parse_failed', q:used}); continue; }
    // v18: no product cards for any query is an empty search, not a missing listing: stamp only.
    if (!cards.length) {
      updates.push(`UPDATE command.fmic_retail_buybox_map SET mf_checked_at=now() WHERE asin='${esc(s.asin)}';`);
      out.push({asin:s.asin, status:'no_results', q:tries[0], stored_mf:s.stored_mf});
      continue;
    }
    // v19: product cards but none from the Fender family: the search said nothing about this
    // listing (an off-topic results page). Treat like an empty search: stamp only.
    if (!cards.some(c => c && c.t && FENDER_FAMILY.test(c.t))) {
      updates.push(`UPDATE command.fmic_retail_buybox_map SET mf_checked_at=now() WHERE asin='${esc(s.asin)}';`);
      out.push({asin:s.asin, status:'off_topic', q:used, seen:cards.length, sample:cards.slice(0,3).map(c => String((c && c.t) || '').slice(0,60))});
      continue;
    }

    // Amazon price is a match guardrail only, never a leakage input.
    const amz = Number(s.current_price);
    // MAP is official map_price only. No list_price / MSRP / Amazon-price fallback.
    const map = s.map_price != null ? Number(s.map_price) : null;
    const src = stripTail(s.title);
    // v14: fingerboard is read from the full title; stripTail dropped "with Maple Fingerboard", so a maple listing could match the rosewood model.
    const myTier = pick(src, TIER), myShape = pick(src, SHAPE), myBoard = pick(s.title, BOARD), myLtd = isLtd(src);
    // v19: the match rules as a function; returns a reject reason or null. With stored = true it
    // checks the re-read stored product page: that URL was matched to this listing before, so only
    // identity rules apply (Fender-family brand, not used/pack/kit/discontinued, Squier, limited,
    // configuration, shape, price band); tier, fingerboard and title-overlap rules are skipped
    // because the product page name differs from the search card's display name.
    const judge = (c, stored = false) => {
      if (!c || !c.t) return 'parse_error';
      if (stored && !FENDER_FAMILY.test(c.t + ' ' + (c.brand || ''))) return 'not_fender';
      if (stored && /discontinued/i.test(String(c.availability || ''))) return 'discontinued';
      if (!c.lp || isNaN(c.lp) || c.lp <= 0 || c.used==='true' || /vintage|used|left[- ]handed|\bpack\b|\bkit\b|bundle/i.test(c.t)) return 'used_pack_kit';
      if (isSquier(src) !== isSquier(c.t)) return 'brand';
      if (isLtd(c.t) !== myLtd) return 'limited';
      if (config(c.t) !== config(s.title)) return 'config';
      if (pick(c.t, SHAPE) !== myShape) return 'shape';
      if (!stored) {
        if (pick(c.t, TIER) !== myTier) return 'tier';
        const cb = pick(c.t, BOARD); if (myBoard && cb && cb !== myBoard) return 'board';
      }
      const ratio=c.lp/amz; if (ratio<0.6||ratio>1.6) return 'price';
      if (!stored && cover(model, c.t) < 0.5) return 'overlap';
      return null;
    };
    let best=null, bo=0, reasons={};
    const rej = k => { reasons[k]=(reasons[k]||0)+1; };
    for (const c of cards) {
      const why = judge(c);
      if (why) { rej(why); continue; }
      const o = cover(model, c.t);
      if (o>bo){bo=o;best=c;}
    }
    // v19: before a 2nd miss drops the stored MF price, re-read the stored MF product page.
    let rescue = null, rescued = false;
    if (!best && Number(s.miss_streak || 0) + 1 >= DROP_AFTER_MISSES && s.stored_mf != null && s.stored_mf_url) {
      rescue = await readProduct(s.stored_mf_url);
      if (rescue.card) {
        const why = judge(rescue.card, true);
        if (!why) { best = rescue.card; bo = Math.min(1, cover(model, best.t)); rescued = true; rescue = undefined; }
        else rescue = { rejected: why, title: String(rescue.card.t || '').slice(0, 120), price: rescue.card.lp || null, availability: rescue.card.availability };
      }
    }
    if (best) {
      // mf_leakage = mf_price - map_price; NULL when MAP missing. Negative = below MAP.
      const leak = map != null ? +(best.lp - map).toFixed(2) : null;
      // v19: a rescued price comes from the product page, which has no struck-through price: keep the stored mf_msrp.
      const msrp = rescued ? 'mf_msrp' : (best.msrp==null||isNaN(best.msrp)) ? 'NULL' : best.msrp;
      updates.push(`UPDATE command.fmic_retail_buybox_map SET mf_price=${best.lp}, mf_msrp=${msrp}, mf_title='${esc(best.t)}', mf_url=${best.url ? `'${esc(best.url)}'` : 'NULL'}, mf_leakage=${leak==null?'NULL':leak}, mf_checked_at=now(), mf_last_matched_at=now(), mf_miss_streak=0, channels = CASE WHEN channels IS NULL THEN 'MF' WHEN channels NOT LIKE '%MF%' THEN channels||',MF' ELSE channels END, updated_at=now() WHERE asin='${esc(s.asin)}';`);
      out.push({asin:s.asin, mf:best.lp, msrp:rescued ? undefined : best.msrp, rescued: rescued || undefined, amz, map, leak, conf:+bo.toFixed(2), t:best.t, url:best.url, q:used, stored_mf:s.stored_mf});
    } else {
      const unread = !!(rescue && rescue.err);
      const after = unread ? DROP_AFTER_MISSES + 1 : DROP_AFTER_MISSES;
      updates.push(missed(s.asin, after));
      const streak = Number(s.miss_streak || 0) + 1;
      const dropped = streak >= after && s.stored_mf != null;
      out.push({asin:s.asin, status:'no_match', rescue: rescue || undefined, seen:cards.length, tier:myTier, shape:myShape, rejected:reasons, q:used||tries[0], stored_mf: s.stored_mf, miss_streak: streak, dropped_price: dropped ? Number(s.stored_mf) : undefined, cards: DRY ? cards.slice(0,6) : undefined});
    }
  }

  // v19 (R-10 step 2): one observation per check, PROD only. A match -> priced; Fender-family cards
  // but no match -> no_match; failed read, unparsable page, empty or off-topic search -> check_failed.
  const TS = `'${new Date().toISOString()}'::timestamptz`;
  const obsStatus = o => o.mf ? 'priced' : o.status === 'no_match' ? 'no_match' : 'check_failed';
  const q2 = v => v == null ? 'NULL' : `'${esc(v)}'`;
  const cents = v => (v == null || isNaN(Number(v)) || Number(v) <= 0) ? 'NULL' : Math.round(Number(v) * 100);
  const obsRows = out.map(o => {
    const st = obsStatus(o), p = st === 'priced';
    return `('${esc(o.asin)}', 'musicians-friend', 'musiciansfriend.com', ${TS}, ${q2(RUN_ID)}, ${q2(COLLECTOR)}, '${st}', ${p ? cents(o.mf) : 'NULL'}, ${p ? cents(o.msrp) : 'NULL'}, ${p ? q2(o.url) : 'NULL'}, ${p ? q2(String(o.t || '').slice(0, 300)) : 'NULL'}, ${p && o.conf != null ? Math.max(0, Math.min(1, Number(o.conf))) : 'NULL'}, 'retailer_checker')`;
  });
  const obs = { written: 0, error: null, planned: out.reduce((a, o) => { const k = obsStatus(o); a[k] = (a[k] || 0) + 1; return a; }, {}) };
  let colErr = null;
  try { if (updates.length) await write(('BEGIN;\n' + updates.join('\n') + '\nCOMMIT;').replace(/\bnow\(\)/g, TS)); } catch (e) { colErr = e; }
  if (!DRY && obsRows.length) {
    try {
      const res = await sqlOn(SB, `WITH ins AS (INSERT INTO ${OBS} (asin, retailer, domain, observed_at, run_id, collector, status, item_cents, msrp_cents, url, title, match_confidence, source) VALUES\n${obsRows.join(',\n')}\nRETURNING 1) SELECT count(*)::int AS n FROM ins;`);
      obs.written = Number((res[0] || {}).n || 0);
      if (obs.written !== obsRows.length) obs.error = `wrote ${obs.written} of ${obsRows.length}`;
    } catch (e) { obs.error = String(e.message || e).slice(0, 300); }
  }
  if (colErr) throw new Error(String(colErr.message || colErr) + ` (observations written: ${obs.written}${obs.error ? ', error: ' + obs.error : ''})`);

  const left = await sql(`SELECT count(*)::int n FROM command.fmic_retail_buybox_map r JOIN command.fmic_electric_catalog c USING (asin) WHERE ${QUEUE_WHERE}`);
  const remaining = Number((left[0]||{}).n || 0);
  const stats = { checked: out.length, matched: out.filter(o=>o.mf).length, no_results: out.filter(o=>o.status==='no_results').length, dropped: out.filter(o=>o.dropped_price!=null).length, fetch_failed: fetchFailed, blocked, retries_recovered: recovered, parse_failed: out.filter(o=>o.status==='parse_failed').length, off_topic: out.filter(o=>o.status==='off_topic').length, rescued: out.filter(o=>o.rescued).length, observations_written: obs.written, observations_error: obs.error, remaining, version: VERSION };
  await write(`INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('map_parity_musiciansfriend', ${remaining}, now(), '${esc(JSON.stringify(stats))}'::jsonb, now()) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at; SELECT 1 ok;`);

  // v17: success:false means Musician's Friend could not be read (blocked, or every read in a
  // batch of 3+ failed). One stubborn SKU left alone in the queue (14 Nov: 1 checked, 1 failed)
  // is reported in fetch_failed but is not a job failure; it is retried next run.
  const allFailed = fetchFailed > 0 && fetchFailed === out.length;
  const success = !(blocked > 0 && blocked === out.length) && !(allFailed && out.length >= 3);
  return { success, dryRun: DRY, ...stats, below_map: out.filter(o=>o.leak!=null && o.leak<0).length, results: out, dualWrite: dw };
}