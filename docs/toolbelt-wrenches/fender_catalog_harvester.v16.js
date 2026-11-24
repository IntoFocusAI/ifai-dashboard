async function run(inputs) {
  const K = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const WRENCH = 'fender_catalog_harvester';
  const COLLECTOR = 'catalog_harvester_v16';
  const perPage = Math.min(Number(inputs.perPage || 60), 100);
  const categoryNode = Number(inputs.categoryNode || 11971381);
  const maxPages = Number(inputs.maxPages || 1);
  const minTokens = Number(inputs.minTokens || 100);
  const budgetMs = Number(inputs.timeBudgetSec || 240) * 1000;
  const t0 = Date.now();
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const q = s => (s == null || s === '') ? 'NULL' : `'${esc(s)}'`;
  const j = v => (v == null) ? 'NULL' : `'${esc(JSON.stringify(v))}'::jsonb`;
  async function sqlOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const sql = query => sqlOn(SB, query); // reads: prod only
  const toSandbox = s => s; // schema mapping hook for future sandbox divergence
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  async function write(query) {
    const res = await sqlOn(SB, query); // prod is authoritative
    await Promise.all(MIRRORS.map(async t => {
      try { await sqlOn(t.id, toSandbox(query)); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES (${q(WRENCH)}, ${q(t.name)}, ${q(String(e.message || e).slice(0, 2000))}, ${q(query)})`); } catch (_) {}
      }
    }));
    return res;
  }
  // Raw Keepa product objects: prices in cents, -1/-2 = no data. stats.current index 0 AMAZON, 1 NEW, 3 SALES rank, 4 LISTPRICE.
  const cents = v => (typeof v === 'number' && v > 0) ? v / 100 : null;
  const pos = v => (typeof v === 'number' && v > 0) ? v : null;
  const keepaTime = m => (typeof m === 'number' && m > 0) ? new Date((m + 21564000) * 60000).toISOString() : null;
  const AVAIL = { '-1': 'NO_AMAZON_OFFER', '0': 'IN_STOCK', '1': 'PREORDER', '2': 'UNKNOWN', '3': 'BACK_ORDER', '4': 'DELAYED' };
  const int = v => { const n = parseInt(v, 10); return isNaN(n) ? 'NULL' : n; };
  const setCursor = (n, extra, TS) => `INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('catalog_harvester', ${n}, ${TS}, '${esc(JSON.stringify(extra))}'::jsonb, ${TS}) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=command.fmic_job_state.extra || EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`;

  const manual = inputs.page !== undefined && inputs.page !== null;
  let page = manual ? Number(inputs.page) : 0;
  if (!manual) {
    const st = await sql(`SELECT cursor_offset FROM command.fmic_job_state WHERE job_key='catalog_harvester'`);
    page = st[0] ? Number(st[0].cursor_offset) : 0;
  }
  const startPage = page;
  const before = await sql(`SELECT count(*)::int n FROM command.fmic_electric_catalog`);
  let tok = await callTool(K, 'get_token_status', {});
  const tokensStart = tok && tok.tokensLeft;
  const pages = []; let upserted = 0; let contentRows = 0; let wrapped = false; let stopReason = 'max_pages';
  const payloadRefs = []; const payloadErrors = [];
  const loops = manual ? 1 : maxPages;

  for (let n = 0; n < loops; n++) {
    if (Date.now() - t0 > budgetMs) { stopReason = 'time_budget'; break; }
    if (n > 0) tok = await callTool(K, 'get_token_status', {});
    if (tok && tok.tokensLeft < minTokens) { stopReason = 'token_floor'; break; }
    const finder = await callTool(K, 'product_finder', { selection: { brand: ['Fender'], categories_include: [categoryNode] }, page, perPage });
    const asins = finder.asins || [];
    if (!asins.length) {
      const TSw = `'${new Date().toISOString()}'::timestamptz`;
      if (!manual) await write(setCursor(0, { unit: 'keepa_page', last_page: page, wrapped: true, wrapped_at: new Date().toISOString() }, TSw));
      wrapped = true; stopReason = 'wrapped'; page = 0; break;
    }
    // raw: true costs the same tokens as the summary and keeps images, bullets, category tree, variations and stock stats.
    let products = [];
    for (let i = 0; i < asins.length; i += 20) {
      const res = await callTool(K, 'get_products', { asins: asins.slice(i, i + 20), domain: 'com', raw: true });
      if (res && res.products) products = products.concat(res.products);
    }
    const now = new Date().toISOString();
    const TS = `'${now}'::timestamptz`;
    // Keep the raw provider response in Toolbelt storage (not Postgres) so later fields can be recovered without re-buying.
    const ref = `raw/keepa/product/${now.slice(0, 10)}/catalog_p${String(page).padStart(3, '0')}_${now.replace(/[:.]/g, '-')}.json`;
    let storedRef = null;
    try {
      await callTool('workspace', 'write_text_file', { fileName: ref, content: JSON.stringify({ source: 'keepa.get_products', raw: true, page, categoryNode, collector: COLLECTOR, fetched_at: now, products }), allowOverwrite: false });
      storedRef = ref; payloadRefs.push(ref);
    } catch (e) { payloadErrors.push(String(e.message || e).slice(0, 200)); }

    const values = [];
    const content = [];
    const statsRows = [];
    for (const p of products) {
      if (!p.asin) continue;
      const st = (p.stats && p.stats.current) || [];
      const title = p.title || '';
      const cur = cents(st[1]) ?? cents(st[0]);
      const lst = cents(st[4]);
      const tree = Array.isArray(p.categoryTree) ? p.categoryTree : [];
      const category = tree.length ? tree[tree.length - 1].name : 'Electric Guitars';
      const avail = AVAIL[String(p.availabilityAmazon)] || 'UNKNOWN';
      const upc = (p.upcList && p.upcList[0]) || null;
      const ean = (p.eanList && p.eanList[0]) || null;
      values.push(`(${q(p.asin)}, ${q(p.model)}, ${q(upc)}, ${q(ean)}, ${q(title)}, ${q(p.brand || 'Fender')}, ${q(p.manufacturer)}, ${q(p.color)}, ${q(category)}, ${q(p.parentAsin)}, ${cur == null ? 'NULL' : cur}, ${lst == null ? 'NULL' : lst}, ${int(pos(st[3]))}, ${int(p.monthlySold)}, ${/bundle|kit|pack|combo/i.test(title)}, NULL, ${q(avail)}, ${q('https://www.amazon.com/dp/' + p.asin)}, ${TS}, ${TS}, ${TS})`);

      const imgs = Array.isArray(p.images) ? p.images : [];
      const side = im => Math.min(Number(im.lW) || 0, Number(im.lH) || 0);
      const main = imgs.find(im => im.variant === 'MAIN') || imgs[0];
      const feats = Array.isArray(p.features) ? p.features : [];
      const s = p.stats || {};
      const oos90 = s.outOfStockPercentage90 || [];
      // Extra raw product fields (v16). Dimensions are mm and g; money fields are cents in Keepa.
      const nv = v => (v == null || Number.isNaN(Number(v))) ? 'NULL' : Number(v);
      const dim = v => (typeof v === 'number' && v > 0) ? Math.round(v) : null;
      const tsq = m => keepaTime(m) ? q(keepaTime(m)) : 'NULL';
      const boolq = v => v === true ? 'true' : (v === false ? 'false' : 'NULL');
      const contentExtra = [q(p.partNumber), q(p.parentTitle), j(p.gtinList || null), boolq(p.isRedirectASIN), q(p.style), q(p.size), q(p.type), j(p.materials || null), q(p.salesRankDisplayGroup), nv(dim(p.packageQuantity)), nv(dim(p.numberOfItems)), nv(dim(p.itemLength)), nv(dim(p.itemWidth)), nv(dim(p.itemHeight)), nv(dim(p.itemWeight)), nv(dim(p.packageLength)), nv(dim(p.packageWidth)), nv(dim(p.packageHeight)), nv(dim(p.packageWeight)), nv(cents(p.fbaFees && p.fbaFees.pickAndPackFee)), nv(pos(p.referralFeePercentage != null ? p.referralFeePercentage : p.referralFeePercent)), nv(cents(p.suggestedLowerPrice)), nv(cents(p.competitivePriceThreshold)), j(p.availabilityAmazonDelay || null), tsq(p.lastPriceChange), tsq(p.lastRatingUpdate), tsq(p.trackingSince), q(p.urlSlug)].join(', ');
      // Keepa stats arrays are indexed by price type: 0 AMAZON, 1 NEW, 3 SALES rank, 4 LIST_PRICE, 11 COUNT_NEW, 16 RATING (x10), 17 COUNT_REVIEWS, 18 BUY_BOX_SHIPPING.
      const kc = s.current || [];
      const at = (a, i) => Array.isArray(a) ? a[i] : undefined;
      const rk = v => (typeof v === 'number' && v > 0) ? Math.round(v) : null;
      const cnt = v => (typeof v === 'number' && v >= 0) ? Math.round(v) : null;
      const mmv = (k, i) => { const x = at(s[k], i); return Array.isArray(x) && x[1] > 0 ? x : null; };
      const mmPrice = (k, i) => { const x = mmv(k, i); return x ? nv(cents(x[1])) : 'NULL'; };
      const mmAt = (k, i) => { const x = mmv(k, i); return x ? tsq(x[0]) : 'NULL'; };
      const rating = v => (typeof v === 'number' && v > 0) ? (v / 10).toFixed(1) : 'NULL';
      statsRows.push(`(${q(p.asin)}, ${TS}, ${tsq(p.lastUpdate)}, ${q(COLLECTOR)}, ${q(storedRef)}, ${nv(rk(kc[3]))}, ${nv(rk(at(s.avg30, 3)))}, ${nv(rk(at(s.avg90, 3)))}, ${nv(rk(at(s.avg180, 3)))}, ${nv(rk(at(s.avg365, 3)))}, ${nv(cnt(s.salesRankDrops30))}, ${nv(cnt(s.salesRankDrops90))}, ${nv(cnt(s.salesRankDrops180))}, ${nv(cnt(s.salesRankDrops365))}, ${nv(cents(kc[1]))}, ${nv(cents(at(s.avg30, 1)))}, ${nv(cents(at(s.avg90, 1)))}, ${nv(cents(at(s.avg180, 1)))}, ${nv(cents(at(s.avg365, 1)))}, ${mmPrice('min', 1)}, ${mmAt('min', 1)}, ${mmPrice('max', 1)}, ${mmAt('max', 1)}, ${nv(cents(kc[0]))}, ${nv(cents(at(s.avg90, 0)))}, ${nv(cents(at(s.avg365, 0)))}, ${mmPrice('min', 0)}, ${mmAt('min', 0)}, ${nv(cents(kc[4]))}, ${nv(cents(s.buyBoxPrice) ?? cents(kc[18]))}, ${nv(cents(at(s.avg90, 18)))}, ${nv(cents(at(s.avg365, 18)))}, ${nv(cnt(kc[11]))}, ${nv(cnt(at(s.avg90, 11)))}, ${nv(cnt(s.totalOfferCount))}, ${nv(cnt(at(s.outOfStockPercentage30, 0)))}, ${nv(cnt(at(s.outOfStockPercentage90, 0)))}, ${nv(cnt(at(s.outOfStockPercentage180, 0)))}, ${nv(cnt(at(s.outOfStockPercentage365, 0)))}, ${nv(cnt(at(s.outOfStockPercentage30, 1)))}, ${nv(cnt(at(s.outOfStockPercentage90, 1)))}, ${nv(cnt(at(s.outOfStockPercentage180, 1)))}, ${nv(cnt(at(s.outOfStockPercentage365, 1)))}, ${nv(cnt(s.outOfStockCountAmazon30))}, ${nv(cnt(s.outOfStockCountAmazon90))}, ${boolq(s.buyBoxIsAmazon)}, ${q(s.buyBoxSellerId)}, ${q(s.buyBoxAvailabilityMessage)}, ${rating(kc[16])}, ${nv(cnt(kc[17]))}, ${nv(cnt(p.monthlySold))}, ${typeof s.deltaPercent90_monthlySold === 'number' ? Math.round(s.deltaPercent90_monthlySold) : 'NULL'}, ${j(p.stats || null)}, ${TS})`);
      content.push(`(${q(p.asin)}, ${TS}, ${keepaTime(p.lastUpdate) ? q(keepaTime(p.lastUpdate)) : 'NULL'}, ${q(COLLECTOR)}, ${q(storedRef)}, ${q(title)}, ${feats.length}, ${j(feats)}, ${imgs.length}, ${main ? side(main) : 'NULL'}, ${imgs.length ? Math.min(...imgs.map(side)) : 'NULL'}, ${j(imgs.map(im => ({ variant: im.variant, file: im.l, w: im.lW, h: im.lH })))}, ${int(p.categories && p.categories[p.categories.length - 1])}, ${q(tree.map(c => c.name).join(' > '))}, ${j(tree)}, ${int(p.rootCategory)}, ${int(p.salesRankReference)}, ${q(p.websiteDisplayGroup)}, ${q(p.websiteDisplayGroupName)}, ${q(p.itemTypeKeyword)}, ${int(p.productType)}, ${q(p.material)}, ${q(p.parentAsin)}, ${int(p.variationCount)}, ${j(p.variationAsins || null)}, ${p.hasReviews === true ? 'true' : (p.hasReviews === false ? 'false' : 'NULL')}, ${keepaTime(p.listedSince) ? q(keepaTime(p.listedSince)) : 'NULL'}, ${int(oos90[0] >= 0 ? oos90[0] : null)}, ${int(oos90[1] >= 0 ? oos90[1] : null)}, ${int(s.outOfStockCountAmazon30 >= 0 ? s.outOfStockCountAmazon30 : null)}, ${int(s.outOfStockCountAmazon90 >= 0 ? s.outOfStockCountAmazon90 : null)}, ${contentExtra}, ${TS})`);
    }
    const stmts = [];
    if (values.length) {
      stmts.push(`INSERT INTO command.fmic_electric_catalog (asin, model_number, upc, ean, title, brand, manufacturer, color, category, parent_asin, current_price, list_price, sales_rank, monthly_sold, is_bundle, buybox_seller, amazon_stock, product_url, created_at, updated_at, extracted_at) VALUES
${values.join(',\n')}
ON CONFLICT (asin) DO UPDATE SET model_number=COALESCE(EXCLUDED.model_number, command.fmic_electric_catalog.model_number), upc=COALESCE(EXCLUDED.upc, command.fmic_electric_catalog.upc), ean=COALESCE(EXCLUDED.ean, command.fmic_electric_catalog.ean), title=COALESCE(EXCLUDED.title, command.fmic_electric_catalog.title), brand=EXCLUDED.brand, manufacturer=COALESCE(EXCLUDED.manufacturer, command.fmic_electric_catalog.manufacturer), color=COALESCE(EXCLUDED.color, command.fmic_electric_catalog.color), category=EXCLUDED.category, parent_asin=COALESCE(EXCLUDED.parent_asin, command.fmic_electric_catalog.parent_asin), current_price=EXCLUDED.current_price, list_price=EXCLUDED.list_price, sales_rank=EXCLUDED.sales_rank, monthly_sold=EXCLUDED.monthly_sold, is_bundle=EXCLUDED.is_bundle, buybox_seller=COALESCE(EXCLUDED.buybox_seller, command.fmic_electric_catalog.buybox_seller), amazon_stock=EXCLUDED.amazon_stock, product_url=EXCLUDED.product_url, updated_at=EXCLUDED.updated_at, extracted_at=EXCLUDED.extracted_at;`);
    }
    if (content.length) {
      stmts.push(`INSERT INTO command.fmic_listing_content (asin, checked_at, keepa_last_update, collector_version, raw_payload_ref, title, bullet_count, bullets, image_count, main_image_px, min_image_px, images, category_id, category_path, category_tree, root_category, sales_rank_reference, website_display_group, website_display_group_name, item_type_keyword, product_type_code, material, parent_asin, variation_count, variation_asins, has_reviews, listed_since, amazon_oos_pct_90, new_oos_pct_90, amazon_oos_count_30, amazon_oos_count_90, part_number, parent_title, gtin_list, is_redirect_asin, style, size, product_type_name, materials, sales_rank_display_group, package_quantity, number_of_items, item_length_mm, item_width_mm, item_height_mm, item_weight_g, package_length_mm, package_width_mm, package_height_mm, package_weight_g, fba_pick_pack_fee, referral_fee_pct, suggested_lower_price, competitive_price_threshold, availability_amazon_delay, last_price_change_at, last_rating_update_at, tracking_since, url_slug, updated_at) VALUES
${content.join(',\n')}
ON CONFLICT (asin) DO UPDATE SET checked_at=EXCLUDED.checked_at, keepa_last_update=EXCLUDED.keepa_last_update, collector_version=EXCLUDED.collector_version, raw_payload_ref=EXCLUDED.raw_payload_ref, title=EXCLUDED.title, bullet_count=EXCLUDED.bullet_count, bullets=EXCLUDED.bullets, image_count=EXCLUDED.image_count, main_image_px=EXCLUDED.main_image_px, min_image_px=EXCLUDED.min_image_px, images=EXCLUDED.images, category_id=EXCLUDED.category_id, category_path=EXCLUDED.category_path, category_tree=EXCLUDED.category_tree, root_category=EXCLUDED.root_category, sales_rank_reference=EXCLUDED.sales_rank_reference, website_display_group=EXCLUDED.website_display_group, website_display_group_name=EXCLUDED.website_display_group_name, item_type_keyword=EXCLUDED.item_type_keyword, product_type_code=EXCLUDED.product_type_code, material=EXCLUDED.material, parent_asin=EXCLUDED.parent_asin, variation_count=EXCLUDED.variation_count, variation_asins=EXCLUDED.variation_asins, has_reviews=EXCLUDED.has_reviews, listed_since=EXCLUDED.listed_since, amazon_oos_pct_90=EXCLUDED.amazon_oos_pct_90, new_oos_pct_90=EXCLUDED.new_oos_pct_90, amazon_oos_count_30=EXCLUDED.amazon_oos_count_30, amazon_oos_count_90=EXCLUDED.amazon_oos_count_90, part_number=EXCLUDED.part_number, parent_title=EXCLUDED.parent_title, gtin_list=EXCLUDED.gtin_list, is_redirect_asin=EXCLUDED.is_redirect_asin, style=EXCLUDED.style, size=EXCLUDED.size, product_type_name=EXCLUDED.product_type_name, materials=EXCLUDED.materials, sales_rank_display_group=EXCLUDED.sales_rank_display_group, package_quantity=EXCLUDED.package_quantity, number_of_items=EXCLUDED.number_of_items, item_length_mm=EXCLUDED.item_length_mm, item_width_mm=EXCLUDED.item_width_mm, item_height_mm=EXCLUDED.item_height_mm, item_weight_g=EXCLUDED.item_weight_g, package_length_mm=EXCLUDED.package_length_mm, package_width_mm=EXCLUDED.package_width_mm, package_height_mm=EXCLUDED.package_height_mm, package_weight_g=EXCLUDED.package_weight_g, fba_pick_pack_fee=EXCLUDED.fba_pick_pack_fee, referral_fee_pct=EXCLUDED.referral_fee_pct, suggested_lower_price=EXCLUDED.suggested_lower_price, competitive_price_threshold=EXCLUDED.competitive_price_threshold, availability_amazon_delay=EXCLUDED.availability_amazon_delay, last_price_change_at=EXCLUDED.last_price_change_at, last_rating_update_at=EXCLUDED.last_rating_update_at, tracking_since=EXCLUDED.tracking_since, url_slug=EXCLUDED.url_slug, updated_at=EXCLUDED.updated_at;`);
    }
    if (statsRows.length) {
      const SCOLS = ['asin', 'checked_at', 'keepa_last_update', 'collector_version', 'raw_payload_ref', 'sales_rank_current', 'sales_rank_avg30', 'sales_rank_avg90', 'sales_rank_avg180', 'sales_rank_avg365', 'sales_rank_drops_30', 'sales_rank_drops_90', 'sales_rank_drops_180', 'sales_rank_drops_365', 'new_price_current', 'new_price_avg30', 'new_price_avg90', 'new_price_avg180', 'new_price_avg365', 'new_price_min', 'new_price_min_at', 'new_price_max', 'new_price_max_at', 'amazon_price_current', 'amazon_price_avg90', 'amazon_price_avg365', 'amazon_price_min', 'amazon_price_min_at', 'list_price_current', 'buybox_price_current', 'buybox_price_avg90', 'buybox_price_avg365', 'new_offer_count_current', 'new_offer_count_avg90', 'total_offer_count', 'amazon_oos_pct_30', 'amazon_oos_pct_90', 'amazon_oos_pct_180', 'amazon_oos_pct_365', 'new_oos_pct_30', 'new_oos_pct_90', 'new_oos_pct_180', 'new_oos_pct_365', 'amazon_oos_count_30', 'amazon_oos_count_90', 'buybox_is_amazon', 'buybox_seller_id', 'buybox_availability', 'rating_current', 'review_count_current', 'monthly_sold', 'monthly_sold_delta_pct_90', 'stats', 'updated_at'];
      stmts.push(`INSERT INTO command.fmic_keepa_stats (${SCOLS.join(', ')}) VALUES\n${statsRows.join(',\n')}\nON CONFLICT (asin) DO UPDATE SET ${SCOLS.filter(c => c !== 'asin').map(c => c + '=EXCLUDED.' + c).join(', ')};`);
    }
    if (!manual) stmts.push(setCursor(page + 1, { unit: 'keepa_page', last_page: page, last_count: values.length }, TS));
    if (stmts.length) await write('BEGIN;\n' + stmts.join('\n') + '\nCOMMIT;');
    pages.push(page); upserted += values.length; contentRows += content.length; page = page + 1;
  }

  const after = await sql(`SELECT count(*)::int n FROM command.fmic_electric_catalog`);
  let csv = null;
  if (inputs.exportCsv) {
    const rows = await sql(`SELECT 'asin,model_number,upc,title,brand,color,current_price,list_price,sales_rank,is_bundle,amazon_stock,product_url' || chr(10) || string_agg(concat_ws(',', asin, coalesce(model_number,''), coalesce(upc,''), '"'||replace(coalesce(title,''),'"','""')||'"', '"'||replace(coalesce(brand,''),'"','""')||'"', '"'||replace(coalesce(color,''),'"','""')||'"', coalesce(current_price::text,''), coalesce(list_price::text,''), coalesce(sales_rank::text,''), coalesce(is_bundle::text,''), coalesce(amazon_stock,''), coalesce(product_url,'')), chr(10) ORDER BY sales_rank ASC NULLS LAST, current_price ASC) AS full_csv FROM command.fmic_electric_catalog`);
    if (rows[0] && rows[0].full_csv) {
      await callTool('workspace', 'write_text_file', { fileName: 'fender_electric_guitars_catalog.csv', content: rows[0].full_csv, allowOverwrite: true });
      csv = rows[0].full_csv.split('\n').length - 1;
    }
  }
  tok = await callTool(K, 'get_token_status', {});
  return { success: true, startPage, pagesHarvested: pages.length, harvestedPages: pages, nextPage: manual ? null : page, wrapped, stopReason, upserted, contentRows, payloadRefs, payloadErrors, newRows: after[0].n - before[0].n, totalCatalogCount: after[0].n, tokensStart, tokensLeft: tok && tok.tokensLeft, elapsedSec: Math.round((Date.now() - t0) / 1000), csvRows: csv, dualWrite: dw };
}