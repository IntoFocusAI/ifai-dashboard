async function run(inputs) {
  const VERSION = 16;
  // v16 (R-10 step 2): every check also appends one row to command.retail_price_observations on
  // PROD only (the sandbox/mirror/claude copies don't have the table): priced / no_match /
  // check_failed, source retailer_checker. Written after, and apart from, the column write, so a
  // failure of either (or of a copy) never blocks the other. wmt_* and PR 244 streak columns as v15.
  // v16 false-miss fix (23 Nov 2026): a search with no Fender-family title (Fender, Squier, Gretsch,
  // Jackson, Charvel, EVH) is off_topic: stamp only, check_failed, streak unchanged. Before a 2nd miss
  // drops a stored price, the stored wmt_url is re-scraped; if the page is still the same Fender
  // product with a price (identity rules, see judge), the price is kept from it (priced, streak reset).
  const COLLECTOR = 'fender_retail_buybox_map_audit_v16';
  const RUN_ID = `fender_retail_buybox_map_audit:v16:${new Date().toISOString()}`;
  const OBS = 'command.retail_price_observations';
  const FENDER_FAMILY = /\b(fender|squier|squire|gretsch|jackson|charvel|evh)\b/i;
  const T0 = Date.now();
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const WRENCH = 'fender_retail_buybox_map_audit';
  const DRY = inputs.dryRun === true;
  const batchSize = Number(inputs.batchSize || 50);
  // v12: stop starting new Walmart searches after this many ms, write what is done, and
  // leave the rest of the batch for the next run (cursor advances only past processed rows).
  // v14: 180s. Budget is measured inside run(); Toolbelt adds ~27s of startup outside it,
  // one slow window can take ~50s (the search timeout below fires late, by up to ~10s),
  // and the write takes ~10s: 27 + 180 + 50 + 10 = ~267s, under a 300s task timeout.
  const budgetMs = Number(inputs.timeBudgetMs || 180000);
  const searchTimeoutMs = Number(inputs.searchTimeoutMs || 30000);
  const MAX_CONSEC_ERRORS = 3;
  // v15: a stored Walmart price is dropped after this many passes in a row whose search returned
  // results but no match (Brian Magazu, 18 Nov 2026). Empty and failed searches don't count.
  const DROP_AFTER_MISSES = 2;
  const explicitOffset = inputs.offset !== undefined && inputs.offset !== null ? Number(inputs.offset) : null;
  const asinList = Array.isArray(inputs.asins) && inputs.asins.length ? inputs.asins : null;
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
  const toSandbox = s => s;
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  async function write(q) {
    if (DRY) return [];
    q = q.replace(/\bnow\(\)/g, `'${new Date().toISOString()}'::timestamptz`);
    const res = await sqlOn(SB, q);
    await Promise.all(MIRRORS.map(async t => {
      try { await sqlOn(t.id, toSandbox(q)); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES ('${WRENCH}', '${t.name}', '${esc(String(e.message || e).slice(0, 2000))}', '${esc(q)}')`); } catch (_) {}
      }
    }));
    return res;
  }
  const withTimeout = (p, ms) => new Promise((resolve, reject) => {
    const h = setTimeout(() => reject(new Error('search_timeout_' + ms + 'ms')), ms);
    Promise.resolve(p).then(v => { clearTimeout(h); resolve(v); }, e => { clearTimeout(h); reject(e); });
  });

  const totalActive = Number(((await sql(`SELECT count(*)::int n FROM command.fmic_retail_buybox_map`))[0] || {}).n || 0);
  let offset = explicitOffset;
  if (offset === null && !asinList) {
    offset = Number(((await sql(`SELECT cursor_offset FROM command.fmic_job_state WHERE job_key='map_leakage_walmart'`))[0] || {}).cursor_offset || 0);
    if (offset >= totalActive) offset = 0;
  }
  if (offset === null) offset = 0;

  const COLS = `r.asin, COALESCE(c.title, r.model_name) title, c.color, c.model_number, COALESCE(c.is_bundle,false) is_bundle, r.offer_price, r.map_price, r.wmt_price AS stored_wmt, r.wmt_url AS stored_wmt_url, r.wmt_miss_streak AS miss_streak`;
  const skus = asinList
    ? await sql(`SELECT ${COLS} FROM command.fmic_retail_buybox_map r LEFT JOIN command.fmic_electric_catalog c ON c.asin = r.asin WHERE r.asin IN (${asinList.map(a => `'${esc(a)}'`).join(',')})`)
    : await sql(`SELECT ${COLS}
    FROM command.fmic_retail_buybox_map r LEFT JOIN command.fmic_electric_catalog c ON c.asin = r.asin
    ORDER BY r.asin LIMIT ${batchSize} OFFSET ${offset}`);
  console.log(`Walmart MAP check v${VERSION} offset=${offset} batch=${skus.length} total=${totalActive} budget=${budgetMs}ms`);

  const STOP = new Set(['fender', 'electric', 'guitar', 'with', 'the', 'and', 'series']);
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  const overlap = (a, b) => { const A = new Set(words(a)), B = new Set(words(b)); if (!A.size) return 0; let h = 0; for (const t of A) if (B.has(t)) h++; return h / A.size; };
  const isSquier = t => /squier|squire/i.test(t || '');
  const cleanTitle = t => String(t || '').replace(/\s+(bundle|w\/|with)\b.*$/i, '').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  // v15: bundles are searched too. Their query keeps the bundle wording ("... Pack with Amp"),
  // and only a Walmart bundle can match them (see the not_bundle check below).
  const bundleTitle = t => String(t || '').replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  const queryFor = s => s.is_bundle ? bundleTitle(s.title) : cleanTitle(s.title);

  const SHAPES = ['stratocaster','telecaster','jazzmaster','jaguar','mustang','precision','jazz','starcaster','duo','toronado','meteora','bronco','musicmaster','esquire','bass'];
  const LINES = ['sonic','affinity','classic','vibe','bullet','debut','mini','player','ii','professional','ultra','vintera','deluxe','modified','performer','elite','acoustasonic','custom','shop','american','paranormal','contemporary','limited','fsr','hss','hh','ht'];
  const COLORS = ['black','white','red','blue','green','yellow','orange','pink','purple','silver','gold','copper','sunburst','natural','olympic','arctic','lake','placid','california','candy','daphne','surf','seafoam','fiesta','shoreline','torino','charcoal','cherry','walnut','butterscotch','blonde','teal','gray','grey','tidepool','tobacco','midnight','mystic'];
  const tk = t => new Set(String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean));
  const pickL = (list, t) => { const s = tk(t); return list.filter(x => s.has(x)).sort().join('|'); };
  const BUNDLE_ADD = /\b(amp|amplifier|pack|kit|bundle)\b/i;
  const HAS_AMP = /\b(amp|amplifier|frontman|mustang lt|champion)\b/i;

  const out = [], updates = [];
  // Empty search or no title: touch wmt_checked_at only, never clear stored values, never write 0.
  const checkedOnly = asin => `UPDATE command.fmic_retail_buybox_map SET wmt_checked_at=now() WHERE asin='${esc(asin)}';`;
  // v15: results came back but none matched. Count the miss; on the 2nd in a row, drop the stored
  // Walmart price and its details and take WMT out of channels. The trigger recomputes wmt_leakage.
  const DROP = `wmt_miss_streak + 1 >= ${DROP_AFTER_MISSES}`;
  const missed = asin => `UPDATE command.fmic_retail_buybox_map SET wmt_checked_at=now(), wmt_miss_streak = wmt_miss_streak + 1,
    wmt_price = CASE WHEN ${DROP} THEN NULL ELSE wmt_price END, wmt_title = CASE WHEN ${DROP} THEN NULL ELSE wmt_title END,
    wmt_url = CASE WHEN ${DROP} THEN NULL ELSE wmt_url END, wmt_seller = CASE WHEN ${DROP} THEN NULL ELSE wmt_seller END,
    wmt_match_conf = CASE WHEN ${DROP} THEN NULL ELSE wmt_match_conf END,
    channels = CASE WHEN ${DROP} THEN NULLIF(array_to_string(array_remove(string_to_array(channels, ','), 'WMT'), ','), '') ELSE channels END,
    updated_at = CASE WHEN ${DROP} AND wmt_price IS NOT NULL THEN now() ELSE updated_at END
    WHERE asin='${esc(asin)}';`;

  // v16: re-read one stored Walmart product page. { item } when it loads, { err } otherwise.
  async function rescrape(url) {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const w = await withTimeout(callTool('E-Commerce', 'scrape_product', { marketplace: 'walmart', url, auto_database_threshold: 0 }), searchTimeoutMs);
        const obj = typeof w === 'string' ? JSON.parse(w) : w;
        const it = obj && Array.isArray(obj.results) ? obj.results[0] : null;
        if (it) return { item: it };
        last = 'no_product: ' + JSON.stringify(obj || '').slice(0, 160);
      } catch (e) { last = String(e.message || e).slice(0, 160); }
    }
    return { err: last };
  }

  // v13: concurrency (searches in parallel, results applied in row order). v14: default 3.
  const concurrency = Math.max(1, Math.min(5, Number(inputs.concurrency || 3)));
  async function doSearch(query) {
    const t = Date.now();
    try {
      const w = await withTimeout(callTool('E-Commerce', 'search_products', { query, maxItems: 10, marketplace: 'walmart' }), searchTimeoutMs);
      const arr = w && (w.results || w.items || w.products);
      // A provider error ("could not fetch the page (blocked or unavailable)") is a failed
      // read, not "no Walmart listing": do not stamp wmt_checked_at for it.
      if (!Array.isArray(arr)) {
        const txt = (typeof w === 'string' ? w : JSON.stringify(w || '')).slice(0, 300);
        if ((w && w.isError) || /could not fetch|blocked|unavailable|rate limit|error/i.test(txt)) throw new Error('provider: ' + txt);
      }
      return { items: arr || [], ms: Date.now() - t };
    } catch (e) { return { err: String(e.message || e).slice(0, 200), ms: Date.now() - t }; }
  }

  let processed = skus.length, stopReason = null, consecErr = 0, firstErrIdx = null, searches = 0, searchErrors = 0;
  const searchMs = [];
  let i = 0;
  outer: while (i < skus.length) {
    // v12 time budget: stop before starting searches we may not finish; rows i.. wait for the next run.
    if (Date.now() - T0 > budgetMs) { processed = i; stopReason = 'time_budget'; break; }
    // Window = rows i..j-1 containing up to `concurrency` searchable rows.
    let j = i, n = 0; const jobs = {};
    while (j < skus.length && n < concurrency) {
      const q = queryFor(skus[j]);
      if (q) { jobs[j] = doSearch(q); n++; searches++; }
      j++;
    }
    const res = {};
    for (const k of Object.keys(jobs)) res[k] = await jobs[k];
    for (let x = i; x < j; x++) {
      const s = skus[x];
      const amz = s.offer_price != null ? Number(s.offer_price) : null;
      const map = s.map_price != null ? Number(s.map_price) : null;
      const query = queryFor(s);
      if (!query) { updates.push(checkedOnly(s.asin)); out.push({ asin: s.asin, status: 'no_title', bundle: s.is_bundle }); continue; }
      const sr = res[x];
      searchMs.push(sr.ms);
      if (sr.err) {
        searchErrors++;
        out.push({ asin: s.asin, status: 'search_error', err: sr.err, ms: sr.ms, bundle: s.is_bundle });
        if (consecErr === 0) firstErrIdx = x;
        consecErr++;
        // Several failures in a row means Walmart/provider is blocking; stop and retry these rows next run.
        if (consecErr >= MAX_CONSEC_ERRORS) { processed = firstErrIdx; stopReason = 'provider_errors'; break outer; }
        continue;
      }
      consecErr = 0; firstErrIdx = null;
      const items = sr.items;
      // v15: an empty result is not evidence the listing is gone (Walmart search hiccup); stamp only.
      if (!items.length) { updates.push(checkedOnly(s.asin)); out.push({ asin: s.asin, status: 'no_results', q: query, ms: sr.ms, bundle: s.is_bundle }); continue; }
      // v16: results with no Fender-family title say nothing about this listing (Walmart search
      // sometimes returns unrelated products); treat like an empty search.
      if (!items.some(it => FENDER_FAMILY.test(String(it.title || '') + ' ' + String(it.brand || '')))) {
        updates.push(checkedOnly(s.asin));
        out.push({ asin: s.asin, status: 'off_topic', seen: items.length, q: query, ms: sr.ms, bundle: s.is_bundle, sample: items.slice(0, 3).map(it => String(it.title || '').slice(0, 60)) });
        continue;
      }
      const colorWords = words(s.color);
      const pn = (String(s.model_number || '').match(/\d{10}/) || [])[0] || null;
      const myShape = pickL(SHAPES, s.title), myLine = pickL(LINES, s.title), myColor = pickL(COLORS, s.title + ' ' + (s.color || ''));
      const amzIsBundle = s.is_bundle || (BUNDLE_ADD.test(String(s.title || '')) && /bundle|\bkit\b|\bpack\b/i.test(String(s.title || '')));

      // v16: the match rules as a function. Returns a reject reason or null. With stored = true it
      // checks the re-scraped stored page instead: that URL was matched to this listing before, so
      // only identity rules apply (Fender-family brand, used, bundle, Squier, shape, part number,
      // price band); line, color and title-overlap rules are skipped (they tripped on full page
      // titles vs. Walmart's cut search titles in testing).
      const judge = (it, stored = false) => {
        const price = Number(it.price);
        const t = it.title || '';
        if (!price || isNaN(price)) return 'noprice';
        if (stored && !FENDER_FAMILY.test(t + ' ' + String(it.brand || ''))) return 'not_fender';
        if (/used|refurb|pre-owned|case only|strings|pickguard/i.test(t)) return 'used';
        if (!amzIsBundle && BUNDLE_ADD.test(t)) return 'bundle_add';
        // v15: a bundle only matches a Walmart bundle, never the guitar sold alone.
        if (s.is_bundle && !BUNDLE_ADD.test(t)) return 'not_bundle';
        // v15: bundle contents must agree on the amp. In the 18 Nov dry run, 4 of 12 bundle matches
        // paired a gig-bag bundle with an amp bundle (or the reverse) from the same reseller.
        // Walmart titles come back cut at ~90 characters ("...Bundle with Frontm…"). A cut title
        // that is word-for-word the start of the Amazon title counts as agreeing.
        if (s.is_bundle && HAS_AMP.test(s.title) !== HAS_AMP.test(t)) {
          const head = t.replace(/…\s*$/, '').trim().toLowerCase();
          const cutPrefix = /…\s*$/.test(t) && String(s.title || '').toLowerCase().startsWith(head);
          if (!cutPrefix) return 'bundle_contents';
        }
        if (isSquier(s.title) !== isSquier(t)) return 'brand';
        if (pickL(SHAPES, t) !== myShape) return 'shape';
        const tpn0 = (t.match(/\b\d{10}\b/) || [])[0];
        if (pn && tpn0 && tpn0 !== pn) return 'pn';
        if (stored) { if (amz) { const ratio = price / amz; if (ratio < 0.6 || ratio > 1.6) return 'price'; } return null; }
        const wl = pickL(LINES, t);
        if ((myLine || wl) && wl !== myLine) return 'line';
        const wc = pickL(COLORS, t);
        if (myColor && wc && wc !== myColor) return 'color_mismatch';
        const tw = new Set(words(t));
        if (colorWords.length && !colorWords.every(c => tw.has(c))) return 'color_tokens';
        const tpn = (t.match(/\b\d{10}\b/) || [])[0];
        if (pn && tpn && tpn !== pn) return 'pn';
        if (amz) { const ratio = price / amz; if (ratio < 0.6 || ratio > 1.6) return 'price'; }
        if (overlap(query, t) < 0.5) return 'overlap';
        return null;
      };
      let best = null, bo = 0; const rej = {};
      const r = k => { rej[k] = (rej[k] || 0) + 1; };
      for (const it of items) {
        const why = judge(it);
        if (why) { r(why); continue; }
        const o = overlap(query, it.title || '');
        if (o > bo) { bo = o; best = it; }
      }
      // v16: before a 2nd miss drops the stored price, re-read the stored Walmart page.
      let rescue = null, rescued = false;
      if (!best && Number(s.miss_streak || 0) + 1 >= DROP_AFTER_MISSES && s.stored_wmt != null && s.stored_wmt_url) {
        rescue = await rescrape(s.stored_wmt_url);
        if (rescue.item) {
          const why = judge(rescue.item, true);
          if (!why) { best = { ...rescue.item, url: s.stored_wmt_url }; bo = Math.min(1, overlap(query, best.title || '')); rescued = true; rescue = undefined; }
          else rescue = { rejected: why, title: String(rescue.item.title || '').slice(0, 120), price: Number(rescue.item.price) || null };
        }
      }

      if (best) {
        const price = Number(best.price);
        const leak = map != null ? +(price - map).toFixed(2) : null;
        updates.push(`UPDATE command.fmic_retail_buybox_map SET wmt_price=${price}, wmt_title='${esc(String(best.title).slice(0, 300))}', wmt_url='${esc(best.url)}', wmt_seller='${esc(best.seller)}', wmt_leakage=${leak == null ? 'NULL' : leak}, wmt_match_conf=${+bo.toFixed(2)}, wmt_checked_at=now(), wmt_last_matched_at=now(), wmt_miss_streak=0, channels = CASE WHEN channels IS NULL THEN 'WMT' WHEN channels NOT LIKE '%WMT%' THEN channels||',WMT' ELSE channels END, updated_at=now() WHERE asin='${esc(s.asin)}';`);
        out.push({ asin: s.asin, wmt: price, amz, map, leak, conf: +bo.toFixed(2), seller: best.seller, t: best.title, url: best.url, rescued: rescued || undefined, ms: sr.ms, bundle: s.is_bundle });
      } else {
        updates.push(missed(s.asin));
        const streak = Number(s.miss_streak || 0) + 1;
        const dropped = streak >= DROP_AFTER_MISSES && s.stored_wmt != null;
        out.push({ asin: s.asin, status: 'no_match', rescue: rescue || undefined, seen: items.length, rejected: rej, q: query, ms: sr.ms, bundle: s.is_bundle, miss_streak: streak, dropped_price: dropped ? Number(s.stored_wmt) : undefined });
      }
    }
    i = j;
  }
  const sortedMs = searchMs.slice().sort((a, b) => a - b);
  const searchStats = sortedMs.length ? { n: sortedMs.length, median_ms: sortedMs[Math.floor(sortedMs.length / 2)], max_ms: sortedMs[sortedMs.length - 1] } : { n: 0 };

  // Cursor moves only past rows actually processed. Rows after a stop are retried next run.
  const next = offset + processed >= totalActive ? 0 : offset + processed;
  const matched = out.filter(o => o.wmt).length;
  const droppedN = out.filter(o => o.dropped_price != null).length;
  if (explicitOffset === null && !asinList) updates.push(`UPDATE command.fmic_job_state SET cursor_offset=${next}, last_run_at=now(), updated_at=now(), extra = COALESCE(extra,'{}'::jsonb) || jsonb_build_object('last_batch', ${processed}, 'last_matched', ${matched}, 'last_dropped', ${droppedN}, 'last_stop_reason', ${stopReason ? `'${stopReason}'` : 'NULL'}, 'last_deferred', ${skus.length - processed}, 'last_search_errors', ${searchErrors}, 'version', ${VERSION}, 'last_search_median_ms', ${searchStats.median_ms || 0}) WHERE job_key='map_leakage_walmart';`);
  // v16 (R-10 step 2): one observation per check, PROD only. A match -> priced; Fender-family
  // results but no match -> no_match; search error, empty or off-topic search, no title -> check_failed.
  const TS = `'${new Date().toISOString()}'::timestamptz`;
  const obsStatus = o => o.wmt ? 'priced' : o.status === 'no_match' ? 'no_match' : 'check_failed';
  const q2 = v => v == null ? 'NULL' : `'${esc(v)}'`;
  const obsRows = out.map(o => {
    const st = obsStatus(o), p = st === 'priced';
    return `('${esc(o.asin)}', 'walmart', 'walmart.com', ${TS}, ${q2(RUN_ID)}, ${q2(COLLECTOR)}, '${st}', ${p ? Math.round(Number(o.wmt) * 100) : 'NULL'}, ${p ? q2(o.url) : 'NULL'}, ${p ? q2(String(o.t || '').slice(0, 300)) : 'NULL'}, ${p ? q2(o.seller) : 'NULL'}, ${p && o.conf != null ? Math.max(0, Math.min(1, Number(o.conf))) : 'NULL'}, 'retailer_checker')`;
  });
  const obsPlanned = out.reduce((a, o) => { const k = obsStatus(o); a[k] = (a[k] || 0) + 1; return a; }, {});
  const obs = { written: 0, error: null, planned: obsPlanned };
  let colErr = null;
  try { if (updates.length) await write(('BEGIN;\n' + updates.join('\n') + '\nCOMMIT;').replace(/\bnow\(\)/g, TS)); } catch (e) { colErr = e; }
  if (!DRY && obsRows.length) {
    try {
      const res = await sqlOn(SB, `WITH ins AS (INSERT INTO ${OBS} (asin, retailer, domain, observed_at, run_id, collector, status, item_cents, url, title, seller, match_confidence, source) VALUES\n${obsRows.join(',\n')}\nRETURNING 1) SELECT count(*)::int AS n FROM ins;`);
      obs.written = Number((res[0] || {}).n || 0);
      if (obs.written !== obsRows.length) obs.error = `wrote ${obs.written} of ${obsRows.length}`;
    } catch (e) { obs.error = String(e.message || e).slice(0, 300); }
  }
  if (colErr) throw new Error(String(colErr.message || colErr) + ` (observations written: ${obs.written}${obs.error ? ', error: ' + obs.error : ''})`);

  return { success: true, observations: obs, off_topic: out.filter(o => o.status === 'off_topic').length, rescued: out.filter(o => o.rescued).length, version: VERSION, dryRun: DRY, offset, next_offset: next, totalActive, batch: skus.length, processed, deferred: skus.length - processed, stopped_early: !!stopReason, stop_reason: stopReason, searches, search_errors: searchErrors, concurrency, search_ms: searchStats, elapsed_ms: Date.now() - T0, checked: out.filter(o => o.status !== 'search_error').length, matched, unmatched: out.filter(o => o.status === 'no_match').length, no_results: out.filter(o => o.status === 'no_results').length, dropped: droppedN, bundles_searched: out.filter(o => o.bundle && o.status !== 'search_error').length, bundles_matched: out.filter(o => o.bundle && o.wmt).length, below_map: out.filter(o => o.leak != null && o.leak < 0).length, results: out, dualWrite: dw };
}