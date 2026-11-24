async function run(inputs) {
  const K = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const batchSize = Number(inputs.batchSize || 100);
  const minTokens = Number(inputs.minTokens || 600);
  const hrs = inputs.refreshOlderThanHours == null ? 20 : Number(inputs.refreshOlderThanHours);
  const maxBatches = Number(inputs.maxBatches || 10);
  const budgetMs = Number(inputs.timeBudgetSec || 240) * 1000;
  const t0 = Date.now();
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  async function sql(q) {
    const r = await callTool(SB, 'execute_sql', { query: q });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    if (/error/i.test(txt)) throw new Error('Supabase: ' + txt.slice(0, 500));
    return [];
  }
  const nowTs = () => `'${new Date().toISOString()}'::timestamptz`;
  const num = v => (v == null || isNaN(Number(v))) ? 'NULL' : Math.round(Number(v));
  const staleWhere = hrs > 0
    ? `current_price > 0 AND (buybox_checked_at IS NULL OR buybox_checked_at < now() - interval '${hrs} hours')`
    : `current_price > 0 AND buybox_checked_at IS NULL`;

  let tok = await callTool(K, 'get_token_status', {});
  const tokensStart = tok && tok.tokensLeft;
  const tot = { batches: 0, processed: 0, returned: 0, distinctSellersSeen: 0, newSellersResolved: 0 };
  let stopReason = 'done';
  const explicit = Array.isArray(inputs.asins) && inputs.asins.length;

  for (let b = 0; b < (explicit ? 1 : maxBatches); b++) {
    if (Date.now() - t0 > budgetMs) { stopReason = 'time_budget'; break; }
    if (b > 0) tok = await callTool(K, 'get_token_status', {});
    if (tok && tok.tokensLeft < minTokens) { stopReason = 'token_floor'; break; }
    const asins = explicit ? inputs.asins : (await sql(`SELECT asin FROM ledlenser.catalog WHERE ${staleWhere} ORDER BY buybox_checked_at ASC NULLS FIRST, sales_rank ASC NULLS LAST LIMIT ${batchSize}`)).map(r => r.asin);
    if (!asins.length) { stopReason = 'done'; break; }

    const updates = []; const sellerIds = new Set(); const returned = new Set();
    for (let i = 0; i < asins.length; i += 20) {
      const res = await callTool(K, 'get_products', { asins: asins.slice(i, i + 20), domain: 'com', buybox: true });
      for (const p of (res.products || [])) {
        if (!p.asin) continue;
        returned.add(p.asin);
        const bb = p.buyBox || {};
        if (bb.sellerId) sellerIds.add(bb.sellerId);
        const sid = bb.sellerId ? `'${esc(bb.sellerId)}'` : 'NULL';
        const fba = bb.isFBA === true ? 'TRUE' : bb.isFBA === false ? 'FALSE' : 'NULL';
        const oc = p.offerCounts && p.offerCounts.new != null ? num(p.offerCounts.new) : 'NULL';
        updates.push({ asin: p.asin, set: `buybox_seller=${sid}, buybox_is_fba=${fba}, offer_count_new=${oc}, ` });
      }
    }
    for (const a of asins) if (!returned.has(a)) updates.push({ asin: a, set: '' });

    const TS = nowTs();
    const stmts = updates.map(u => `UPDATE ledlenser.catalog SET ${u.set}buybox_checked_at=${TS}, updated_at=${TS} WHERE asin='${esc(u.asin)}';`);
    let newSellers = 0;
    if (sellerIds.size) {
      const ids = [...sellerIds];
      const known = new Set((await sql(`SELECT seller_id FROM ledlenser.sellers WHERE seller_id IN (${ids.map(s => `'${esc(s)}'`).join(',')})`)).map(r => r.seller_id));
      const unknown = ids.filter(s => !known.has(s)).slice(0, 15);
      if (unknown.length) {
        const sres = await callTool(K, 'get_seller', { sellerIds: unknown, domain: 'com' });
        const list = sres.sellers || Object.values(sres.sellersById || {}) || [];
        const rows = [];
        for (const s of list) {
          const id = s.sellerId || s.id; if (!id) continue;
          const rp = s.currentRatingPercent != null ? s.currentRatingPercent : (s.currentRating != null ? s.currentRating : s.rating);
          const rc = s.currentRatingCount != null ? s.currentRatingCount : s.ratingCount;
          rows.push(`('${esc(id)}', '${esc(s.name || s.sellerName || '')}', ${id === 'ATVPDKIKX0DER'}, ${s.hasFBA === true ? 'TRUE' : (s.hasFBA === false ? 'FALSE' : 'NULL')}, ${num(rp)}, ${num(rc)}, ${TS}, ${TS})`);
        }
        if (rows.length) {
          stmts.push(`INSERT INTO ledlenser.sellers (seller_id, seller_name, is_amazon, is_fba, rating_pct, rating_count, first_seen, updated_at) VALUES ${rows.join(',')} ON CONFLICT (seller_id) DO UPDATE SET seller_name=COALESCE(NULLIF(EXCLUDED.seller_name,''), ledlenser.sellers.seller_name), is_fba=COALESCE(EXCLUDED.is_fba, ledlenser.sellers.is_fba), rating_pct=COALESCE(EXCLUDED.rating_pct, ledlenser.sellers.rating_pct), rating_count=COALESCE(EXCLUDED.rating_count, ledlenser.sellers.rating_count), updated_at=EXCLUDED.updated_at;`);
          newSellers = rows.length;
        }
      }
    }
    await sql('BEGIN;\n' + stmts.join('\n') + '\nCOMMIT;');
    tot.batches++; tot.processed += asins.length; tot.returned += returned.size;
    tot.distinctSellersSeen += sellerIds.size; tot.newSellersResolved += newSellers;
    if (b === maxBatches - 1) stopReason = 'max_batches';
  }

  const left = await sql(`SELECT count(*)::int n FROM ledlenser.catalog WHERE ${staleWhere}`);
  const remaining = (left[0] || {}).n;
  tok = await callTool(K, 'get_token_status', {});
  const stats = { ...tot, refreshOlderThanHours: hrs, stopReason, remaining, tokensStart, tokensLeft: tok && tok.tokensLeft, refillRate: tok && tok.refillRate };
  const TS2 = nowTs();
  await sql(`INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('buybox_seller_harvester', 0, ${TS2}, '${esc(JSON.stringify(stats))}'::jsonb, ${TS2}) ON CONFLICT (job_key) DO UPDATE SET last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`);
  return { success: true, done: remaining === 0, ...stats, elapsedSec: Math.round((Date.now() - t0) / 1000) };
}
