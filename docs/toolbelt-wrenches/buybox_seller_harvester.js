// Buy Box seller harvester, one code body for every client (R-15 decision (a), 23 Nov 2026).
// Saved as fender_buybox_seller_harvester v7 (Fender workspace) and ledlenser_buybox_seller_harvester
// v2 (Ledlenser workspace). The only line that differs between the two saves is DEFAULT_CLIENT.
// A new client is a new CLIENTS entry with its table names, not a new code path.
//
// Pass 1 (unchanged): Keepa Buy Box (sellerId, FBA, new offer count) for live listings never
// checked or last checked more than refreshOlderThanHours ago. Writes buybox_seller,
// buybox_is_fba, offer_count_new, buybox_checked_at on the catalog table and resolves seller names.
// Pass 2 (new): for listings whose Featured Offer is withheld (featured_offer_state on the Buy Box
// map), read Keepa's live offers and store the seller id(s) at the lowest landed New price, the
// offer Amazon is withholding, in withheld_offer_seller_ids / withheld_offer_landed_cents /
// withheld_offer_checked_at (migration 20261123210000). It has its own small time budget after
// pass 1 (withheldBudgetSec, default 60) and a per-run cap (withheldMax, default 20), so the run
// stays inside the workflow step timeout (Fender 300 s with timeBudgetSec 200; Ledlenser 330 s
// with 240). Pass 2 writes production only: the Fender sandbox, mirror and claude copies do not
// have the new columns.
async function run(inputs) {
  const DEFAULT_CLIENT = 'fender';
  const K = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const CLIENTS = {
    fender: {
      wrench: 'fender_buybox_seller_harvester',
      catalog: 'command.fmic_electric_catalog',
      sellers: 'command.fmic_sellers',
      map: 'command.fmic_retail_buybox_map',
      jobState: 'command.fmic_job_state',
      dualWriteErrors: 'command.fmic_dual_write_errors',
      mirrors: [
        { id: '5528f699-8878-4b19-b26b-93ca0ee6bee7', name: 'sandbox' },
        { id: 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532', name: 'mirror' },
        { id: 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c', name: 'claude' }
      ],
      minTokens: 320
    },
    ledlenser: {
      wrench: 'ledlenser_buybox_seller_harvester',
      catalog: 'ledlenser.catalog',
      sellers: 'ledlenser.sellers',
      map: 'ledlenser.retail_buybox_map',
      jobState: 'ledlenser.job_state',
      dualWriteErrors: null,
      mirrors: [],
      minTokens: 600
    }
  };
  const clientKey = String(inputs.client || DEFAULT_CLIENT);
  const C = CLIENTS[clientKey];
  if (!C) throw new Error('Unknown client: ' + clientKey);

  const batchSize = Number(inputs.batchSize || 100);
  const minTokens = Number(inputs.minTokens || C.minTokens);
  const hrs = inputs.refreshOlderThanHours == null ? 20 : Number(inputs.refreshOlderThanHours);
  const maxBatches = Number(inputs.maxBatches || 10);
  const budgetMs = Number(inputs.timeBudgetSec || 240) * 1000;
  const withheldBudgetMs = Number(inputs.withheldBudgetSec == null ? 60 : inputs.withheldBudgetSec) * 1000;
  const withheldMax = Math.max(0, Number(inputs.withheldMax == null ? 20 : inputs.withheldMax));
  const t0 = Date.now();
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
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: {} };
  for (const t of C.mirrors) dw.targets[t.name] = { mirrored: 0, failed: 0 };
  // Production first, then each mirror (non-blocking); a mirror failure is logged, not thrown.
  async function write(q) {
    const res = await sqlOn(SB, q);
    await Promise.all(C.mirrors.map(async t => {
      try { await sqlOn(t.id, q); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        if (C.dualWriteErrors) {
          try { await sqlOn(SB, `INSERT INTO ${C.dualWriteErrors} (wrench, target, error, sql_text) VALUES ('${C.wrench}', '${t.name}', '${esc(String(e.message || e).slice(0, 2000))}', '${esc(q)}')`); } catch (_) {}
        }
      }
    }));
    return res;
  }
  function unwrap(r) {
    if (r == null) return null;
    if (typeof r === 'string') return JSON.parse(r);
    if (typeof r.result === 'string') return JSON.parse(r.result);
    if (Array.isArray(r.content) && r.content[0] && typeof r.content[0].text === 'string') return JSON.parse(r.content[0].text);
    return r;
  }
  const nowTs = () => `'${new Date().toISOString()}'::timestamptz`;
  const num = v => (v == null || isNaN(Number(v))) ? 'NULL' : Math.round(Number(v));
  const staleWhere = hrs > 0
    ? `current_price > 0 AND (buybox_checked_at IS NULL OR buybox_checked_at < now() - interval '${hrs} hours')`
    : `current_price > 0 AND buybox_checked_at IS NULL`;

  // Seller names for ids not yet in the sellers table (up to 15 a call), as one upsert statement.
  async function sellerUpsert(ids, TS) {
    if (!ids.length) return { stmt: null, n: 0 };
    const known = new Set((await sql(`SELECT seller_id FROM ${C.sellers} WHERE seller_id IN (${ids.map(s => `'${esc(s)}'`).join(',')})`)).map(r => r.seller_id));
    const unknown = ids.filter(s => !known.has(s)).slice(0, 15);
    if (!unknown.length) return { stmt: null, n: 0 };
    const sres = await callTool(K, 'get_seller', { sellerIds: unknown, domain: 'com' });
    const list = sres.sellers || Object.values(sres.sellersById || {}) || [];
    const rows = [];
    for (const s of list) {
      const id = s.sellerId || s.id; if (!id) continue;
      const rp = s.currentRatingPercent != null ? s.currentRatingPercent : (s.currentRating != null ? s.currentRating : s.rating);
      const rc = s.currentRatingCount != null ? s.currentRatingCount : s.ratingCount;
      rows.push(`('${esc(id)}', '${esc(s.name || s.sellerName || '')}', ${id === 'ATVPDKIKX0DER'}, ${s.hasFBA === true ? 'TRUE' : (s.hasFBA === false ? 'FALSE' : 'NULL')}, ${num(rp)}, ${num(rc)}, ${TS}, ${TS})`);
    }
    if (!rows.length) return { stmt: null, n: 0 };
    return {
      stmt: `INSERT INTO ${C.sellers} (seller_id, seller_name, is_amazon, is_fba, rating_pct, rating_count, first_seen, updated_at) VALUES ${rows.join(',')} ON CONFLICT (seller_id) DO UPDATE SET seller_name=COALESCE(NULLIF(EXCLUDED.seller_name,''), ${C.sellers}.seller_name), is_fba=COALESCE(EXCLUDED.is_fba, ${C.sellers}.is_fba), rating_pct=COALESCE(EXCLUDED.rating_pct, ${C.sellers}.rating_pct), rating_count=COALESCE(EXCLUDED.rating_count, ${C.sellers}.rating_count), updated_at=EXCLUDED.updated_at;`,
      n: rows.length
    };
  }

  let tok = await callTool(K, 'get_token_status', {});
  const tokensStart = tok && tok.tokensLeft;
  const tot = { batches: 0, processed: 0, returned: 0, distinctSellersSeen: 0, newSellersResolved: 0 };
  let stopReason = 'done';
  const explicitList = Array.isArray(inputs.asins) ? inputs.asins.map(a => String(a || '').trim().toUpperCase()).filter(a => /^[A-Z0-9]{10}$/.test(a)) : [];
  const explicit = explicitList.length > 0;

  // Pass 1: Buy Box seller of record.
  for (let b = 0; b < (explicit ? 1 : maxBatches); b++) {
    if (Date.now() - t0 > budgetMs) { stopReason = 'time_budget'; break; }
    if (b > 0) tok = await callTool(K, 'get_token_status', {});
    if (tok && tok.tokensLeft < minTokens) { stopReason = 'token_floor'; break; }
    const asins = explicit ? explicitList : (await sql(`SELECT asin FROM ${C.catalog} WHERE ${staleWhere} ORDER BY buybox_checked_at ASC NULLS FIRST, sales_rank ASC NULLS LAST LIMIT ${batchSize}`)).map(r => r.asin);
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
    const stmts = updates.map(u => `UPDATE ${C.catalog} SET ${u.set}buybox_checked_at=${TS}, updated_at=${TS} WHERE asin='${esc(u.asin)}';`);
    const up = await sellerUpsert([...sellerIds], TS);
    if (up.stmt) stmts.push(up.stmt);
    await write('BEGIN;\n' + stmts.join('\n') + '\nCOMMIT;');
    tot.batches++; tot.processed += asins.length; tot.returned += returned.size;
    tot.distinctSellersSeen += sellerIds.size; tot.newSellersResolved += up.n;
    if (b === maxBatches - 1) stopReason = 'max_batches';
  }

  // Pass 2: the seller(s) holding a withheld offer.
  const wh = { due: 0, read: 0, failed: 0, noLiveNewOffer: 0, tied: 0, newSellersResolved: 0, stopReason: 'done', errors: [], sample: [] };
  const cents = v => {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  // The offer Amazon withholds is the lowest-landed live New offer. Returns null when the read failed.
  function withheldOffer(res) {
    if (!res || res.offersRetrievedSuccessfully === false || !Array.isArray(res.offers)) return null;
    const live = res.offers.filter(o => o && o.sellerId && o.isLive !== false && /^new$/i.test(String(o.condition || '')));
    const priced = live.map(o => {
      const landed = cents(o.landedPrice);
      const item = cents(o.price);
      const ship = cents(o.shipping);
      return { id: String(o.sellerId), landed: landed != null ? landed : (item != null ? item + (ship || 0) : null) };
    }).filter(o => o.landed != null && o.landed > 0);
    if (!priced.length) return { ids: [], landed: null };
    const low = Math.min(...priced.map(o => o.landed));
    const ids = [...new Set(priced.filter(o => o.landed === low).map(o => o.id))];
    return { ids, landed: low };
  }
  try {
    if (withheldMax > 0) {
      const ageWhere = explicit
        ? `c.asin IN (${explicitList.map(a => `'${a}'`).join(',')})`
        : (hrs > 0
          ? `(c.withheld_offer_checked_at IS NULL OR c.withheld_offer_checked_at < now() - interval '${hrs} hours')`
          : `c.withheld_offer_checked_at IS NULL`);
      const due = (await sql(`SELECT c.asin FROM ${C.catalog} c JOIN ${C.map} m ON m.asin = c.asin
        WHERE m.featured_offer_state = 'withheld' AND c.current_price > 0 AND ${ageWhere}
        ORDER BY c.withheld_offer_checked_at ASC NULLS FIRST, c.asin LIMIT ${withheldMax}`)).map(r => r.asin);
      wh.due = due.length;
      const results = [];
      const deadline = t0 + budgetMs + withheldBudgetMs; // fixed, so an overrun pass 1 shortens pass 2
      let i = 0;
      while (i < due.length) {
        if (Date.now() > deadline) { wh.stopReason = 'time_budget'; break; }
        tok = await callTool(K, 'get_token_status', {});
        if (tok && tok.tokensLeft < minTokens) { wh.stopReason = 'token_floor'; break; }
        const chunk = due.slice(i, i + 3); i += chunk.length;
        await Promise.all(chunk.map(async asin => {
          try {
            const res = unwrap(await callTool(K, 'get_product_offers', { asin, domain: 'com', refreshIfOlderThanHours: 6 }));
            const w = withheldOffer(res);
            if (!w) { wh.failed++; if (wh.errors.length < 5) wh.errors.push(asin + ': offers not retrieved'); return; }
            results.push({ asin, ...w });
          } catch (e) {
            wh.failed++; if (wh.errors.length < 5) wh.errors.push(asin + ': ' + String(e && e.message ? e.message : e).slice(0, 160));
          }
        }));
      }
      if (results.length) {
        const TS = nowTs();
        const ids = [...new Set(results.flatMap(r => r.ids))];
        const up = await sellerUpsert(ids, TS);
        if (up.stmt) await write(up.stmt); // sellers table exists in every copy
        wh.newSellersResolved = up.n;
        const values = results.map(r => `('${esc(r.asin)}', ${r.ids.length ? `ARRAY[${r.ids.map(s => `'${esc(s)}'`).join(',')}]::text[]` : `'{}'::text[]`}, ${r.landed == null ? 'NULL::int' : r.landed})`);
        // Production only: the new columns are not on the Fender mirrors.
        await sql(`UPDATE ${C.catalog} c SET withheld_offer_seller_ids = v.ids, withheld_offer_landed_cents = v.landed, withheld_offer_checked_at = ${TS}
FROM (VALUES ${values.join(',')}) AS v(asin, ids, landed) WHERE c.asin = v.asin;
SELECT 1 AS ok;`);
        for (const r of results) {
          wh.read++;
          if (!r.ids.length) wh.noLiveNewOffer++;
          if (r.ids.length > 1) wh.tied++;
          if (wh.sample.length < 10) wh.sample.push({ asin: r.asin, sellerIds: r.ids, landedCents: r.landed });
        }
      }
    } else {
      wh.stopReason = 'disabled';
    }
  } catch (e) {
    wh.stopReason = 'error';
    wh.errors.push(String(e && e.message ? e.message : e).slice(0, 300));
  }

  const left = await sql(`SELECT count(*)::int n FROM ${C.catalog} WHERE ${staleWhere}`);
  const remaining = (left[0] || {}).n;
  tok = await callTool(K, 'get_token_status', {});
  const withheld = { due: wh.due, read: wh.read, failed: wh.failed, noLiveNewOffer: wh.noLiveNewOffer, tied: wh.tied, newSellersResolved: wh.newSellersResolved, stopReason: wh.stopReason, errors: wh.errors };
  const stats = { ...tot, refreshOlderThanHours: hrs, stopReason, remaining, tokensStart, tokensLeft: tok && tok.tokensLeft, refillRate: tok && tok.refillRate, withheld };
  const TS2 = nowTs();
  await write(`INSERT INTO ${C.jobState} (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('buybox_seller_harvester', 0, ${TS2}, '${esc(JSON.stringify(stats))}'::jsonb, ${TS2}) ON CONFLICT (job_key) DO UPDATE SET last_run_at=EXCLUDED.last_run_at, extra=EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`);
  const out = { success: true, client: clientKey, done: remaining === 0, ...stats, withheldSample: wh.sample, elapsedSec: Math.round((Date.now() - t0) / 1000) };
  if (C.mirrors.length) out.dualWrite = dw;
  return out;
}
