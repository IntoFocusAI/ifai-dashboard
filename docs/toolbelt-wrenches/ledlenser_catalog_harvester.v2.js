async function run(inputs) {
  const K = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COLLECTOR = 'ledlenser_catalog_harvester_v2';
  const JOB = 'catalog_harvester';
  const mode = inputs.mode === 'seed' ? 'seed' : 'finder';
  const perPage = Math.min(Number(inputs.perPage || 50), 100);
  const maxPages = Number(inputs.maxPages || 1);
  const minTokens = Number(inputs.minTokens || 600);
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
  const cents = v => (typeof v === 'number' && v > 0) ? v / 100 : null;
  const pos = v => (typeof v === 'number' && v > 0) ? v : null;
  const keepaTime = m => (typeof m === 'number' && m > 0) ? new Date((m + 21564000) * 60000).toISOString() : null;
  const AVAIL = { '-1': 'NO_AMAZON_OFFER', '0': 'IN_STOCK', '1': 'PREORDER', '2': 'UNKNOWN', '3': 'BACK_ORDER', '4': 'DELAYED' };
  // 32-bit integer columns: out-of-range values become NULL instead of failing the page.
  const int = v => { const n = parseInt(v, 10); return (isNaN(n) || Math.abs(n) > 2147483647) ? 'NULL' : n; };
  // bigint columns: only safe integers are stored.
  const big = v => { const n = Number(v); return (v == null || !Number.isSafeInteger(n)) ? 'NULL' : n; };
  const setCursor = (n, extra, TS) => `INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('${JOB}', ${n}, ${TS}, '${esc(JSON.stringify(extra))}'::jsonb, ${TS}) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=ledlenser.job_state.extra || EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`;

  const manual = mode === 'finder' && inputs.page !== undefined && inputs.page !== null;
  let page = manual ? Number(inputs.page) : 0;
  if (mode === 'finder' && !manual) {
    const st = await sql(`SELECT cursor_offset FROM ledlenser.job_state WHERE job_key='${JOB}'`);
    page = st[0] ? Number(st[0].cursor_offset) : 0;
  }
  const startPage = page;
  const before = await sql(`SELECT count(*)::int n FROM ledlenser.catalog`);
  let tok = await callTool(K, 'get_token_status', {});
  const tokensStart = tok && tok.tokensLeft;
  const pages = []; let upserted = 0; let contentRows = 0; let wrapped = false; let stopReason = 'max_pages';
  const payloadRefs = []; const payloadErrors = [];
  const loops = manual ? 1 : maxPages;

  for (let n = 0; n < loops; n++) {
    if (Date.now() - t0 > budgetMs) { stopReason = 'time_budget'; break; }
    if (n > 0) tok = await callTool(K, 'get_token_status', {});
    if (tok && tok.tokensLeft < minTokens) { stopReason = 'token_floor'; break; }
    let asins = [];
    if (mode === 'seed') {
      const rows = await sql(`SELECT asin FROM ledlenser.catalog WHERE extracted_at IS NULL ORDER BY asin LIMIT ${perPage}`);
      asins = rows.map(r => r.asin);
      if (!asins.length) { stopReason = 'seed_done'; break; }
    } else {
      const finder = await callTool(K, 'product_finder', { selection: { brand: ['Ledlenser', 'LED Lenser'] }, page, perPage: Math.max(perPage, 50) });
      asins = (finder.asins || []).slice(0, perPage);
      if (!asins.length) {
        const TSw = `'${new Date().toISOString()}'::timestamptz`;
        if (!manual) await sql(setCursor(0, { unit: 'keepa_page', last_page: page, wrapped: true, wrapped_at: new Date().toISOString() }, TSw));
        wrapped = true; stopReason = 'wrapped'; page = 0; break;
      }
    }
    let products = [];
    for (let i = 0; i < asins.length; i += 20) {
      const res = await callTool(K, 'get_products', { asins: asins.slice(i, i + 20), domain: 'com', raw: true });
      if (res && res.products) products = products.concat(res.products);
    }
    const now = new Date().toISOString();
    const TS = `'${now}'::timestamptz`;
    const ref = `raw/keepa/product/${now.slice(0, 10)}/catalog_${mode}_p${String(page).padStart(3, '0')}_${now.replace(/[:.]/g, '-')}.json`;
    let storedRef = null;
    try {
      await callTool('workspace', 'write_text_file', { fileName: ref, content: JSON.stringify({ source: 'keepa.get_products', raw: true, mode, page, collector: COLLECTOR, fetched_at: now, products }), allowOverwrite: false });
      storedRef = ref; payloadRefs.push(ref);
    } catch (e) { payloadErrors.push(String(e.message || e).slice(0, 200)); }

    const values = []; const content = []; const statsRows = [];
    for (const p of products) {
      if (!p.asin) continue;
      const st = (p.stats && p.stats.current) || [];
      const title = p.title || '';
      const cur = cents(st[1]) ?? cents(st[0]);
      const lst = cents(st[4]);
      const tree = Array.isArray(p.categoryTree) ? p.categoryTree : [];
      const category = tree.length ? tree[tree.length - 1].name : null;
      const avail = AVAIL[String(p.availabilityAmazon)] || 'UNKNOWN';
      const upc = (p.upcList && p.upcList[0]) || null;
      const ean = (p.eanList && p.eanList[0]) || null;
      const isBundle = /\bbundle\b|\bcombo\b|\bkit\b|\b\d+\s?-?\s?pack\b|\bwith\b.*\b(battery|batteries|charger|case)\b/i.test(title);
      values.push(`(${q(p.asin)}, ${q(p.model)}, ${q(upc)}, ${q(ean)}, ${q(title)}, ${q(p.brand || 'Ledlenser')}, ${q(p.manufacturer)}, ${q(p.color)}, ${q(category)}, ${q(p.parentAsin)}, ${cur == null ? 'NULL' : cur}, ${lst == null ? 'NULL' : lst}, ${int(pos(st[3]))}, ${int(p.monthlySold)}, ${isBundle}, NULL, ${q(avail)}, ${q('https://www.amazon.com/dp/' + p.asin)}, ${TS}, ${TS}, ${TS})`);

      const imgs = Array.isArray(p.images) ? p.images : [];
      const side = im => Math.min(Number(im.lW) || 0, Number(im.lH) || 0);
      const main = imgs.find(im => im.variant === 'MAIN') || imgs[0];
      const feats = Array.isArray(p.features) ? p.features : [];
      const s = p.stats || {};
      const oos90 = s.outOfStockPercentage90 || [];
      const nv = v => (v == null || Number.isNaN(Number(v))) ? 'NULL' : Number(v);
      const nvi = v => (v == null || Number.isNaN(Number(v)) || Math.abs(Number(v)) > 2147483647) ? 'NULL' : Number(v);
      const dim = v => (typeof v === 'number' && v > 0) ? Math.round(v) : null;
      const tsq = m => keepaTime(m) ? q(keepaTime(m)) : 'NULL';
      const boolq = v => v === true ? 'true' : (v === false ? 'false' : 'NULL');
      const contentExtra = [q(p.partNumber), q(p.parentTitle), j(p.gtinList || null), boolq(p.isRedirectASIN), q(p.style), q(p.size), q(p.type), j(p.materials || null), q(p.salesRankDisplayGroup), nvi(dim(p.packageQuantity)), nvi(dim(p.numberOfItems)), nvi(dim(p.itemLength)), nvi(dim(p.itemWidth)), nvi(dim(p.itemHeight)), nvi(dim(p.itemWeight)), nvi(dim(p.packageLength)), nvi(dim(p.packageWidth)), nvi(dim(p.packageHeight)), nvi(dim(p.packageWeight)), nv(cents(p.fbaFees && p.fbaFees.pickAndPackFee)), nv(pos(p.referralFeePercentage != null ? p.referralFeePercentage : p.referralFeePercent)), nv(cents(p.suggestedLowerPrice)), nv(cents(p.competitivePriceThreshold)), j(p.availabilityAmazonDelay || null), tsq(p.lastPriceChange), tsq(p.lastRatingUpdate), tsq(p.trackingSince), q(p.urlSlug)].join(', ');
      const kc = s.current || [];
      const at = (a, i) => Array.isArray(a) ? a[i] : undefined;
      const rk = v => (typeof v === 'number' && v > 0) ? Math.round(v) : null;
      const cnt = v => (typeof v === 'number' && v >= 0) ? Math.round(v) : null;
      const mmv = (k, i) => { const x = at(s[k], i); return Array.isArray(x) && x[1] > 0 ? x : null; };
      const mmPrice = (k, i) => { const x = mmv(k, i); return x ? nv(cents(x[1])) : 'NULL'; };
      const mmAt = (k, i) => { const x = mmv(k, i); return x ? tsq(x[0]) : 'NULL'; };
      const rating = v => (typeof v === 'number' && v > 0) ? (v / 10).toFixed(1) : 'NULL';
      statsRows.push(`(${q(p.asin)}, ${TS}, ${tsq(p.lastUpdate)}, ${q(COLLECTOR)}, ${q(storedRef)}, ${nvi(rk(kc[3]))}, ${nvi(rk(at(s.avg30, 3)))}, ${nvi(rk(at(s.avg90, 3)))}, ${nvi(rk(at(s.avg180, 3)))}, ${nvi(rk(at(s.avg365, 3)))}, ${nvi(cnt(s.salesRankDrops30))}, ${nvi(cnt(s.salesRankDrops90))}, ${nvi(cnt(s.salesRankDrops180))}, ${nvi(cnt(s.salesRankDrops365))}, ${nv(cents(kc[1]))}, ${nv(cents(at(s.avg30, 1)))}, ${nv(cents(at(s.avg90, 1)))}, ${nv(cents(at(s.avg180, 1)))}, ${nv(cents(at(s.avg365, 1)))}, ${mmPrice('min', 1)}, ${mmAt('min', 1)}, ${mmPrice('max', 1)}, ${mmAt('max', 1)}, ${nv(cents(kc[0]))}, ${nv(cents(at(s.avg90, 0)))}, ${nv(cents(at(s.avg365, 0)))}, ${mmPrice('min', 0)}, ${mmAt('min', 0)}, ${nv(cents(kc[4]))}, ${nv(cents(s.buyBoxPrice) ?? cents(kc[18]))}, ${nv(cents(at(s.avg90, 18)))}, ${nv(cents(at(s.avg365, 18)))}, ${nvi(cnt(kc[11]))}, ${nvi(cnt(at(s.avg90, 11)))}, ${nvi(cnt(s.totalOfferCount))}, ${nvi(cnt(at(s.outOfStockPercentage30, 0)))}, ${nvi(cnt(at(s.outOfStockPercentage90, 0)))}, ${nvi(cnt(at(s.outOfStockPercentage180, 0)))}, ${nvi(cnt(at(s.outOfStockPercentage365, 0)))}, ${nvi(cnt(at(s.outOfStockPercentage30, 1)))}, ${nvi(cnt(at(s.outOfStockPercentage90, 1)))}, ${nvi(cnt(at(s.outOfStockPercentage180, 1)))}, ${nvi(cnt(at(s.outOfStockPercentage365, 1)))}, ${nvi(cnt(s.outOfStockCountAmazon30))}, ${nvi(cnt(s.outOfStockCountAmazon90))}, ${boolq(s.buyBoxIsAmazon)}, ${q(s.buyBoxSellerId)}, ${q(s.buyBoxAvailabilityMessage)}, ${rating(kc[16])}, ${nvi(cnt(kc[17]))}, ${nvi(cnt(p.monthlySold))}, ${typeof s.deltaPercent90_monthlySold === 'number' ? nvi(Math.round(s.deltaPercent90_monthlySold)) : 'NULL'}, ${j(p.stats || null)}, ${TS})`);
      content.push(`(${q(p.asin)}, ${TS}, ${keepaTime(p.lastUpdate) ? q(keepaTime(p.lastUpdate)) : 'NULL'}, ${q(COLLECTOR)}, ${q(storedRef)}, ${q(title)}, ${feats.length}, ${j(feats)}, ${imgs.length}, ${main ? side(main) : 'NULL'}, ${imgs.length ? Math.min(...imgs.map(side)) : 'NULL'}, ${j(imgs.map(im => ({ variant: im.variant, file: im.l, w: im.lW, h: im.lH })))}, ${big(p.categories && p.categories[p.categories.length - 1])}, ${q(tree.map(c => c.name).join(' > '))}, ${j(tree)}, ${big(p.rootCategory)}, ${big(p.salesRankReference)}, ${q(p.websiteDisplayGroup)}, ${q(p.websiteDisplayGroupName)}, ${q(p.itemTypeKeyword)}, ${int(p.productType)}, ${q(p.material)}, ${q(p.parentAsin)}, ${int(p.variationCount)}, ${j(p.variationAsins || null)}, ${p.hasReviews === true ? 'true' : (p.hasReviews === false ? 'false' : 'NULL')}, ${keepaTime(p.listedSince) ? q(keepaTime(p.listedSince)) : 'NULL'}, ${int(oos90[0] >= 0 ? oos90[0] : null)}, ${int(oos90[1] >= 0 ? oos90[1] : null)}, ${int(s.outOfStockCountAmazon30 >= 0 ? s.outOfStockCountAmazon30 : null)}, ${int(s.outOfStockCountAmazon90 >= 0 ? s.outOfStockCountAmazon90 : null)}, ${contentExtra}, ${TS})`);
    }
    const stmts = [];
    if (values.length) {
      stmts.push(`INSERT INTO ledlenser.catalog (asin, model_number, upc, ean, title, brand, manufacturer, color, category, parent_asin, current_price, list_price, sales_rank, monthly_sold, is_bundle, buybox_seller, amazon_stock, product_url, created_at, updated_at, extracted_at) VALUES
${values.join(',\n')}
ON CONFLICT (asin) DO UPDATE SET model_number=COALESCE(EXCLUDED.model_number, ledlenser.catalog.model_number), upc=COALESCE(EXCLUDED.upc, ledlenser.catalog.upc), ean=COALESCE(EXCLUDED.ean, ledlenser.catalog.ean), title=COALESCE(EXCLUDED.title, ledlenser.catalog.title), brand=EXCLUDED.brand, manufacturer=COALESCE(EXCLUDED.manufacturer, ledlenser.catalog.manufacturer), color=COALESCE(EXCLUDED.color, ledlenser.catalog.color), category=COALESCE(EXCLUDED.category, ledlenser.catalog.category), parent_asin=COALESCE(EXCLUDED.parent_asin, ledlenser.catalog.parent_asin), current_price=EXCLUDED.current_price, list_price=EXCLUDED.list_price, sales_rank=EXCLUDED.sales_rank, monthly_sold=EXCLUDED.monthly_sold, is_bundle=EXCLUDED.is_bundle, buybox_seller=COALESCE(EXCLUDED.buybox_seller, ledlenser.catalog.buybox_seller), amazon_stock=EXCLUDED.amazon_stock, product_url=EXCLUDED.product_url, updated_at=EXCLUDED.updated_at, extracted_at=EXCLUDED.extracted_at;`);
      stmts.push(`UPDATE ledlenser.catalog c SET brand_sku = b.sku FROM ledlenser.brand_catalog b WHERE c.brand_sku IS NULL AND c.upc IS NOT NULL AND b.upc = c.upc AND (SELECT count(*) FROM ledlenser.brand_catalog b2 WHERE b2.upc = b.upc) = 1;`);
      stmts.push(`UPDATE ledlenser.catalog c SET brand_sku = b.sku FROM ledlenser.brand_catalog b WHERE c.brand_sku IS NULL AND c.model_number IS NOT NULL AND b.sku = c.model_number;`);
    }
    if (content.length) {
      stmts.push(`INSERT INTO ledlenser.listing_content (asin, checked_at, keepa_last_update, collector_version, raw_payload_ref, title, bullet_count, bullets, image_count, main_image_px, min_image_px, images, category_id, category_path, category_tree, root_category, sales_rank_reference, website_display_group, website_display_group_name, item_type_keyword, product_type_code, material, parent_asin, variation_count, variation_asins, has_reviews, listed_since, amazon_oos_pct_90, new_oos_pct_90, amazon_oos_count_30, amazon_oos_count_90, part_number, parent_title, gtin_list, is_redirect_asin, style, size, product_type_name, materials, sales_rank_display_group, package_quantity, number_of_items, item_length_mm, item_width_mm, item_height_mm, item_weight_g, package_length_mm, package_width_mm, package_height_mm, package_weight_g, fba_pick_pack_fee, referral_fee_pct, suggested_lower_price, competitive_price_threshold, availability_amazon_delay, last_price_change_at, last_rating_update_at, tracking_since, url_slug, updated_at) VALUES
${content.join(',\n')}
ON CONFLICT (asin) DO UPDATE SET checked_at=EXCLUDED.checked_at, keepa_last_update=EXCLUDED.keepa_last_update, collector_version=EXCLUDED.collector_version, raw_payload_ref=EXCLUDED.raw_payload_ref, title=EXCLUDED.title, bullet_count=EXCLUDED.bullet_count, bullets=EXCLUDED.bullets, image_count=EXCLUDED.image_count, main_image_px=EXCLUDED.main_image_px, min_image_px=EXCLUDED.min_image_px, images=EXCLUDED.images, category_id=EXCLUDED.category_id, category_path=EXCLUDED.category_path, category_tree=EXCLUDED.category_tree, root_category=EXCLUDED.root_category, sales_rank_reference=EXCLUDED.sales_rank_reference, website_display_group=EXCLUDED.website_display_group, website_display_group_name=EXCLUDED.website_display_group_name, item_type_keyword=EXCLUDED.item_type_keyword, product_type_code=EXCLUDED.product_type_code, material=EXCLUDED.material, parent_asin=EXCLUDED.parent_asin, variation_count=EXCLUDED.variation_count, variation_asins=EXCLUDED.variation_asins, has_reviews=EXCLUDED.has_reviews, listed_since=EXCLUDED.listed_since, amazon_oos_pct_90=EXCLUDED.amazon_oos_pct_90, new_oos_pct_90=EXCLUDED.new_oos_pct_90, amazon_oos_count_30=EXCLUDED.amazon_oos_count_30, amazon_oos_count_90=EXCLUDED.amazon_oos_count_90, part_number=EXCLUDED.part_number, parent_title=EXCLUDED.parent_title, gtin_list=EXCLUDED.gtin_list, is_redirect_asin=EXCLUDED.is_redirect_asin, style=EXCLUDED.style, size=EXCLUDED.size, product_type_name=EXCLUDED.product_type_name, materials=EXCLUDED.materials, sales_rank_display_group=EXCLUDED.sales_rank_display_group, package_quantity=EXCLUDED.package_quantity, number_of_items=EXCLUDED.number_of_items, item_length_mm=EXCLUDED.item_length_mm, item_width_mm=EXCLUDED.item_width_mm, item_height_mm=EXCLUDED.item_height_mm, item_weight_g=EXCLUDED.item_weight_g, package_length_mm=EXCLUDED.package_length_mm, package_width_mm=EXCLUDED.package_width_mm, package_height_mm=EXCLUDED.package_height_mm, package_weight_g=EXCLUDED.package_weight_g, fba_pick_pack_fee=EXCLUDED.fba_pick_pack_fee, referral_fee_pct=EXCLUDED.referral_fee_pct, suggested_lower_price=EXCLUDED.suggested_lower_price, competitive_price_threshold=EXCLUDED.competitive_price_threshold, availability_amazon_delay=EXCLUDED.availability_amazon_delay, last_price_change_at=EXCLUDED.last_price_change_at, last_rating_update_at=EXCLUDED.last_rating_update_at, tracking_since=EXCLUDED.tracking_since, url_slug=EXCLUDED.url_slug, updated_at=EXCLUDED.updated_at;`);
    }
    if (statsRows.length) {
      const SCOLS = ['asin', 'checked_at', 'keepa_last_update', 'collector_version', 'raw_payload_ref', 'sales_rank_current', 'sales_rank_avg30', 'sales_rank_avg90', 'sales_rank_avg180', 'sales_rank_avg365', 'sales_rank_drops_30', 'sales_rank_drops_90', 'sales_rank_drops_180', 'sales_rank_drops_365', 'new_price_current', 'new_price_avg30', 'new_price_avg90', 'new_price_avg180', 'new_price_avg365', 'new_price_min', 'new_price_min_at', 'new_price_max', 'new_price_max_at', 'amazon_price_current', 'amazon_price_avg90', 'amazon_price_avg365', 'amazon_price_min', 'amazon_price_min_at', 'list_price_current', 'buybox_price_current', 'buybox_price_avg90', 'buybox_price_avg365', 'new_offer_count_current', 'new_offer_count_avg90', 'total_offer_count', 'amazon_oos_pct_30', 'amazon_oos_pct_90', 'amazon_oos_pct_180', 'amazon_oos_pct_365', 'new_oos_pct_30', 'new_oos_pct_90', 'new_oos_pct_180', 'new_oos_pct_365', 'amazon_oos_count_30', 'amazon_oos_count_90', 'buybox_is_amazon', 'buybox_seller_id', 'buybox_availability', 'rating_current', 'review_count_current', 'monthly_sold', 'monthly_sold_delta_pct_90', 'stats', 'updated_at'];
      stmts.push(`INSERT INTO ledlenser.keepa_stats (${SCOLS.join(', ')}) VALUES\n${statsRows.join(',\n')}\nON CONFLICT (asin) DO UPDATE SET ${SCOLS.filter(c => c !== 'asin').map(c => c + '=EXCLUDED.' + c).join(', ')};`);
    }
    if (mode === 'finder' && !manual) stmts.push(setCursor(page + 1, { unit: 'keepa_page', last_page: page, last_count: values.length }, TS));
    if (stmts.length) await sql('BEGIN;\n' + stmts.join('\n') + '\nCOMMIT;');
    pages.push(page); upserted += values.length; contentRows += content.length;
    if (mode === 'finder') page = page + 1;
  }

  const after = await sql(`SELECT count(*)::int n, count(brand_sku)::int linked, count(*) FILTER (WHERE extracted_at IS NULL)::int unharvested FROM ledlenser.catalog`);
  tok = await callTool(K, 'get_token_status', {});
  return { success: true, mode, startPage, pagesHarvested: pages.length, harvestedPages: pages, nextPage: (mode === 'finder' && !manual) ? page : null, wrapped, stopReason, upserted, contentRows, payloadRefs, payloadErrors, newRows: after[0].n - before[0].n, totalCatalogCount: after[0].n, linkedToSheet: after[0].linked, stillUnharvested: after[0].unharvested, tokensStart, tokensLeft: tok && tok.tokensLeft, elapsedSec: Math.round((Date.now() - t0) / 1000) };
}