async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COLLECTOR = 'ledlenser_spec_v1';
  const JOB = 'spec_readiness';
  const SITE = 'https://www.ledlenserusa.com';
  const started = Date.now();
  const batchSize = Math.max(1, Math.min(40, Number(inputs.batchSize || 20)));
  const concurrency = Math.max(1, Math.min(5, Number(inputs.concurrency || 3)));
  const budgetMs = Math.max(30, Number(inputs.timeBudgetSec || 240)) * 1000;
  const asinList = Array.isArray(inputs.asins) && inputs.asins.length ? inputs.asins : null;
  const log = [];

  // Amazon fields a shopper or an AI answer needs for a light. Each name lists the product_details keys that satisfy it.
  const AMAZON_FIELDS = {
    light_output_maximum: ['light_output_maximum', 'white_brightness', 'brightness', 'maximum_light_output'],
    beam_distance: ['beam_distance', 'maximum_beam_distance', 'light_beam_distance', 'maximum_range', 'effective_range', 'beam_range'],
    runtime: ['runtime', 'run_time', 'battery_life', 'maximum_runtime'],
    water_resistance_level: ['water_resistance_level', 'ip_rating', 'ingress_protection_rating', 'water_resistance_depth'],
    battery_type: ['battery_type', 'battery_cell_composition'],
    power_source: ['power_source'],
    light_source_type: ['light_source_type'],
    item_weight: ['item_weight'],
    item_dimensions: ['item_dimensions', 'item_dimensions_d_x_w_x_h', 'item_dimensions_l_x_w_x_h', 'product_dimensions', 'item_package_dimensions_l_x_w_x_h'],
    material_type: ['material_type', 'material'],
    color: ['color'],
    upc: ['upc', 'global_trade_identification_number'],
    manufacturer_part_number: ['manufacturer_part_number', 'part_number'],
  };
  const AMAZON_EXPECTED = Object.keys(AMAZON_FIELDS);
  const SITE_EXPECTED = ['name', 'sku', 'brand', 'gtin12', 'description', 'image', 'offers_price', 'additionalProperty'];

  async function sbq(query) {
    const r = await callTool(SB, 'execute_sql', { query });
    const txt = typeof r === 'string' ? r : (r && typeof r.result === 'string' ? r.result : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (!m) throw new Error('Supabase error: ' + txt.slice(0, 500));
    return JSON.parse(m[1]);
  }
  const esc = s => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
  const num = n => (n === null || n === undefined || isNaN(Number(n))) ? 'NULL' : Number(n);
  const nbool = b => b === null || b === undefined ? 'NULL' : (b ? 'TRUE' : 'FALSE');
  const jsonb = v => v == null ? 'NULL' : `${esc(JSON.stringify(v))}::jsonb`;
  const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  const norm = s => String(s || '').replace(/[^0-9A-Za-z]/g, '').replace(/^0+/, '').toLowerCase();

  // Population: genuine Ledlenser listings with a known Buy Box seller.
  const COLS = `c.asin, c.title, c.category, c.color, c.model_number, c.upc, c.brand_sku, b.upc AS sheet_upc, b.gtin AS sheet_gtin, b.label AS sheet_label`;
  const FROM = `FROM ledlenser.catalog c LEFT JOIN ledlenser.brand_catalog b ON b.sku = c.brand_sku`;
  const GENUINE = `c.buybox_seller IS NOT NULL AND (c.brand_sku IS NOT NULL OR c.title ILIKE '%led%lenser%')`;
  let offset = 0, wrapped = false, rows;
  if (asinList) {
    rows = await sbq(`SELECT ${COLS} ${FROM} WHERE c.asin IN (${asinList.map(esc).join(',')})`);
  } else {
    const st = await sbq(`SELECT cursor_offset FROM ledlenser.job_state WHERE job_key='${JOB}'`);
    offset = st.length ? Number(st[0].cursor_offset || 0) : 0;
    const q = off => `SELECT ${COLS} ${FROM} WHERE ${GENUINE} ORDER BY c.asin LIMIT ${batchSize} OFFSET ${off}`;
    rows = await sbq(q(offset));
    if (!rows.length) { offset = 0; wrapped = true; rows = await sbq(q(0)); }
  }

  function evalJson(res) {
    const text = (res && res.text) || '';
    const i = text.indexOf('eval returned:\n');
    if (i === -1) return null;
    let rest = text.slice(i + 15).trim();
    const start = rest.indexOf('{');
    if (start === -1) return null;
    let depth = 0, end = -1, inStr = false, e = false;
    for (let k = start; k < rest.length; k++) {
      const ch = rest[k];
      if (inStr) { if (e) e = false; else if (ch === '\\') e = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end === -1) return null;
    try { return JSON.parse(rest.slice(start, end + 1)); } catch (_) { return null; }
  }

  // Search page: product handles in result order, each with its Shopify variants (fetched in the page).
  const SEARCH_EVAL = "(async()=>{const blocked=/just a moment|access denied|too many requests/i.test(document.title);const hs=[];for(const a of document.querySelectorAll('a[href*=\"/products/\"]')){const m=(a.getAttribute('href')||'').match(/\\/products\\/([^\\/?#]+)/);if(m&&!hs.includes(m[1])&&!/\\.(png|jpe?g|webp)$/i.test(m[1]))hs.push(m[1])}const out=[];for(const h of hs.slice(0,8)){try{const r=await fetch('/products/'+h+'.js');if(!r.ok){out.push({h,err:r.status});continue}const f=await r.json();out.push({h,title:f.title,type:f.type,variants:(f.variants||[]).map(v=>({id:v.id,sku:v.sku||null,barcode:v.barcode||null,title:v.title}))})}catch(e){out.push({h,err:String(e).slice(0,60)})}}return JSON.stringify({title:document.title,blocked,count:hs.length,products:out})})()";

  // Product page: JSON-LD (Product or ProductGroup, this variant's offer), rating markup, spec table.
  const PAGE_EVAL = (sku, gtin) => "(()=>{const N=s=>String(s||'').replace(/[^0-9A-Za-z]/g,'').replace(/^0+/,'').toLowerCase();const SKU=N(" + JSON.stringify(sku || '') + "),GT=N(" + JSON.stringify(gtin || '') + ");const lds=[];let bad=0;for(const s of document.querySelectorAll('script[type=\"application/ld+json\"]')){try{const j=JSON.parse(s.textContent);(Array.isArray(j)?j:(j['@graph']||[j])).forEach(o=>lds.push(o))}catch(e){bad++}}const p=lds.find(o=>o&&(o['@type']==='Product'||o['@type']==='ProductGroup'))||null;let v=null;if(p&&p['@type']==='ProductGroup'){const vs=Array.isArray(p.hasVariant)?p.hasVariant:[];v=vs.find(x=>(SKU&&N(x.sku)===SKU)||(GT&&N(x.gtin||x.gtin12||x.gtin13)===GT))||null}const node=v||p;const offs=node&&node.offers?(Array.isArray(node.offers)?node.offers:[node.offers]):[];const off=offs[0]||null;const has=x=>x!==undefined&&x!==null&&x!==''&&!(Array.isArray(x)&&!x.length);const f={};if(p){f.name=has(node.name)||has(p.name);f.sku=has(node.sku)||has(p.sku);f.brand=!!(p.brand&&(p.brand.name||typeof p.brand==='string'));f.gtin12=has(node.gtin)||has(node.gtin12)||has(node.gtin13)||has(off&&(off.gtin||off.gtin12||off.gtin13));f.description=has(node.description)||has(p.description);f.image=has(node.image)||has(p.image);f.offers_price=!!(off&&has(off.price));f.additionalProperty=has(node.additionalProperty)||has(p.additionalProperty)}const lab=el=>{if(!el)return'';const c=el.cloneNode(true);const sm=c.querySelector('small');const u=sm?sm.innerText.trim():'';if(sm)sm.remove();const b=c.innerText.replace(/\\s+/g,' ').trim();return u?b+' ('+u+')':b};const specs={};const box=document.getElementById('pdp-specs-acc')||document;box.querySelectorAll('.pdp-spec__r').forEach(r=>{const k=lab(r.querySelector('.pdp-spec__k'));const val=(r.querySelector('.pdp-spec__v')||{}).innerText;if(k&&val&&!(k in specs))specs[k]=String(val).replace(/\\s+/g,' ').trim().slice(0,200)});box.querySelectorAll('table.pdp-spec__mini').forEach(t=>{const modes=[...t.querySelectorAll('thead th')].map(th=>th.innerText.trim());t.querySelectorAll('tbody tr').forEach(tr=>{const k=lab(tr.querySelector('th'));[...tr.querySelectorAll('td')].forEach((td,i)=>{const m=modes[i+1]||('mode '+(i+1));if(k)specs[k+' · '+m]=td.innerText.trim()})})});const chips=[...box.querySelectorAll('.pdp-spec__chip')].map(c=>c.innerText.trim()).filter(Boolean);if(chips.length)specs['Features']=chips.join(', ');const can=document.querySelector('link[rel=canonical]');return JSON.stringify({url:location.href,title:document.title,canonical:can?can.href:null,blocked:/just a moment|access denied|too many requests/i.test(document.title),ldType:p?p['@type']:null,ldBad:bad,variantInLd:!!v,fields:p?f:null,rating:!!(p&&(p.aggregateRating||(v&&v.aggregateRating))),specs})})()";

  const kindOf = (type, title) => {
    const t = (String(type || '') + ' ' + String(title || '')).toLowerCase();
    if (/headlamp|head lamp|headtorch/.test(t)) return 'headlamp';
    if (/lantern/.test(t)) return 'lantern';
    if (/power ?bank|powerup|flex\d/.test(t)) return 'powerbank';
    if (/work ?light|worklight/.test(t)) return 'work_light';
    if (/area ?light|floodlight|flood light/.test(t)) return 'area_light';
    if (/flashlight|torch/.test(t)) return 'flashlight';
    return 'accessory';
  };
  const isBundle = h => /bundle|gift-box|-and-|combo|kit|set-of|pack/i.test(h);
  const modelName = t => {
    const s = String(t || '').replace(/®|™/g, '').replace(/^\s*(?:zweibr\S*\s+)?led[\s-]*lenser[\s,:\-–|]*/i, '');
    const m = s.match(/^([A-Za-z]{1,6}\d{1,3}[A-Za-z]{0,3}(?:\s+(?:Core|Pro|Work|Signature|Outdoor|R|RGB))?)/);
    return m ? m[1].trim() : null;
  };

  async function checkOne(row) {
    const asin = row.asin;
    const trail = [];
    const out = { row, amazon: { checked: false }, site: { state: 'completed_not_found' } };

    // Amazon. A page that did not parse, or parsed without a details table, is not checked (never scored as 0).
    const amazonP = (async () => {
      try {
        const res = await callTool('E-Commerce', 'scrape_product', { marketplace: 'amazon', product_id: asin, includeRawFields: true });
        const r0 = (res.results && res.results[0]) || {};
        const d = r0.product_details || {};
        const parsed = r0.parse_status_code === 12000;
        if (!parsed || Object.keys(d).length === 0) { log.push(`amazon ${asin}: page not read (parse ${r0.parse_status_code || 'none'}, details ${Object.keys(d).length})`); return; }
        const values = {}, missing = [];
        for (const f of AMAZON_EXPECTED) {
          const key = AMAZON_FIELDS[f].find(k => d[k] !== undefined && String(d[k]).trim() !== '');
          if (key) values[f] = String(d[key]).trim().slice(0, 200); else missing.push(f);
        }
        out.amazon = {
          checked: true, found: AMAZON_EXPECTED.length - missing.length, missing, values,
          gtin: d.upc || d.global_trade_identification_number || null,
          mpn: d.manufacturer_part_number || d.model_number || null,
          aplusImages: Array.isArray(r0.description_images) ? r0.description_images.filter(u => /aplus-media/.test(String(u))).length : null,
          video: typeof r0.has_videos === 'boolean' ? (r0.has_videos ? 'present' : 'absent') : null,
          bullets: typeof r0.bullet_points === 'string' ? r0.bullet_points.split('\n').filter(s => s.trim()).length : null,
          images: Array.isArray(r0.images) ? r0.images.length : null,
        };
      } catch (e) { log.push(`amazon ${asin}: ${String(e.message || e).slice(0, 160)}`); }
    })();

    // Brand site
    const ids = {
      sku: [row.brand_sku, /^\d{6}$/.test(String(row.model_number || '')) ? row.model_number : null].filter(Boolean).map(norm),
      gtin: [row.upc, row.sheet_upc, row.sheet_gtin].filter(Boolean).map(norm),
    };
    const session = 'llspec_' + asin + '_' + Date.now();
    const sitePromise = (async () => {
      const queries = [];
      if (row.brand_sku) queries.push(['model_number_search', row.brand_sku]);
      else if (ids.sku[0]) queries.push(['model_number_search', row.model_number]);
      if (row.upc) queries.push(['model_number_search', row.upc]);
      const mn = modelName(row.title) || null;
      if (mn) queries.push(['search_meta', mn]);
      let match = null, sawCandidates = 0, blocked = false, nameOnly = null;
      const mnKey = mn ? mn.toLowerCase().replace(/[^a-z0-9]+/g, '') : null;
      for (const [method, q] of queries) {
        let sj = null;
        for (let tryNo = 0; tryNo < 2 && !sj; tryNo++) {
          try {
            const res = await callTool('browser', 'browser_interact', { session, url: `${SITE}/search?q=${encodeURIComponent(q)}&type=product`, steps: [{ wait: { ms: 2500 + tryNo * 3000 } }, { eval: { expression: SEARCH_EVAL } }] });
            sj = evalJson(res);
          } catch (e) { trail.push(`search(${q}):error ${String(e.message || e).slice(0, 80)}`); }
        }
        if (!sj) { trail.push(`search(${q}):no_read`); continue; }
        if (sj.blocked) { blocked = true; trail.push(`search(${q}):blocked`); continue; }
        trail.push(`search(${q}):${sj.count}`);
        sawCandidates += (sj.products || []).length;
        const prods = (sj.products || []).filter(p => p.variants);
        prods.sort((a, b) => Number(isBundle(a.h)) - Number(isBundle(b.h)));
        for (const p of prods) {
          const vBySku = p.variants.find(v => v.sku && ids.sku.includes(norm(v.sku)));
          const vByGtin = vBySku ? null : p.variants.find(v => v.barcode && ids.gtin.includes(norm(v.barcode)));
          const v = vBySku || vByGtin;
          if (v) { match = { p, v, how: vBySku ? 'sku' : 'gtin', method, query: q }; break; }
        }
        if (match) break;
        if (!nameOnly && mnKey) {
          const hit = prods.find(p => !isBundle(p.h) && (p.h.toLowerCase().replace(/[^a-z0-9]+/g, '').startsWith(mnKey) || String(p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '').startsWith(mnKey)));
          if (hit) nameOnly = hit;
        }
        trail.push(`search(${q}):no_variant_match`);
      }
      if (!match) {
        const isBlocked = blocked && !sawCandidates;
        out.site = { state: isBlocked ? 'blocked' : (nameOnly ? 'ambiguous_candidate' : 'completed_not_found'), method: null, code: isBlocked ? 'site_blocked' : (nameOnly ? 'same_model_name_different_sku' : (sawCandidates ? 'search_results_lack_this_sku' : 'search_no_results')) };
        if (nameOnly) { out.site.candidate = `${SITE}/products/${nameOnly.h}`; trail.push(`name_only:${nameOnly.h}(${(nameOnly.variants || []).map(v => v.sku || v.barcode).join('/')})`); }
        return;
      }
      const url = `${SITE}/products/${match.p.h}`;
      let pe = null;
      for (let tryNo = 0; tryNo < 2 && !(pe && pe.ldType); tryNo++) {
        try {
          const res = await callTool('browser', 'browser_interact', { session, url: `${url}?variant=${match.v.id}`, steps: [{ wait: { ms: 3000 + tryNo * 3000 } }, { eval: { expression: PAGE_EVAL(match.v.sku, match.v.barcode) } }] });
          pe = evalJson(res);
        } catch (e) { trail.push(`page:error ${String(e.message || e).slice(0, 80)}`); }
      }
      const family = match.p.variants.length > 1;
      out.site = {
        state: family ? 'official_family_page' : 'exact_official_product',
        method: match.method, how: match.how, url, variantSku: match.v.sku || match.v.barcode,
        productKind: kindOf(match.p.type, match.p.title),
        explanation: (family ? `Official family page with ${match.p.variants.length} variants. Variant ` : 'Official product page. Variant ') + `${match.how === 'sku' ? 'SKU' : 'UPC'} ${match.how === 'sku' ? match.v.sku : match.v.barcode} matches${family ? ': ' + match.v.title : ''}. Found by searching "${match.query}".`,
        matched: [match.how === 'sku' ? 'brand_sku' : 'barcode'].concat(match.how === 'sku' && match.v.barcode && ids.gtin.includes(norm(match.v.barcode)) ? ['barcode'] : []),
        conflicting: match.how === 'sku' && match.v.barcode && ids.gtin.length && !ids.gtin.includes(norm(match.v.barcode)) ? ['barcode'] : [],
        page: pe,
      };
      trail.push(`accepted:${match.p.h}(${match.how})`);
      if (!pe || !pe.ldType) trail.push('page:jsonld_not_read');
    })();

    await Promise.all([amazonP, sitePromise.catch(e => { trail.push('error:' + String(e.message || e).slice(0, 100)); out.site = { state: 'completed_not_found', code: 'lookup_error' }; })]);
    try { await callTool('browser', 'browser_interact', { session, closeSession: true }); } catch (_) {}
    out.trail = trail;
    return out;
  }

  const results = [];
  let next = 0, skippedForTime = 0;
  async function worker() {
    while (next < rows.length) {
      if (Date.now() - started > budgetMs) { skippedForTime = rows.length - next; next = rows.length; break; }
      const row = rows[next++];
      try { results.push(await checkOne(row)); }
      catch (e) { log.push(`${row.asin}: ${String(e.message || e).slice(0, 160)}`); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));

  const TS = `'${new Date().toISOString()}'::timestamptz`;
  const batchRunId = 'll_spec_run_' + Date.now();
  const spec = [], attempts = [];
  for (const r of results) {
    const { row, amazon: a, site: s } = r;
    const found = s.state === 'exact_official_product' || s.state === 'official_family_page';
    const pe = found ? s.page : null;
    const ldOk = !!(pe && pe.ldType && pe.fields);
    let siteFound = 0, siteMissing = [];
    if (ldOk) for (const f of SITE_EXPECTED) { if (pe.fields[f]) siteFound++; else siteMissing.push(f); }
    const specs = pe && pe.specs && Object.keys(pe.specs).length ? pe.specs : null;
    const reason = found ? null : ('not_found: ' + (s.code || 'search_no_results') + (r.trail.length ? ' (' + r.trail.join(' | ').replace(/;/g, ',') + ')' : '')).slice(0, 600);
    const missingText = found ? (ldOk ? (siteMissing.length ? siteMissing.join(';') : null) : 'jsonld_not_read') : reason;
    spec.push({
      asin: row.asin, title: row.title, category: row.category,
      a_found: a.checked ? a.found : 0, a_pct: a.checked ? Math.round(a.found / AMAZON_EXPECTED.length * 1000) / 10 : null,
      a_missing: a.checked ? a.missing.join(';') : null, a_checked: a.checked,
      url: found ? s.url : null, found, s_found: ldOk ? siteFound : 0,
      s_pct: found && ldOk ? Math.round(siteFound / SITE_EXPECTED.length * 1000) / 10 : null,
      s_missing: missingText, source: found ? (s.method === 'search_meta' ? 'search' : 'search_identifier') : null,
      identity: found ? s.how : null, vsku: found ? s.variantSku : null, specs, rating: found && pe ? !!pe.rating : null,
      a_values: a.checked ? a.values : null, a_gtin: a.gtin || null, a_mpn: a.mpn || null,
      aplus_state: a.aplusImages == null ? null : (a.aplusImages > 0 ? 'present' : 'absent'), aplus_n: a.aplusImages == null ? null : a.aplusImages,
      video: a.video || null, bullets: a.bullets == null ? null : a.bullets, images: a.images == null ? null : a.images, trail: r.trail,
    });
    const jsonldStatus = found ? (ldOk ? 'checked' : (pe && pe.blocked ? 'blocked' : 'parse_failure')) : 'not_checked';
    attempts.push({
      attempt_key: `${COLLECTOR}|${row.asin}|${new Date().toISOString()}`, asin: row.asin, state: s.state,
      canonical_url: found ? s.url : null, resolved_url: found && pe ? pe.url : null, source_method: found ? s.method : null,
      matched: found ? s.matched : [], conflicting: found ? s.conflicting : [], confidence: found ? s.how : 'none',
      explanation: found ? s.explanation : s.candidate ? `ledlenserusa.com has a page for the same model name (${s.candidate}), but none of its variants carries this listing's SKU or UPC. It may be a regional or older version.` : (s.code === 'site_blocked' ? 'ledlenserusa.com blocked the automated browser. This does not show the page is missing.' : 'Search finished without an official page carrying this listing\'s SKU or UPC. This does not prove the page is absent from ledlenserusa.com.'),
      page_title: pe ? pe.title : null, canonical_tag: pe ? pe.canonical : null, structured: found && pe ? { ld_type: pe.ldType, variant_in_ld: pe.variantInLd } : null,
      browser_outcome: found ? (pe ? 'read' : 'not_read') : (s.code || 'search_no_results'), last_error: r.trail.filter(t => /error/.test(t)).join(' | ').slice(0, 300) || null,
      product_kind: found ? s.productKind : null, schema_profile: jsonldStatus === 'checked' ? pe.ldType : null,
      present: jsonldStatus === 'checked' ? SITE_EXPECTED.filter(f => pe.fields[f]) : null,
      missing: jsonldStatus === 'checked' ? siteMissing : null,
      identity_hash: [row.brand_sku || '', norm(row.upc) || '', norm(row.model_number) || ''].join('|'),
      variant_sku: found ? s.variantSku : null, jsonld_status: jsonldStatus, title: row.title, category: row.category,
    });
  }

  if (inputs.dryRun) return { dryRun: true, collector: COLLECTOR, processed: results.length, skippedForTime, spec, attempts, log, elapsedSec: Math.round((Date.now() - started) / 1000) };

  let sql = 'BEGIN;\n';
  if (spec.length) {
    sql += `INSERT INTO ledlenser.spec_readiness (id, asin, title, category, amazon_fields_found, amazon_fields_expected, amazon_completeness_pct, amazon_missing_fields, amazon_checked, brand_site_url, brand_site_found, brand_site_fields_found, brand_site_fields_expected, brand_site_completeness_pct, brand_site_missing_fields, checked_at, batch_run_id, created_at, collector_version, brand_site_page_source, brand_site_identity_match, brand_site_variant_sku, brand_site_spec_values, brand_site_rating_markup, amazon_spec_values, amazon_gtin, amazon_mpn, amazon_aplus_state, amazon_aplus_image_count, amazon_video_state, amazon_bullet_count, amazon_image_count) VALUES\n` +
      spec.map(r => `(${esc(uuid())}, ${esc(r.asin)}, ${esc(r.title)}, ${esc(r.category)}, ${num(r.a_found)}, ${AMAZON_EXPECTED.length}, ${num(r.a_pct)}, ${esc(r.a_missing)}, ${nbool(r.a_checked)}, ${esc(r.url)}, ${nbool(r.found)}, ${num(r.s_found)}, ${SITE_EXPECTED.length}, ${num(r.s_pct)}, ${esc(r.s_missing)}, ${TS}, ${esc(batchRunId)}, ${TS}, ${esc(COLLECTOR)}, ${esc(r.source)}, ${esc(r.identity)}, ${esc(r.vsku)}, ${jsonb(r.specs)}, ${nbool(r.rating)}, ${jsonb(r.a_values)}, ${esc(r.a_gtin)}, ${esc(r.a_mpn)}, ${esc(r.aplus_state)}, ${num(r.aplus_n)}, ${esc(r.video)}, ${num(r.bullets)}, ${num(r.images)})`).join(',\n') + ';\n';
    const attCols = 'attempt_key, asin, findability_state, canonical_url, resolved_url, source_method, matched_identifiers, conflicting_identifiers, match_confidence, match_explanation, page_title, canonical_tag, structured_identifiers, http_status, browser_outcome, collector_version, last_error, attempt_at, product_kind, schema_profile, schema_fields_present, schema_fields_missing, catalog_identity_hash, variant_sku, jsonld_status';
    const attRest = a => `${esc(a.findability_state || a.state)}, ${esc(a.canonical_url)}, ${esc(a.resolved_url)}, ${esc(a.source_method)}, ${jsonb(a.matched)}, ${jsonb(a.conflicting)}, ${esc(a.confidence)}, ${esc(a.explanation)}, ${esc(a.page_title)}, ${esc(a.canonical_tag)}, ${jsonb(a.structured)}, NULL, ${esc(a.browser_outcome)}, ${esc(COLLECTOR)}, ${esc(a.last_error)}, ${TS}, ${esc(a.product_kind)}, ${esc(a.schema_profile)}, ${jsonb(a.present)}, ${jsonb(a.missing)}, ${esc(a.identity_hash)}, ${esc(a.variant_sku)}, ${esc(a.jsonld_status)}`;
    sql += `INSERT INTO ledlenser.spec_findability_attempt (${attCols}) VALUES\n` + attempts.map(a => `(${esc(a.attempt_key)}, ${esc(a.asin)}, ${attRest(a)})`).join(',\n') + ';\n';
    const curCols = 'asin, title, category, attempt_key, ' + attCols.replace('attempt_key, asin, ', '');
    for (const a of attempts) {
      const ok = a.state === 'exact_official_product' || a.state === 'official_family_page';
      sql += `INSERT INTO ledlenser.spec_findability_current (${curCols}, last_success_state, last_success_url, last_success_variant_sku, last_success_at, last_success_identity_hash, last_success_explanation, last_success_schema_profile, last_success_fields_present, last_success_fields_missing) VALUES (${esc(a.asin)}, ${esc(a.title)}, ${esc(a.category)}, ${esc(a.attempt_key)}, ${attRest(a)}, ${ok ? esc(a.state) : 'NULL'}, ${ok ? esc(a.canonical_url) : 'NULL'}, ${ok ? esc(a.variant_sku) : 'NULL'}, ${ok ? TS : 'NULL'}, ${ok ? esc(a.identity_hash) : 'NULL'}, ${ok ? esc(a.explanation) : 'NULL'}, ${ok ? esc(a.schema_profile) : 'NULL'}, ${ok ? jsonb(a.present) : 'NULL'}, ${ok ? jsonb(a.missing) : 'NULL'})
ON CONFLICT (asin) DO UPDATE SET title=EXCLUDED.title, category=EXCLUDED.category, attempt_key=EXCLUDED.attempt_key, findability_state=EXCLUDED.findability_state, canonical_url=EXCLUDED.canonical_url, resolved_url=EXCLUDED.resolved_url, source_method=EXCLUDED.source_method, matched_identifiers=EXCLUDED.matched_identifiers, conflicting_identifiers=EXCLUDED.conflicting_identifiers, match_confidence=EXCLUDED.match_confidence, match_explanation=EXCLUDED.match_explanation, page_title=EXCLUDED.page_title, canonical_tag=EXCLUDED.canonical_tag, structured_identifiers=EXCLUDED.structured_identifiers, http_status=EXCLUDED.http_status, browser_outcome=EXCLUDED.browser_outcome, collector_version=EXCLUDED.collector_version, last_error=EXCLUDED.last_error, attempt_at=EXCLUDED.attempt_at, product_kind=EXCLUDED.product_kind, schema_profile=EXCLUDED.schema_profile, schema_fields_present=EXCLUDED.schema_fields_present, schema_fields_missing=EXCLUDED.schema_fields_missing, catalog_identity_hash=EXCLUDED.catalog_identity_hash, variant_sku=EXCLUDED.variant_sku, jsonld_status=EXCLUDED.jsonld_status, last_success_state=COALESCE(EXCLUDED.last_success_state, ledlenser.spec_findability_current.last_success_state), last_success_url=COALESCE(EXCLUDED.last_success_url, ledlenser.spec_findability_current.last_success_url), last_success_variant_sku=COALESCE(EXCLUDED.last_success_variant_sku, ledlenser.spec_findability_current.last_success_variant_sku), last_success_at=COALESCE(EXCLUDED.last_success_at, ledlenser.spec_findability_current.last_success_at), last_success_identity_hash=COALESCE(EXCLUDED.last_success_identity_hash, ledlenser.spec_findability_current.last_success_identity_hash), last_success_explanation=COALESCE(EXCLUDED.last_success_explanation, ledlenser.spec_findability_current.last_success_explanation), last_success_schema_profile=CASE WHEN EXCLUDED.last_success_state IS NOT NULL THEN EXCLUDED.last_success_schema_profile ELSE ledlenser.spec_findability_current.last_success_schema_profile END, last_success_fields_present=CASE WHEN EXCLUDED.last_success_state IS NOT NULL THEN EXCLUDED.last_success_fields_present ELSE ledlenser.spec_findability_current.last_success_fields_present END, last_success_fields_missing=CASE WHEN EXCLUDED.last_success_state IS NOT NULL THEN EXCLUDED.last_success_fields_missing ELSE ledlenser.spec_findability_current.last_success_fields_missing END;\n`;
    }
  }
  // Advance only past listings checked; listings skipped for time come first next run.
  const newOffset = asinList ? offset : offset + results.length;
  if (!asinList) {
    const extra = JSON.stringify({ last_batch_run_id: batchRunId, collector: COLLECTOR, processed: results.length, skipped_for_time: skippedForTime, wrapped, amazon_checked: spec.filter(r => r.a_checked).length, site_found: spec.filter(r => r.found).length, elapsed_sec: Math.round((Date.now() - started) / 1000), errors: log.slice(0, 5) });
    sql += `INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('${JOB}', ${newOffset}, ${TS}, ${esc(extra)}::jsonb, ${TS}) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at;\n`;
  }
  sql += 'COMMIT;\nSELECT 1 AS ok;';
  await sbq(sql);
  return { batchRunId, collector: COLLECTOR, processed: results.length, skippedForTime, offset, newOffset, wrapped, siteFound: spec.filter(r => r.found).length, amazonChecked: spec.filter(r => r.a_checked).length, elapsedSec: Math.round((Date.now() - started) / 1000), summary: spec.map(r => ({ asin: r.asin, amazon: r.a_checked ? `${r.a_found}/${AMAZON_EXPECTED.length}` : 'not read', site: r.found ? `${r.s_found}/8 ${r.url}` : r.s_missing && r.s_missing.slice(0, 120), specKeys: r.specs ? Object.keys(r.specs).length : 0 })), log };
}