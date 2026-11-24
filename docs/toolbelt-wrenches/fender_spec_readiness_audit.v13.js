async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const WRENCH = 'fender_spec_readiness_audit';
  const COLLECTOR = 'spec_readiness_v12';
  const JOB = 'spec_readiness';
  const batchSize = Math.max(1, Math.min(25, Number(inputs.batchSize || 5)));
  const asinList = Array.isArray(inputs.asins) && inputs.asins.length ? inputs.asins : null;
  const log = [];

  const AMAZON_EXPECTED = ["body_material_type","neck_material_type","fretboard_material_type","guitar_pickup_configuration","guitar_bridge_system","scale_length","number_of_strings","hand_orientation","color","upc","manufacturer_part_number","item_dimensions","item_weight"];
  const FENDER_EXPECTED = ["name","sku","brand","gtin12","description","image","offers_price","additionalProperty"];
  const ACCEPTED_STATES = ['exact_official_product', 'official_family_page'];

  async function sbqOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = typeof r === 'string' ? r : (r && typeof r.result === 'string' ? r.result : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (!m) throw new Error('Supabase error: ' + txt.slice(0, 500));
    return JSON.parse(m[1]);
  }
  const sbq = q => sbqOn(SB, q);
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  const sq = s => `'${String(s).replace(/'/g, "''")}'`;
  async function write(q) {
    const res = await sbqOn(SB, q);
    await Promise.all(MIRRORS.map(async t => {
      try { await sbqOn(t.id, q); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sbqOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES (${sq(WRENCH)}, ${sq(t.name)}, ${sq(String(e.message || e).slice(0, 2000))}, ${sq(q)}); SELECT 1 ok`); } catch (_) {}
      }
    }));
    return res;
  }
  const genUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

  const st = await sbq(`SELECT cursor_offset FROM command.fmic_job_state WHERE job_key='${JOB}'`);
  let offset = st.length ? Number(st[0].cursor_offset || 0) : 0;

  const COLS = 'asin, title, category, color, model_number, upc';
  const batchSql = (off) => `SELECT ${COLS} FROM command.fmic_electric_catalog WHERE buybox_seller IS NOT NULL ORDER BY asin LIMIT ${batchSize} OFFSET ${off}`;
  let rows, wrapped = false;
  if (asinList) {
    rows = await sbq(`SELECT ${COLS} FROM command.fmic_electric_catalog WHERE asin IN (${asinList.map(a => sq(a)).join(',')})`);
  } else {
    rows = await sbq(batchSql(offset));
    if (rows.length === 0) {
      offset = 0; wrapped = true;
      rows = await sbq(batchSql(0));
    }
  }

  // The official page Findability accepted for each listing, plus the variant SKU it matched.
  const accepted = new Map();
  if (rows.length) {
    const fr = await sbq(`SELECT asin, latest_state, latest_canonical_url, latest_variant_sku FROM public.canvas_spec_findability WHERE asin IN (${rows.map(r => sq(r.asin)).join(',')})`);
    for (const f of fr) {
      if (ACCEPTED_STATES.includes(f.latest_state) && /^https:\/\/www\.fender\.com\/products\//.test(f.latest_canonical_url || '')) {
        accepted.set(f.asin, { url: f.latest_canonical_url.split('?')[0], state: f.latest_state, variantSku: f.latest_variant_sku || null });
      }
    }
  }

  const batchRunId = 'spec_run_' + Date.now();
  const results = [];

  function extractEvalJson(text) {
    const marker = 'eval returned:\n';
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    let rest = text.slice(idx + marker.length).trim();
    if (rest.startsWith('"')) { try { rest = JSON.parse(rest.slice(0, rest.lastIndexOf('"') + 1)); } catch (e) { /* fall through */ } }
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

  const toks = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const SHAPES = ['stratocaster','telecaster','jazzmaster','jaguar','mustang','precision','jazz','starcaster','duo','toronado','meteora','bronco','musicmaster','esquire'];
  const LINES = ['sonic','affinity','classic','vibe','bullet','debut','mini','player','ii','plus','professional','ultra','vintera','deluxe','modified','performer','elite','acoustasonic','custom','shop','american','paranormal','contemporary','standard','signature'];
  const VARIANTS = ['limited','edition','fsr','ht','hh','hss','hardtail','lh','left','handed','pack','bundle','kit','set'];
  const COLORONLY = ['black','white','red','blue','green','yellow','orange','pink','purple','silver','gold','copper','sunburst','natural','olympic','arctic','lake','placid','california','candy','daphne','surf','seafoam','fiesta','shoreline','torino','charcoal','cherry','walnut','butterscotch','blonde','teal','gray','grey','tidepool','tobacco','midnight','mystic'];
  const pickFrom = (list, t) => list.filter(x => t.includes(x));
  function handleAgrees(handle, title, color) {
    const h = toks(handle), t = toks(title), c = toks(color);
    const hs = pickFrom(SHAPES, h), ts = pickFrom(SHAPES, t);
    if (!ts.length || hs.join() !== ts.join()) return null;
    if (pickFrom(LINES, h).sort().join('|') !== pickFrom(LINES, t).sort().join('|')) return null;
    if (pickFrom(VARIANTS, h).sort().join('|') !== pickFrom(VARIANTS, t).sort().join('|')) return null;
    const hc = COLORONLY.filter(x => h.includes(x));
    if (hc.length && !hc.every(x => c.includes(x))) return null;
    const hSq = h.includes('squier'), tSq = t.includes('squier');
    if (hSq && !tSq) return null;
    return { squierRelaxed: tSq && !hSq };
  }
  const headOf = title => String(title || '').split(',')[0].replace(/\s+-\s+.*$/, '').trim();
  const coreOf = title => headOf(title).replace(/\b(fender|squier|electric guitar|electric|guitar)\b/gi, ' ').replace(/[®™]/g, ' ').replace(/\s+/g, ' ').trim();
  const slug = s => toks(s).join('-');
  const digits = s => String(s || '').replace(/[^0-9A-Za-z]/g, '');

  // Page read: Product block, offers, Shopify variant feed, and this listing's variant
  // (Fender SKU, then UPC, then the variant SKU Findability matched). Spec table from #Specs-<variantId>.
  const PAGE_EVAL = (pn, upc, fvs) => "(async()=>{const norm=s=>String(s||'').replace(/[^0-9]/g,'').replace(/^0+/,'');const lds=[];for(const s of document.querySelectorAll('script[type=\"application/ld+json\"]')){try{let j=JSON.parse(s.textContent);(Array.isArray(j)?j:(j['@graph']||[j])).forEach(o=>lds.push(o))}catch(e){}}const ld=lds.find(o=>o&&(o['@type']==='Product'||o['@type']==='ProductGroup'))||lds.find(o=>o&&o.name)||null;const offers=ld&&ld.offers?(Array.isArray(ld.offers)?ld.offers:[ld.offers]):[];const handle=location.pathname.replace(/\\/$/,'').split('/').pop();let variants=[];try{const r=await fetch('/products/'+handle+'.js');const f=await r.json();variants=(f.variants||[]).map(v=>({id:v.id,sku:v.sku||null,barcode:v.barcode||null}))}catch(e){}const PN=" + JSON.stringify(pn || '') + ",UPC=" + JSON.stringify(upc || '') + ",FVS=" + JSON.stringify(fvs || '') + ";let match=null,how='none';if(PN){match=variants.find(v=>norm(v.sku)===norm(PN))||null;if(match)how='sku'}if(!match&&UPC){match=variants.find(v=>norm(v.barcode)===norm(UPC))||null;if(match)how='upc'}if(!match&&FVS){match=variants.find(v=>norm(v.sku)===norm(FVS))||null;if(match)how='findability_variant'}const offer=match?(offers.find(o=>norm(o.sku)===norm(match.sku))||null):(offers[0]||null);let specs=null;if(match){const box=document.getElementById('Specs-'+match.id);if(box){specs={};box.querySelectorAll('.product-specs-props').forEach(p=>{const h=p.querySelector('.product-specs-heading'),c=p.querySelector('.product-specs-content');if(h&&c){const k=h.innerText.trim();if(k&&!(k in specs))specs[k]=c.innerText.trim().slice(0,200)}})}}const can=document.querySelector('link[rel=canonical]');return JSON.stringify({url:location.href,canonical:can?can.href:null,hasLd:!!ld,ldType:ld?ld['@type']:null,name:(ld&&ld.name)||null,sku:!!(ld&&ld.sku),brand:!!(ld&&ld.brand&&(ld.brand.name||typeof ld.brand==='string')),gtin12:!!((offer&&(offer.gtin12||offer.gtin13||offer.gtin))||(ld&&ld.gtin12)),desc:!!(ld&&ld.description),image:!!(ld&&ld.image&&ld.image.length),price:!!(offer&&offer.price),addl:!!(ld&&ld.additionalProperty),rating:!!(ld&&ld.aggregateRating),offerCount:offers.length,variantCount:variants.length,how,variantSku:match?match.sku:null,variantOffer:!!(match&&offer),specs,pn:" + (pn ? "document.documentElement.innerHTML.includes(" + JSON.stringify(digits(pn)) + ")" : "false") + "})})()";
  const SEARCH_EVAL = "JSON.stringify({links: [...new Set([...document.querySelectorAll('a[href*=\"/products/\"]')].map(a => (a.getAttribute('href') || '').split('?')[0]))].slice(0, 30)})";

  // v12: one reason code per not-found SKU, from the lookup trail.
  function reasonOf(trail, hadFindability, errored) {
    const has = s => trail.some(t => t.includes(s));
    let code;
    if (errored) code = 'lookup_error';
    else if (hadFindability && has('findability_family_page_no_variant')) code = 'family_page_lacks_this_sku';
    else if (hadFindability && has('findability_family_page_no_spec_table')) code = 'family_page_has_no_spec_table_for_sku';
    else if (hadFindability && has('findability:page_not_read')) code = 'findability_page_not_read';
    else if (has(':no_variant_match')) code = 'search_page_lacks_this_sku';
    else if (has(':part_number_not_on_page')) code = 'search_page_lacks_part_number';
    else if (has(':name_shape_mismatch')) code = 'search_page_different_body_shape';
    else if (has(':page_not_found')) code = 'search_candidate_page_missing';
    else if (has(':handle_rejected')) code = 'search_results_no_matching_model';
    else code = 'search_no_results';
    const detail = trail.join(' | ').replace(/;/g, ',');
    return ('not_found: ' + code + (detail ? ' (' + detail + ')' : '')).slice(0, 600);
  }

  for (const row of rows) {
    const asin = row.asin;
    let amzFound = 0, amzMissing = [], amazonChecked = false;
    let amzValues = null, amzGtin = null, amzMpn = null, aplusState = null, aplusImages = null, videoState = null, amzBullets = null, amzImages = null;
    try {
      const scrapeRes = await callTool('E-Commerce', 'scrape_product', { marketplace: 'amazon', product_id: asin, includeRawFields: true });
      const r0 = (scrapeRes.results && scrapeRes.results[0]) || {};
      const details = r0.product_details || {};
      amazonChecked = true;
      amzValues = {};
      for (const f of AMAZON_EXPECTED) {
        if (details[f] && String(details[f]).trim() !== '') { amzFound++; amzValues[f] = String(details[f]).trim().slice(0, 200); }
        else amzMissing.push(f);
      }
      amzGtin = details.upc || details.global_trade_identification_number || null;
      amzMpn = details.manufacturer_part_number || null;
      const parsed = r0.parse_status_code === 12000;
      if (parsed && Array.isArray(r0.description_images)) {
        aplusImages = r0.description_images.filter(u => /aplus-media/.test(String(u))).length;
        aplusState = aplusImages > 0 ? 'present' : 'absent';
      }
      if (parsed && typeof r0.has_videos === 'boolean') videoState = r0.has_videos ? 'present' : 'absent';
      if (parsed && typeof r0.bullet_points === 'string') amzBullets = r0.bullet_points.split('\n').filter(s => s.trim()).length;
      if (parsed && Array.isArray(r0.images)) amzImages = r0.images.length;
    } catch (e) {
      log.push(`Amazon scrape failed for ${asin}: ${e.message}`);
    }

    let fenderFound = false, fenderUrl = null, fdrFound = 0, fdrMissing = null;
    let pageSource = null, identity = null, variantSku = null, fenderSpecs = null, ratingMarkup = null;
    let lookupErrored = false;
    const trail = [];
    const session = 'spec_' + asin;
    const pn = (String(row.model_number || '').match(/\d{10}/) || [])[0] || (String(amzMpn || '').match(/\d{10}/) || [])[0] || null;
    const upc = row.upc || null;
    const fa = accepted.get(asin);
    function accept(pe, how) {
      fenderFound = true; fenderUrl = pe.url.split('?')[0]; fdrMissing = []; fdrFound = 0;
      if (pe.name) fdrFound++; else fdrMissing.push('name');
      if (pe.sku) fdrFound++; else fdrMissing.push('sku');
      if (pe.brand) fdrFound++; else fdrMissing.push('brand');
      if (pe.gtin12) fdrFound++; else fdrMissing.push('gtin12');
      if (pe.desc) fdrFound++; else fdrMissing.push('description');
      if (pe.image) fdrFound++; else fdrMissing.push('image');
      if (pe.price) fdrFound++; else fdrMissing.push('offers_price');
      if (pe.addl) fdrFound++; else fdrMissing.push('additionalProperty');
      pageSource = how;
      identity = pe.how || 'none';
      variantSku = pe.variantSku || null;
      fenderSpecs = pe.specs && Object.keys(pe.specs).length ? pe.specs : null;
      ratingMarkup = !!pe.rating;
    }
    async function readPage(href, waitMs, fvs) {
      const pres = await callTool('browser', 'browser_interact', {
        session, url: href,
        steps: [{ wait: { ms: waitMs || 2500 } }, { eval: { expression: PAGE_EVAL(pn, upc, fvs || null) } }]
      });
      return extractEvalJson(pres.text || '');
    }
    const samePage = (pe, href) => pe && /^https:\/\/www\.fender\.com\/products\//.test(pe.url || '') && pe.url.split('?')[0].replace(/\/$/, '') === href.split('?')[0].replace(/\/$/, '');
    try {
      // 1. The page Findability accepted, read once more with a longer wait if the first read fails.
      if (fa) {
        let pe = await readPage(fa.url, 2500, fa.variantSku);
        if (!(samePage(pe, fa.url) && pe.hasLd)) pe = await readPage(fa.url, 6000, fa.variantSku);
        if (!(samePage(pe, fa.url) && pe.hasLd)) trail.push('findability:page_not_read');
        else if (fa.state === 'exact_official_product') { accept(pe, 'findability'); trail.push('findability:exact_official_product'); }
        else if (pe.how === 'none') trail.push('findability_family_page_no_variant');
        else if (!(pe.specs && Object.keys(pe.specs).length)) trail.push('findability_family_page_no_spec_table(' + pe.how + ')');
        else { accept(pe, 'findability'); trail.push('findability:official_family_page(' + pe.how + ')'); }
      }
      // 2. Otherwise site search, with the v11 guards.
      if (!fenderFound) {
        const core = coreOf(row.title);
        const queries = [headOf(row.title), core].filter((v, i, a) => v && a.indexOf(v) === i);
        const cand = [];
        const addCand = (handle, href, how) => { if (handle && !cand.some(c => c.handle === handle)) cand.push({ handle, href, how }); };
        for (const q of queries) {
          const sres = await callTool('browser', 'browser_interact', {
            session, url: `https://www.fender.com/search?q=${encodeURIComponent(q)}&type=product`,
            steps: [{ wait: { ms: 2500 } }, { eval: { expression: SEARCH_EVAL } }]
          });
          const sj = extractEvalJson(sres.text || '') || { links: [] };
          for (const l of (sj.links || [])) {
            const m = String(l).match(/\/products\/([^\/?#]+)/);
            if (m) addCand(m[1], String(l).startsWith('http') ? l : 'https://www.fender.com' + l, 'search');
          }
          if (cand.some(c => handleAgrees(c.handle, row.title, row.color))) break;
        }
        const base = slug(core);
        if (base) { addCand(base, 'https://www.fender.com/products/' + base, 'derived'); addCand('squier-' + base, 'https://www.fender.com/products/squier-' + base, 'derived'); }
        for (const c of cand) {
          const ag = handleAgrees(c.handle, row.title, row.color);
          if (!ag) { trail.push(c.handle + ':handle_rejected'); continue; }
          const pe = await readPage(c.href, 2500, null);
          if (!samePage(pe, c.href) || !pe.hasLd) { trail.push(c.handle + ':page_not_found'); continue; }
          if (pickFrom(SHAPES, toks(pe.name)).join() !== pickFrom(SHAPES, toks(row.title)).join()) { trail.push(c.handle + ':name_shape_mismatch'); continue; }
          if (ag.squierRelaxed && !pe.pn) { trail.push(c.handle + ':part_number_not_on_page'); continue; }
          if (pe.how === 'none') { trail.push(c.handle + ':no_variant_match'); continue; }
          accept(pe, 'search');
          trail.push(c.handle + ':accepted(' + c.how + ')');
          break;
        }
      }
    } catch (e) {
      lookupErrored = true;
      trail.push('error:' + String(e.message || e).slice(0, 120));
      log.push(`Fender.com lookup failed for ${asin}: ${e.message}`);
    }
    try { await callTool('browser', 'browser_interact', { session, closeSession: true }); } catch (_) {}
    if (!(fenderFound && /^https:\/\/www\.fender\.com\/products\//.test(fenderUrl || ''))) {
      fenderFound = false; fenderUrl = null; fdrMissing = null; fdrFound = 0;
      pageSource = null; identity = null; variantSku = null; fenderSpecs = null; ratingMarkup = null;
    }
    const notFoundReason = fenderFound ? null : reasonOf(trail, !!fa, lookupErrored && !trail.some(t => !t.startsWith('error:')));

    results.push({
      asin, title: row.title, category: row.category,
      amazon_fields_found: amzFound, amazon_fields_expected: AMAZON_EXPECTED.length,
      amazon_completeness_pct: amazonChecked ? Math.round((amzFound / AMAZON_EXPECTED.length) * 1000) / 10 : null,
      amazon_missing_fields: amzMissing.join(';'), amazon_checked: amazonChecked,
      fender_url: fenderUrl, fender_found: fenderFound,
      fender_fields_found: fenderFound ? fdrFound : 0, fender_fields_expected: FENDER_EXPECTED.length,
      fender_completeness_pct: fenderFound ? Math.round((fdrFound / FENDER_EXPECTED.length) * 1000) / 10 : null,
      // v12: found rows keep the missing JSON-LD field list; not-found rows carry the reason.
      fender_missing_fields: fenderFound ? (fdrMissing.length ? fdrMissing.join(';') : null) : notFoundReason,
      fender_page_source: pageSource,
      fender_identity_match: identity,
      fender_variant_sku: variantSku,
      fender_spec_values: fenderSpecs,
      fender_rating_markup: ratingMarkup,
      amazon_spec_values: amzValues,
      amazon_gtin: amzGtin,
      amazon_mpn: amzMpn,
      amazon_aplus_state: aplusState,
      amazon_aplus_image_count: aplusImages,
      amazon_video_state: videoState,
      amazon_bullet_count: amzBullets,
      amazon_image_count: amzImages,
      _trail: trail.slice(0, 12)
    });
  }

  const esc = (s) => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
  const num = (n) => (n === null || n === undefined || isNaN(Number(n))) ? 'NULL' : Number(n);
  const bool = (b) => b ? 'TRUE' : 'FALSE';
  const nbool = (b) => b === null || b === undefined ? 'NULL' : (b ? 'TRUE' : 'FALSE');
  const jsonb = (v) => v == null ? 'NULL' : `${esc(JSON.stringify(v))}::jsonb`;
  const newOffset = asinList ? offset : offset + rows.length;
  const TS = `'${new Date().toISOString()}'::timestamptz`;

  let sql = 'BEGIN;\n';
  if (results.length) {
    const vals = results.map(r => `(${esc(genUUID())}, ${esc(r.asin)}, ${esc(r.title)}, ${esc(r.category)}, ${num(r.amazon_fields_found)}, ${num(r.amazon_fields_expected)}, ${num(r.amazon_completeness_pct)}, ${esc(r.amazon_missing_fields)}, ${bool(r.amazon_checked)}, ${esc(r.fender_url)}, ${bool(r.fender_found)}, ${num(r.fender_fields_found)}, ${num(r.fender_fields_expected)}, ${num(r.fender_completeness_pct)}, ${esc(r.fender_missing_fields)}, ${TS}, ${esc(batchRunId)}, ${TS}, ${esc(COLLECTOR)}, ${esc(r.fender_page_source)}, ${esc(r.fender_identity_match)}, ${esc(r.fender_variant_sku)}, ${jsonb(r.fender_spec_values)}, ${nbool(r.fender_rating_markup)}, ${jsonb(r.amazon_spec_values)}, ${esc(r.amazon_gtin)}, ${esc(r.amazon_mpn)}, ${esc(r.amazon_aplus_state)}, ${num(r.amazon_aplus_image_count)}, ${esc(r.amazon_video_state)}, ${num(r.amazon_bullet_count)}, ${num(r.amazon_image_count)})`);
    sql += `INSERT INTO command.fmic_spec_readiness (id, asin, title, category, amazon_fields_found, amazon_fields_expected, amazon_completeness_pct, amazon_missing_fields, amazon_checked, fender_url, fender_found, fender_fields_found, fender_fields_expected, fender_completeness_pct, fender_missing_fields, checked_at, batch_run_id, created_at, collector_version, fender_page_source, fender_identity_match, fender_variant_sku, fender_spec_values, fender_rating_markup, amazon_spec_values, amazon_gtin, amazon_mpn, amazon_aplus_state, amazon_aplus_image_count, amazon_video_state, amazon_bullet_count, amazon_image_count) VALUES ${vals.join(',\n')};\n`;
  }
  if (!asinList) {
    const extra = JSON.stringify({ last_batch_run_id: batchRunId, last_processed: rows.length, wrapped, collector: COLLECTOR, amazon_checked: results.filter(r => r.amazon_checked).length, fender_found: results.filter(r => r.fender_found).length, from_findability: results.filter(r => r.fender_page_source === 'findability').length, not_found_with_reason: results.filter(r => !r.fender_found && r.fender_missing_fields).length }).replace(/'/g, "''");
    sql += `INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('${JOB}', ${newOffset}, ${TS}, '${extra}'::jsonb, ${TS}) ON CONFLICT (job_key) DO UPDATE SET cursor_offset = EXCLUDED.cursor_offset, last_run_at = EXCLUDED.last_run_at, extra = EXCLUDED.extra, updated_at = EXCLUDED.updated_at;\n`;
  }
  sql += 'COMMIT;\nSELECT 1 AS ok;';
  if (inputs.dryRun) return { dryRun: true, collector: COLLECTOR, results, log };
  await write(sql);

  return { batchRunId, collector: COLLECTOR, processed: rows.length, offset, newOffset, wrapped, results, log, dualWrite: dw };
}