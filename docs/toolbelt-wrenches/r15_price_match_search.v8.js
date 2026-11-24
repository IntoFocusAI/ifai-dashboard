// Rollback copy: r15_price_match_search as it ran before the condition check (Fender workspace
// 558a63f3 v8 = Ledlenser workspace 1a08597d v2, same code). Saved 23 Nov 2026. To roll back, re-save
// this as a new version in each workspace (wrench_update, scriptContent = this file without this header).
async function run(inputs) {
  // R-15 price matches (docs/r15-price-match-plan.md, approved 23 Nov 2026 with changes).
  // For each withheld Amazon listing with a benchmark (competitive_price_threshold_cents), search Bing
  // Shopping by title, keep new-condition offers from sellers other than Amazon priced at exactly the
  // benchmark (landed: item + known shipping; or item price), resolve each offer's store page, run the
  // same-product check, and write: one price_match_checks row per search, one retail_price_observations
  // row (source price_search) plus one price_match_results row per kept match. "Different" is dropped.
  // Schedule: a daily workflow run with mode auto searches only listings never searched, whose
  // benchmark changed since the last search, or last searched >= weeklyDays ago. That is the spend cap.
  const CLIENT = inputs.client === 'ledlenser' ? 'ledlenser' : 'fender';
  const DRY = inputs.dryRun === true;
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COLLECTOR = 'r15_price_search_v1';
  const PROVIDER = 'bing_shopping';
  const RUN = 'r15-' + CLIENT + '-' + new Date().toISOString();
  const maxListings = Math.max(1, Math.min(30, Number(inputs.maxListings || 12)));
  const weeklyDays = Math.max(1, Number(inputs.weeklyDays || 7));
  const MAX_RESOLVE = Math.max(1, Math.min(10, Number(inputs.maxResolvePerListing || 6)));
  const T = CLIENT === 'ledlenser'
    ? { listings: 'ledlenser.canvas_retail_listings', catalog: 'ledlenser.catalog', checksView: 'ledlenser.canvas_price_match_checks',
        retailers: 'ledlenser.retailers', checks: 'ledlenser_private.price_match_checks', results: 'ledlenser_private.price_match_results',
        obs: 'ledlenser_private.retail_price_observations' }
    : { listings: 'public.canvas_retail_listings', catalog: 'command.fmic_electric_catalog', checksView: 'public.canvas_price_match_checks',
        retailers: 'command.retailers', checks: 'command.price_match_checks', results: 'command.price_match_results',
        obs: 'command.retail_price_observations' };
  const sq = s => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
  const num = n => (n == null || !Number.isFinite(Number(n))) ? 'null' : String(Math.round(Number(n)));

  async function sql(q) {
    const r = await callTool(SB, 'execute_sql', { query: q });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }

  // ---------- which listings ----------
  const base = `SELECT l.asin::text AS asin, coalesce(l.title, l.model_name) AS title, l.competitive_price_threshold_cents::int AS bm,
      (SELECT c.upc::text FROM ${T.catalog} c WHERE c.asin::text = l.asin::text AND c.upc IS NOT NULL LIMIT 1) AS upc,
      p.searched_at AS last_searched, p.search_benchmark_cents AS last_bm
    FROM ${T.listings} l LEFT JOIN ${T.checksView} p ON p.asin::text = l.asin::text
    WHERE l.featured_offer_state = 'withheld' AND l.competitive_external_price_state = 'present'
      AND l.competitive_price_threshold_cents > 0`;
  let rows;
  if (Array.isArray(inputs.asins) && inputs.asins.length) {
    rows = await sql(`${base} AND l.asin IN (${inputs.asins.map(sq).join(',')}) ORDER BY l.asin`);
  } else {
    rows = await sql(`${base} AND (p.searched_at IS NULL OR p.search_benchmark_cents IS DISTINCT FROM l.competitive_price_threshold_cents
        OR p.searched_at < now() - interval '${weeklyDays} days')
      ORDER BY (p.searched_at IS NULL OR p.search_benchmark_cents IS DISTINCT FROM l.competitive_price_threshold_cents) DESC,
        p.searched_at ASC NULLS FIRST, l.asin LIMIT ${maxListings}`);
  }
  if (!rows.length) return { success: true, client: CLIENT, searched: 0, note: 'nothing due' };
  const retailers = await sql(`SELECT slug, domains FROM ${T.retailers}`);

  // ---------- helpers ----------
  const cents = s => { const m = String(s || '').replace(/,/g, '').match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/); return m ? Math.round(parseFloat(m[1]) * 100) : null; };
  const USED = /\b(used|refurb(ished)?|renewed|pre-?owned|b-?stock|blemish(ed)?|open[- ]box|scratch(ed)?|dent(ed)?|demo|second[- ]hand|mint|excellent condition|very good condition|good condition)\b/i;
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  // A title with a model code near the start (Ledlenser "H7R", "T2") searches brand + code + two words;
  // other titles (Fender) search their first 12 words, keeping finish and fingerboard.
  function queryOf(title) {
    const ws = String(title || '').replace(/[®™“”"(),]/g, ' ').replace(/\s+-\s+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    const at = ws.findIndex(w => /^[A-Z]{1,4}\d{1,3}[A-Z]{0,3}$/.test(w) && !/^(USB|IP\d+|AAA?|LED)$/.test(w));
    if (at >= 0 && at < 4) return ws.slice(0, at + 3).join(' ');
    return ws.slice(0, 12).join(' ');
  }
  // The wrench sandbox has no URL class, so links are parsed with regular expressions.
  function hostOf(u) { const m = String(u || '').match(/^https?:\/\/([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : null; }
  function param(u, name) {
    const m = String(u || '').match(new RegExp('[?&]' + name + '=([^&#]*)'));
    if (!m) return null;
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; }
  }
  function retailerFor(host) {
    if (!host) return null;
    const r = retailers.find(x => (x.domains || []).some(d => host === d || host.endsWith('.' + d)));
    return r ? r.slug : null;
  }
  function b64url(s) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    let out = '', buf = 0, bits = 0;
    for (const ch of s) { const v = A.indexOf(ch); if (v < 0) continue; buf = (buf << 6) | v; bits += 6; if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 255); } }
    try { return decodeURIComponent(escape(out)); } catch (e) { return out; }
  }
  // Bing "Visit site" links: bing.com/ck/a?...&u=a1<base64url of https://bing.com/alink/link?url=<store url>&...>
  function storeUrl(href) {
    if (!href) return null;
    const host = hostOf(href);
    if (!host) return null;
    if (!/(^|\.)bing\.com$/.test(host)) return href;
    let inner = param(href, 'u');
    if (inner && inner.startsWith('a1')) inner = b64url(inner.slice(2));
    if (!inner) return null;
    if (/(^|\.)bing\.com$/.test(hostOf(inner) || '')) inner = param(inner, 'url');
    if (!inner || !/^https?:\/\//i.test(inner)) return null;
    // Price-comparison redirects (e.g. delupe.com/redirect?uri=<store>) carry the store page in a parameter.
    const wrapped = param(inner, 'uri') || param(inner, 'url') || param(inner, 'u');
    return wrapped && /^https?:\/\//i.test(wrapped) ? wrapped : inner;
  }
  // Drops tracking and affiliate parameters so the stored link is the plain store page.
  function cleanUrl(u) {
    if (!u) return u;
    const [head, hash] = String(u).split('#');
    const q = head.indexOf('?');
    if (q < 0) return head;
    const keep = head.slice(q + 1).split('&').filter(kv => kv && !/^(utm_[a-z]+|affiliates?_[a-z_]*|campaign_id|clickid|irgwc|sharedid|sourceid|veh|wmlspartner|subid\d*|msclkid|gclid|fbclid|template|country|currency|source|ref|rfsn|srsltid|cmpid|clickref|aff[a-z_]*|cid|mkwid|ranmid|raneaid|ransiteid)=/i.test(kv));
    return head.slice(0, q) + (keep.length ? '?' + keep.join('&') : '');
  }
  function extractEval(text) {
    const i = text.indexOf('eval returned');
    if (i < 0) return null;
    let rest = text.slice(text.indexOf('\n', i) + 1).trim();
    if (rest.startsWith('"')) { try { rest = JSON.parse(rest.slice(0, rest.lastIndexOf('"') + 1)); } catch (e) { } }
    const s = rest.indexOf('{'); if (s < 0) return null;
    let d = 0, e = -1, inS = false, esc = false;
    for (let k = s; k < rest.length; k++) { const c = rest[k]; if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; } if (c === '"') inS = true; else if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { e = k; break; } } }
    if (e < 0) return null;
    try { return JSON.parse(rest.slice(s, e + 1)); } catch (x) { return null; }
  }
  let lastRaw = '';
  async function browse(session, url, expr, waitMs) {
    const r = await callTool('browser', 'browser_interact', { session, url, steps: [{ wait: { ms: waitMs || 1500 } }, { eval: { expression: expr } }] });
    lastRaw = (r && r.text) || (typeof r === 'string' ? r : JSON.stringify(r || ''));
    return extractEval(lastRaw);
  }
  // Runs in the page. Returns the card count and only the cards whose shown price contains the benchmark,
  // so the result stays under the browser tool's 20,000-character limit.
  const searchEval = price => "(()=>{const want=" + JSON.stringify(price) + ";const lis=[...document.querySelectorAll('li.br-item')];return JSON.stringify({blocked:/unusual traffic|captcha|not a robot|verify you are human/i.test((document.body&&document.body.innerText||'').slice(0,600)),total:lis.length,cards:lis.filter(li=>{const p=li.querySelector('.pd-price');return p&&p.innerText.replace(/[\\s,$]/g,'')===want}).slice(0,15).map(li=>{const t=li.querySelector('.br-title [title]');const p=li.querySelector('.pd-price');const s=li.querySelector('.br-seller');return {title:(t&&t.getAttribute('title'))||((li.querySelector('.br-title')||{}).innerText||'').trim()||null,price:p?p.innerText:null,seller:s?s.innerText.trim():null,text:(li.innerText||'').replace(/\\s+/g,' ').slice(0,200),dataUrl:(li.getAttribute('data-url')||'').split('&originIGUID')[0]}})})})()";
  const VISIT_EVAL = "JSON.stringify({links:[...document.querySelectorAll('a')].filter(a=>/visit site/i.test(a.innerText||'')).slice(0,40).map(a=>{let n=a;for(let i=0;i<5&&n.parentElement;i++)n=n.parentElement;return {href:a.href,ctx:(n.innerText||'').replace(/\\s+/g,' ').slice(0,300)}})})";

  // ---------- same-product check ----------
  const SHAPES = ['stratocaster', 'telecaster', 'jazzmaster', 'jaguar', 'mustang', 'precision', 'jazz bass', 'starcaster', 'esquire', 'bronco', 'meteora', 'toronado', 'duo-sonic', 'headlamp', 'flashlight', 'lantern', 'work light'];
  const LINES = ['player ii', 'player plus', 'player', 'american professional ii', 'american professional classic', 'american professional', 'american ultra ii', 'american ultra', 'american vintage ii', 'american performer', 'vintera ii', 'vintera', 'affinity', 'classic vibe', 'sonic', 'paranormal', 'custom shop', 'made in japan', 'hybrid ii', 'player ii modified'];
  const COLORS = ['black', 'white', 'blonde', 'blond', 'sunburst', 'natural', 'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple', 'silver', 'gold', 'gray', 'grey', 'brown', 'cherry', 'charcoal', 'surf', 'sonic', 'olympic', 'miami', 'dakota', 'candy', 'coral', 'aquatone', 'birch', 'lavender', 'butterscotch', 'mocha', 'walnut', 'sienna', 'tobacco', 'shell', 'fiesta', 'inca', 'lake placid', 'firemist', 'mystic', 'dark night', 'transparent', 'aged', 'rallye', 'racing', 'antigua', 'graffiti', 'luna', 'coma', 'wine', 'solar flare', 'teal', 'seafoam', 'sea foam'];
  const BOARDS = ['rosewood', 'maple', 'laurel', 'ebony', 'pau ferro'];
  const has = (t, p) => new RegExp('(^|[^a-z0-9])' + p.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/ /g, '[\\s-]*') + '($|[^a-z0-9])', 'i').test(t);
  const pick = (list, t) => list.filter(p => has(t, p));
  const longest = (list, t) => { const f = pick(list, t).sort((a, b) => b.length - a.length); return f[0] || null; };
  const pickups = t => (t.match(/\b(hss|hsh|hh|sss|ss|sh|hs|p90)\b/gi) || []).map(x => x.toLowerCase()).sort().join(',');
  const lefty = t => /\b(left[- ]hand(ed)?|lefty|lh)\b/i.test(t);
  const bundle = t => /\b(bundle|kit|w\/|with (gig bag|case|strap|amp)|pack\b)/i.test(t);
  const codes = t => (String(t).match(/\b[A-Z]{1,4}\d{1,3}[A-Z]{0,3}\b/g) || []).filter(c => !/^(USB|IP\d+|AAA?|LED|HSS|SSS|HH|II)$/.test(c));
  const digits = t => (String(t).match(/\b\d{12,13}\b/g) || []);
  function ruleCheck(amazon, offer, upc) {
    const a = amazon.toLowerCase(), o = offer.toLowerCase();
    if (upc) {
      const u = String(upc).replace(/\D/g, '').replace(/^0+/, '');
      const ds = digits(offer).map(d => d.replace(/^0+/, ''));
      if (ds.includes(u)) return { verdict: 'same', reason: 'The offer names this listing\'s UPC.', by: 'upc' };
      if (ds.length) return { verdict: 'different', reason: 'The offer names another UPC.', by: 'rules' };
    }
    const conflicts = [], missing = [];
    const sa = pick(SHAPES, a), so = pick(SHAPES, o);
    if (sa.length && so.length && sa.sort().join() !== so.sort().join()) conflicts.push('model (' + so.join('/') + ')');
    if (sa.length && !so.length) missing.push('model');
    const la = longest(LINES, a), lo = longest(LINES, o);
    if (la && lo && la !== lo) conflicts.push('series (' + lo + ')');
    if (la && !lo) missing.push('series');
    const ca = codes(amazon), co = codes(offer);
    if (ca.length && co.length && !ca.some(c => co.includes(c))) conflicts.push('model code (' + co.join('/') + ')');
    if (ca.length && !co.length) missing.push('model code');
    const fa = pick(COLORS, a), fo = pick(COLORS, o);
    const extra = fo.filter(c => !fa.includes(c)), lack = fa.filter(c => !fo.includes(c));
    if (fa.length && fo.length && (extra.length || lack.length)) conflicts.push('finish (' + fo.join(' ') + ')');
    if (fa.length && !fo.length) missing.push('finish');
    const ba = pick(BOARDS, a), bo = pick(BOARDS, o);
    if (ba.length && bo.length && ba.sort().join() !== bo.sort().join()) conflicts.push('fingerboard (' + bo.join('/') + ')');
    if (ba.length && !bo.length) missing.push('fingerboard');
    const pa = pickups(a), po = pickups(o);
    if (pa !== po && (pa || po)) { if (pa && po) conflicts.push('pickups (' + po + ')'); else if (po) conflicts.push('pickups (' + po + ')'); else missing.push('pickups'); }
    if (lefty(a) !== lefty(o)) conflicts.push(lefty(o) ? 'left-handed' : 'right-handed');
    if (bundle(a) !== bundle(o)) conflicts.push(bundle(o) ? 'a bundle' : 'the item without the bundle');
    if (conflicts.length) return { verdict: 'different', reason: 'The offer differs in ' + conflicts.join(', ') + '.', by: 'rules' };
    if (missing.length) return { verdict: 'unsure', reason: 'The offer title does not name the ' + missing.join(', ') + '.', by: 'rules' };
    return { verdict: 'same', reason: 'Model, series, finish and configuration agree.', by: 'rules' };
  }
  const Q = { verdict: { type: 'choice', instructions: 'Is the offer the same product as the Amazon listing? Compare model, finish/color, fingerboard, pickup layout, handedness, and bundle versus the item alone.', criteria: { same: 'Same model and configuration; nothing conflicts.', different: 'A detail conflicts: another model, finish, fingerboard, pickup layout, handedness, or bundle versus the item alone.', unsure: 'The titles leave out details needed to tell.' } } };

  // ---------- per listing ----------
  const results = [];
  let blockedCount = 0;
  for (const row of rows) {
    // A fresh session per run: Toolbelt keeps browser sessions across executions and reuses a live tab without reloading.
    const session = 'r15_' + row.asin + '_' + Date.now().toString(36);
    const query = queryOf(row.title);
    const bm = Number(row.bm);
    const entry = { asin: row.asin, bm, query, offers: 0, exact: 0, kept: [], dropped: [], unlinked: 0, status: 'searched' };
    try {
      const page = await browse(session, 'https://www.bing.com/shop?q=' + encodeURIComponent(query) + '&cc=us', searchEval((bm / 100).toFixed(2)), 1500);
      if (!page || page.blocked || !Array.isArray(page.cards)) throw new Error(page && page.blocked ? 'Bing returned a bot check' : 'the results page did not read: ' + lastRaw.slice(0, 200));
      if (!page.total) throw new Error('no result cards');
      // A card with no title keeps its place: the same-product check then calls it unsure.
      const offers = page.cards.filter(c => c.price).map(c => {
        const item = cents(c.price);
        const free = /free shipping|free delivery/i.test(c.text || '');
        return { title: c.title || '(no title on the search result)', seller: c.seller || '', item, shipping: free ? 0 : null, used: USED.test(c.title + ' ' + (c.text || '')), dataUrl: c.dataUrl };
      });
      entry.offers = Number(page.total) || 0;
      const seen = new Set();
      const exact = [];
      for (const o of offers) {
        if (o.used || /amazon/i.test(o.seller) || o.item == null) continue;
        const kind = (o.shipping != null && o.item + o.shipping === bm) ? 'landed' : (o.item === bm ? 'item' : null);
        if (!kind) continue;
        const key = (o.seller + '|' + o.title).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        exact.push({ ...o, kind });
      }
      entry.exact = exact.length;
      const checked = exact.map(o => ({ o, rule: ruleCheck(row.title, o.title, row.upc) }));
      // Second opinion from the classifier only where the rules are unsure.
      const unsure = checked.filter(c => c.rule.verdict === 'unsure');
      if (unsure.length) {
        try {
          const ans = await classifyMany(unsure.map(c => ({ amazon_title: row.title, offer_title: c.o.title, offer_seller: c.o.seller })), Q);
          unsure.forEach((c, i) => {
            const f = ans && ans[i] && ans[i].fields;
            if (f && f.verdict === 'different' && Number(f.verdict_confidence) >= 0.5) c.rule = { verdict: 'different', reason: c.rule.reason + ' The model check reads it as a different product.', by: 'rules+classifier' };
            else if (f) c.rule = { ...c.rule, by: 'rules+classifier', conf: Number(f.verdict_confidence) };
          });
        } catch (e) { /* keep the rules' answer */ }
      }
      let resolved = 0;
      for (const c of checked) {
        if (c.rule.verdict === 'different') { entry.dropped.push({ seller: c.o.seller, title: c.o.title, reason: c.rule.reason }); continue; }
        let url = null;
        if (c.o.dataUrl && resolved < MAX_RESOLVE) {
          resolved++;
          try {
            const v = await browse(session, 'https://www.bing.com' + c.o.dataUrl, VISIT_EVAL, 1200);
            const links = (v && v.links) || [];
            const price = '$' + (c.o.item / 100).toFixed(2);
            const sellerWord = words(c.o.seller)[0] || '';
            const best = links.find(l => l.ctx.toLowerCase().includes(sellerWord) && l.ctx.replace(/\s/g, '').includes(price.replace(/\s/g, ''))) || links.find(l => l.ctx.toLowerCase().includes(sellerWord)) || links[0];
            url = best ? cleanUrl(storeUrl(best.href)) : null;
          } catch (e) { url = null; }
        }
        // Bing cuts long titles; the store page's address often names the finish, so check again with it.
        if (url) {
          const slug = String(url).replace(/^https?:\/\/[^\/]+/, '').split('?')[0].replace(/[^A-Za-z0-9]+/g, ' ');
          const again = ruleCheck(row.title, c.o.title.replace(/\.\.\.$|…$/, '') + ' ' + slug, null); // no UPC test: store SKUs in addresses look like UPCs
          if (again.verdict === 'different') { entry.dropped.push({ seller: c.o.seller, title: c.o.title, reason: again.reason + ' (from the store page address)' }); continue; }
          if (again.verdict === 'same' && c.rule.verdict === 'unsure') c.rule = { ...again, by: 'rules' };
        }
        let host = hostOf(url);
        if (!host && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(c.o.seller.trim())) host = c.o.seller.trim().toLowerCase().replace(/^www\./, '');
        // A link that leads back to an Amazon listing (an ASIN in the path) is Amazon, not an outside price.
        if (!host || /(^|\.)amazon\./.test(host) || /\/(dp|p|gp\/product)\/B0[A-Z0-9]{8}\b/.test(url || '')) { entry.unlinked++; continue; }
        entry.kept.push({ seller: c.o.seller, title: c.o.title, item: c.o.item, shipping: c.o.shipping, kind: c.o.kind, url, domain: host, retailer: retailerFor(host), verdict: c.rule.verdict, reason: c.rule.reason, by: c.rule.by, conf: c.rule.conf });
      }
    } catch (e) {
      entry.status = 'failed';
      entry.error = String(e.message || e).slice(0, 300);
      if (/bot check/.test(entry.error)) blockedCount++;
    }
    try { await callTool('browser', 'browser_interact', { session, closeSession: true, steps: [] }); } catch (_) { }

    // ---------- write ----------
    if (!DRY) {
      const parts = [`c AS (INSERT INTO ${T.checks} (asin, run_id, collector, benchmark_cents, provider, query_type, query, status, result_count, exact_count, kept_count, different_count, error)
        VALUES (${sq(row.asin)}, ${sq(RUN)}, ${sq(COLLECTOR)}, ${num(bm)}, ${sq(PROVIDER)}, 'title', ${sq(query)}, ${sq(entry.status)},
        ${entry.status === 'searched' ? num(entry.offers) : 'null'}, ${entry.status === 'searched' ? num(entry.exact) : 'null'},
        ${entry.status === 'searched' ? num(entry.kept.length) : 'null'}, ${entry.status === 'searched' ? num(entry.dropped.length) : 'null'}, ${sq(entry.error || null)}) RETURNING id)`];
      entry.kept.forEach((k, i) => {
        parts.push(`o${i} AS (INSERT INTO ${T.obs} (asin, retailer, domain, observed_at, run_id, collector, status, item_cents, shipping_cents, url, title, seller, condition, match_confidence, source)
          VALUES (${sq(row.asin)}, ${sq(k.retailer)}, ${sq(k.domain)}, now(), ${sq(RUN)}, ${sq(COLLECTOR)}, 'priced', ${num(k.item)}, ${k.shipping == null ? 'null' : num(k.shipping)},
          ${sq(k.url)}, ${sq(String(k.title).slice(0, 500))}, ${sq(String(k.seller).slice(0, 200))}, 'new', ${k.conf == null ? 'null' : Number(k.conf).toFixed(3)}, 'price_search') RETURNING id)`);
        parts.push(`r${i} AS (INSERT INTO ${T.results} (check_id, observation_id, match_kind, verdict, verdict_reason, verdict_by, confidence)
          SELECT c.id, o${i}.id, ${sq(k.kind)}, ${sq(k.verdict)}, ${sq(k.reason)}, ${sq(k.by)}, ${k.conf == null ? 'null' : Number(k.conf).toFixed(3)} FROM c, o${i} RETURNING 1)`);
      });
      const tail = entry.kept.map((_, i) => `(SELECT count(*) FROM r${i})`).join(' + ') || '0';
      try {
        const w = await sql(`WITH ${parts.join(',\n')} SELECT (SELECT id FROM c) AS check_id, ${tail} AS kept;`);
        entry.checkId = w[0] && w[0].check_id;
      } catch (e) { entry.writeError = String(e.message || e).slice(0, 300); }
    }
    results.push(entry);
    if (blockedCount >= 3) break; // Bing is refusing the run; stop spending.
  }
  const summary = {
    searched: results.filter(r => r.status === 'searched').length,
    failed: results.filter(r => r.status === 'failed').length,
    withSameMatch: results.filter(r => r.kept.some(k => k.verdict === 'same')).length,
    withUnsureOnly: results.filter(r => r.kept.length && !r.kept.some(k => k.verdict === 'same')).length,
    writeErrors: results.filter(r => r.writeError).length,
  };
  return { success: summary.writeErrors === 0, client: CLIENT, dryRun: DRY, run: RUN, collector: COLLECTOR, ...summary, results };
}
