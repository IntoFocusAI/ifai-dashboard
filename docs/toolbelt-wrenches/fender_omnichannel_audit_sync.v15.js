async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const KEEPA = '9a47da1d-3eeb-4393-9a33-8259d3124bcc';
  const WRENCH = 'fender_omnichannel_audit_sync';
  const JOB = 'featured_offer_keepa';
  const esc = s => String(s == null ? '' : s).replace(/'/g, "''");
  const triggerType = esc(inputs.trigger_type || 'scheduled_recompute').slice(0, 50);
  const execId = esc(inputs.workflow_execution_id || ('manual_' + Date.now())).slice(0, 128);
  const runId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

  async function sbqOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = typeof r === 'string' ? r : (r && typeof r.result === 'string' ? r.result : JSON.stringify(r));
    const open = txt.search(/<untrusted-data-[a-f0-9-]+>/);
    const start = open < 0 ? -1 : txt.indexOf('[', open);
    if (start < 0) throw new Error('Supabase error: ' + txt.slice(0, 600));
    let depth = 0, inStr = false, quoted = false;
    for (let i = start; i < txt.length; i++) {
      const ch = txt[i];
      if (inStr) {
        if (quoted) quoted = false;
        else if (ch === '\\') quoted = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) return JSON.parse(txt.slice(start, i + 1));
      }
    }
    throw new Error('Supabase error: unterminated ' + txt.slice(0, 400));
  }
  const sbq = q => sbqOn(SB, q);
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  async function write(q) {
    q = q.replace(/\bnow\(\)/g, `'${new Date().toISOString()}'::timestamptz`);
    const res = await sbqOn(SB, q);
    await Promise.all(MIRRORS.map(async t => {
      try { await sbqOn(t.id, q); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sbqOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES ('${WRENCH}', '${t.name}', '${esc(String(e.message || e).slice(0, 2000))}', '${esc(q)}')`); } catch (_) {}
      }
    }));
    return res;
  }

  const CAT = 'command.fmic_electric_catalog';
  const MAP = 'command.fmic_retail_buybox_map';
  const kpiCte = `WITH k AS (
      SELECT count(*)::int total,
             count(*) FILTER (WHERE current_price IS NOT NULL)::int active,
             count(*) FILTER (WHERE current_price IS NOT NULL AND buybox_seller = 'ATVPDKIKX0DER')::int p1,
             count(*) FILTER (WHERE current_price IS NOT NULL AND buybox_seller IS NULL)::int unh,
             count(*) FILTER (WHERE current_price IS NOT NULL AND is_bundle)::int bnd,
             count(*) FILTER (WHERE is_bundle)::int bnd_all
      FROM ${CAT}),
    v AS (SELECT k.*,
             coalesce(round(100.0 * p1 / nullif(active, 0), 1), 0) bb,
             coalesce(round(100.0 * unh / nullif(active, 0), 1), 0) unhp,
             coalesce(round(100.0 * active / nullif(total, 0), 1), 0) actp
          FROM k)`;

  // map_price is never sourced from a shelf price or a Keepa list price.
  // buybox_status is the seller classification. It never overwrites featured_offer_state.
  const sql = `BEGIN;
${kpiCte}
INSERT INTO command.fmic_audit_runs (id, workflow_execution_id, trigger_type, started_at, completed_at, status, asins_audited, violations_detected, metadata)
SELECT '${runId}', '${execId}', '${triggerType}', now(), now(), 'completed', active, unh,
       jsonb_build_object('source', 'command.fmic_electric_catalog (Supabase recompute v12)', 'total_skus', total, 'active_skus', active, 'amazon_1p_skus', p1, 'unharvested_skus', unh, 'bundle_skus_active', bnd, 'bundle_skus_catalog', bnd_all)
FROM v;

${kpiCte}
INSERT INTO command.fmic_brand_kpi_summary (id, audit_run_id, metric_id, metric_name, metric_value, numeric_value, status_tone, trend_direction, created_at, updated_at)
SELECT md5('${runId}' || x.mid)::uuid, '${runId}', x.mid, x.mname, x.mval, x.mnum, x.tone, 'live', now(), now()
FROM v CROSS JOIN LATERAL (VALUES
  ('buybox_overall', 'Amazon Buy Box Retention (of Active Offers)', v.bb || '%', v.bb, CASE WHEN v.bb < 50 THEN 'danger' ELSE 'success' END),
  ('buybox_unharvested', 'Seller Data Not Yet Harvested (of Active Offers)', v.unhp || '%', v.unhp, 'warning'),
  ('active_offer_coverage', 'Active Offer Coverage (of Full Catalog)', v.actp || '%', v.actp, 'warning'),
  ('bundle_skus', 'Bundle SKUs (Monitored ASIN Sample)', v.bnd::text, v.bnd::numeric, 'warning'),
  ('total_monitored_skus', 'Total Monitored Electric SKUs', v.total::text, v.total::numeric, 'purple'),
  ('active_offer_skus', 'Active Offer SKUs (Monitored ASIN Sample Size)', v.active::text, v.active::numeric, 'purple')
) AS x(mid, mname, mval, mnum, tone);

INSERT INTO command.fmic_division_metrics (id, audit_run_id, division, monitored_skus, buybox_pct, splinter_bundles, schema_sync_pct, created_at, updated_at)
SELECT md5('${runId}' || left(coalesce(category, 'Uncategorized'), 80))::uuid, '${runId}', left(coalesce(category, 'Uncategorized'), 80), count(*)::int,
       coalesce(round(100.0 * count(*) FILTER (WHERE current_price IS NOT NULL AND buybox_seller = 'ATVPDKIKX0DER') / nullif(count(*) FILTER (WHERE current_price IS NOT NULL), 0), 1), 0),
       count(*) FILTER (WHERE is_bundle)::int, 0, now(), now()
FROM ${CAT} GROUP BY left(coalesce(category, 'Uncategorized'), 80);

INSERT INTO ${MAP} AS m (id, audit_run_id, asin, model_name, map_price, offer_price, buybox_status, buybox_winner, created_at, updated_at)
SELECT md5(asin)::uuid, '${runId}', asin, left(coalesce(title, asin), 150), NULL::numeric, current_price,
       CASE WHEN buybox_seller = 'ATVPDKIKX0DER' THEN 'Amazon 1P' WHEN buybox_seller IS NOT NULL THEN '3P Confirmed' ELSE 'Unknown/Not Harvested' END,
       left(buybox_seller, 100), now(), now()
FROM ${CAT} WHERE current_price IS NOT NULL
ON CONFLICT (asin) DO UPDATE SET
  audit_run_id = EXCLUDED.audit_run_id, model_name = EXCLUDED.model_name,
  offer_price = EXCLUDED.offer_price, buybox_status = EXCLUDED.buybox_status, buybox_winner = EXCLUDED.buybox_winner,
  updated_at = EXCLUDED.updated_at;

UPDATE ${MAP} m SET buybox_status = 'No Active Offer', audit_run_id = '${runId}', updated_at = now()
WHERE NOT EXISTS (SELECT 1 FROM ${CAT} c WHERE c.asin = m.asin AND c.current_price IS NOT NULL) AND m.buybox_status <> 'No Active Offer';
COMMIT;
SELECT (SELECT metadata FROM command.fmic_audit_runs WHERE id = '${runId}') meta,
       (SELECT count(*) FROM command.fmic_brand_kpi_summary WHERE audit_run_id = '${runId}') kpis,
       (SELECT count(*) FROM command.fmic_division_metrics WHERE audit_run_id = '${runId}') divisions,
       (SELECT count(*) FROM ${MAP} WHERE audit_run_id = '${runId}') map_rows,
       (SELECT count(*) FROM ${MAP} WHERE buybox_status = 'No Active Offer') no_active_offer;`;

  const out = (await write(sql))[0] || {};
  const meta = typeof out.meta === 'string' ? JSON.parse(out.meta) : (out.meta || {});
  const TS = new Date().toISOString();
  const keepaResult = {
    attempted: 0, written: 0, failed: 0, catalog_no_offer: 0,
    present: 0, withheld: 0, no_active_offer: 0, cep_present: 0, cep_unavailable: 0,
    observed_offer_written: 0,
    stopped_reason: null, tokens_left: null, tokens_start: null, refill_per_minute: null,
    error: null, details: []
  };

  function unwrap(r) {
    if (r == null) return null;
    if (typeof r === 'string') return JSON.parse(r);
    if (typeof r.result === 'string') return JSON.parse(r.result);
    if (Array.isArray(r.content) && r.content[0] && typeof r.content[0].text === 'string') return JSON.parse(r.content[0].text);
    return r;
  }

  const intOrNull = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : null; };

  // One Keepa product response decides the state, the benchmark, AND the offer the
  // benchmark is compared against, so the gap is one observation and not two.
  function classify(p) {
    const stats = p && p.stats;
    const unqualified = stats ? stats.buyBoxIsUnqualified : undefined;
    const hasFlag = unqualified === true || unqualified === false;
    if (!stats || !hasFlag) return { ok: false, error: !stats ? 'no_stats' : 'buybox_flag_missing' };
    const sellerRaw = stats.buyBoxSellerId == null ? null : String(stats.buyBoxSellerId);
    const seller = sellerRaw && sellerRaw !== '-1' && sellerRaw !== '-2' ? sellerRaw : null;
    const current = Array.isArray(stats.current) ? stats.current : null;
    const newCents = current && current.length > 1 ? intOrNull(current[1]) : null;
    const offerCount = Number(stats.totalOfferCount);
    let state = null;
    if (unqualified === true || sellerRaw === '-1') state = 'withheld';
    else if (newCents === -1 && (!Number.isFinite(offerCount) || offerCount <= 0)) state = 'no_active_offer';
    else if (unqualified === false && newCents != null && newCents > 0) state = 'present';
    else return { ok: false, error: 'unclassified_buybox' };

    const raw = Number(p.competitivePriceThreshold);
    const cepPresent = Number.isFinite(raw) && raw > 0;
    const withheld = state === 'withheld' ? true : state === 'present' ? false : null;
    // Observed offer: the current New price from this same response. Shipping is stored
    // only when Keepa reported a Featured Offer shipping amount (never a guess, never 0).
    const observedPrice = state === 'no_active_offer' ? null : (newCents != null && newCents > 0 ? newCents : null);
    const bbShip = stats.buyBoxShipping == null ? null : intOrNull(stats.buyBoxShipping);
    const observedShipping = state === 'present' && bbShip != null && bbShip >= 0 ? bbShip : null;
    return {
      ok: true, state, withheld,
      cep: cepPresent ? Math.round(raw) : null,
      cepState: cepPresent ? 'present' : 'unavailable',
      observedPrice,
      observedShipping,
      observedSeller: state === 'present' ? seller : null,
      source: 'keepa'
    };
  }

  try {
    // v15: the columns exist on prod. Check the catalog first (no table lock) and only run the
    // ALTERs where a column is missing, with a short lock_timeout so a busy table fails fast
    // instead of queueing every reader behind an exclusive lock.
    await write(`DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'command' AND table_name = 'fmic_retail_buybox_map'
        AND column_name IN ('competitive_price_threshold_cents', 'featured_offer_withheld', 'featured_offer_state',
          'featured_offer_checked_at', 'featured_offer_attempted_at', 'featured_offer_source', 'featured_offer_last_error',
          'competitive_external_price_state', 'featured_offer_observed_price_cents', 'featured_offer_observed_shipping_cents',
          'featured_offer_observed_seller')) < 11 THEN
    SET LOCAL lock_timeout = '2s';
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS competitive_price_threshold_cents integer;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_withheld boolean;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_state text;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_checked_at timestamptz;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_attempted_at timestamptz;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_source text;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_last_error text;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS competitive_external_price_state text;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_observed_price_cents integer;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_observed_shipping_cents integer;
    ALTER TABLE ${MAP} ADD COLUMN IF NOT EXISTS featured_offer_observed_seller text;
  END IF;
END $$;
SELECT 1 AS ok;`);

    // Catalog evidence, no paid call. A row with no current catalog price has no current
    // offer, so the withheld boolean and the observed offer no longer apply and are cleared.
    // offer_price is left alone for MAP; the dashboard reads the observed offer instead.
    const marked = await write(`UPDATE ${MAP} m SET
  featured_offer_state = 'no_active_offer',
  featured_offer_source = 'catalog.current_price',
  featured_offer_checked_at = '${TS}'::timestamptz,
  featured_offer_attempted_at = '${TS}'::timestamptz,
  featured_offer_last_error = NULL,
  featured_offer_withheld = NULL,
  featured_offer_observed_price_cents = NULL,
  featured_offer_observed_shipping_cents = NULL,
  featured_offer_observed_seller = NULL
WHERE NOT EXISTS (SELECT 1 FROM ${CAT} c WHERE c.asin = m.asin AND c.current_price IS NOT NULL);
SELECT count(*)::int n FROM ${MAP} m WHERE NOT EXISTS (SELECT 1 FROM ${CAT} c WHERE c.asin = m.asin AND c.current_price IS NOT NULL) AND m.featured_offer_state = 'no_active_offer';`);
    keepaResult.catalog_no_offer = Number((marked[0] || {}).n || 0);

    if (!inputs.skip_keepa) {
      const minTokens = Number(inputs.keepa_min_tokens ?? 180);
      const budgetMs = Number(inputs.keepa_time_budget_sec ?? 150) * 1000;
      const batchSize = Math.max(1, Math.min(20, Number(inputs.batchSize || 20)));
      const freshnessHours = Math.max(1, Number(inputs.freshnessHours || 26));
      const maxBatches = Math.max(1, Number(inputs.maxBatches || 40));
      const explicit = Array.isArray(inputs.asins) ? inputs.asins.map(a => String(a || '').trim().toUpperCase()).filter(a => /^[A-Z0-9]{10}$/.test(a)) : null;
      const t0 = Date.now();

      const status = unwrap(await callTool(KEEPA, 'get_token_status', {}));
      keepaResult.tokens_start = status && typeof status.tokensLeft === 'number' ? status.tokensLeft : null;
      keepaResult.tokens_left = keepaResult.tokens_start;
      keepaResult.refill_per_minute = status && typeof status.refillRatePerMinute === 'number' ? status.refillRatePerMinute : null;
      if (keepaResult.tokens_left == null) {
        keepaResult.stopped_reason = 'token_status_unreadable';
      } else if (keepaResult.tokens_left - minTokens < 3) {
        keepaResult.stopped_reason = 'min_tokens';
      } else {
        let queue = explicit;
        if (!queue) {
          // Tier 0: never checked and failed checks.
          // Tier 1: classified but with no observed offer, so the benchmark gap cannot be derived.
          // Tier 2: due for refresh. The queue always revisits, so a completed pass restarts.
          const sel = await sbq(`SELECT coalesce(json_agg(a.asin ORDER BY a.pri, a.checked NULLS FIRST, a.asin), '[]'::json) AS asins FROM (
            SELECT m.asin,
              CASE
                WHEN m.featured_offer_state IS NULL OR m.featured_offer_state IN ('not_checked', 'check_failed') THEN 0
                WHEN m.featured_offer_state IN ('present', 'withheld') AND m.featured_offer_observed_price_cents IS NULL THEN 1
                ELSE 2
              END AS pri,
              m.featured_offer_checked_at AS checked
            FROM ${MAP} m
            JOIN ${CAT} c ON c.asin = m.asin AND c.current_price IS NOT NULL
            WHERE m.featured_offer_state IS NULL
               OR m.featured_offer_state IN ('not_checked', 'check_failed')
               OR (m.featured_offer_state IN ('present', 'withheld') AND m.featured_offer_observed_price_cents IS NULL)
               OR m.featured_offer_checked_at IS NULL
               OR m.featured_offer_checked_at < now() - interval '${freshnessHours} hours'
            ORDER BY 2, 3 NULLS FIRST, m.asin
            LIMIT ${batchSize * maxBatches}
          ) a;`);
          queue = sel[0] && sel[0].asins;
          if (typeof queue === 'string') queue = JSON.parse(queue);
          queue = (queue || []).filter(a => /^[A-Z0-9]{10}$/.test(a));
        }
        if (!queue.length) keepaResult.stopped_reason = 'complete';

        let batches = 0;
        while (queue.length && !keepaResult.stopped_reason) {
          if (Date.now() - t0 > budgetMs) { keepaResult.stopped_reason = 'time_budget'; break; }
          if (batches >= maxBatches) { keepaResult.stopped_reason = 'max_batches'; break; }
          const affordable = Math.floor((keepaResult.tokens_left - minTokens) / 3);
          if (affordable < 1) { keepaResult.stopped_reason = 'min_tokens'; break; }
          const batch = queue.splice(0, Math.min(batchSize, affordable));
          batches++;
          keepaResult.attempted += batch.length;
          let obj;
          try {
            obj = unwrap(await callTool(KEEPA, 'get_products', { asins: batch, domain: 'com', buybox: true, raw: true, statsDays: 1 }));
          } catch (e) {
            keepaResult.stopped_reason = 'keepa_error';
            keepaResult.error = String(e && e.message ? e.message : e).slice(0, 300);
            break;
          }
          if (obj && obj.apiTokens && typeof obj.apiTokens.left === 'number') keepaResult.tokens_left = obj.apiTokens.left;
          if (!obj || !Array.isArray(obj.products)) {
            keepaResult.stopped_reason = 'keepa_response';
            keepaResult.error = 'product response had no products array';
            break;
          }
          const byAsin = {};
          for (const p of obj.products) if (p && /^[A-Z0-9]{10}$/.test(p.asin || '')) byAsin[p.asin] = p;
          const success = [];
          const failed = [];
          for (const asin of batch) {
            const found = byAsin[asin];
            const c = found ? classify(found) : { ok: false, error: 'missing_from_keepa' };
            if (!c.ok) { failed.push({ asin, error: c.error }); continue; }
            success.push({ asin, ...c });
            if (c.state === 'present') keepaResult.present++;
            else if (c.state === 'withheld') keepaResult.withheld++;
            else if (c.state === 'no_active_offer') keepaResult.no_active_offer++;
            if (c.cepState === 'present') keepaResult.cep_present++;
            else keepaResult.cep_unavailable++;
            if (c.observedPrice != null) keepaResult.observed_offer_written++;
            if (keepaResult.details.length < 25) keepaResult.details.push({ asin, state: c.state, withheld: c.withheld, cep_cents: c.cep, cep_state: c.cepState, observed_cents: c.observedPrice, observed_shipping_cents: c.observedShipping });
          }
          if (success.length) {
            const values = success.map(s => `('${esc(s.asin)}', ${s.cep == null ? 'NULL::int' : s.cep}, ${s.withheld == null ? 'NULL::boolean' : (s.withheld ? 'true::boolean' : 'false::boolean')}, '${s.state}', '${s.cepState}', ${s.observedPrice == null ? 'NULL::int' : s.observedPrice}, ${s.observedShipping == null ? 'NULL::int' : s.observedShipping}, ${s.observedSeller == null ? 'NULL::text' : `'${esc(s.observedSeller).slice(0, 60)}'`})`);
            await write(`UPDATE ${MAP} m SET
  competitive_price_threshold_cents = v.cep,
  featured_offer_withheld = v.withheld,
  featured_offer_state = v.state,
  competitive_external_price_state = v.cep_state,
  featured_offer_observed_price_cents = v.observed_cents,
  featured_offer_observed_shipping_cents = v.observed_shipping,
  featured_offer_observed_seller = v.observed_seller,
  featured_offer_source = 'keepa',
  featured_offer_checked_at = '${TS}'::timestamptz,
  featured_offer_attempted_at = '${TS}'::timestamptz,
  featured_offer_last_error = NULL
FROM (VALUES ${values.join(',')}) AS v(asin, cep, withheld, state, cep_state, observed_cents, observed_shipping, observed_seller)
WHERE m.asin = v.asin;
SELECT 1 AS ok;`);
            keepaResult.written += success.length;
          }
          if (failed.length) {
            // A failure records the attempt and the error. It never rewrites a good state,
            // never sets the withheld boolean, and never writes a zero benchmark.
            const values = failed.map(s => `('${esc(s.asin)}', '${esc(s.error).slice(0, 120)}')`);
            await write(`UPDATE ${MAP} m SET
  featured_offer_attempted_at = '${TS}'::timestamptz,
  featured_offer_last_error = v.err,
  featured_offer_state = CASE WHEN m.featured_offer_state IN ('present', 'withheld', 'no_active_offer') THEN m.featured_offer_state ELSE 'check_failed' END,
  featured_offer_source = CASE WHEN m.featured_offer_state IN ('present', 'withheld', 'no_active_offer') THEN m.featured_offer_source ELSE 'keepa' END
FROM (VALUES ${values.join(',')}) AS v(asin, err)
WHERE m.asin = v.asin;
SELECT 1 AS ok;`);
            keepaResult.failed += failed.length;
            for (const s of failed) if (keepaResult.details.length < 25) keepaResult.details.push({ asin: s.asin, state: 'check_failed', error: s.error });
          }
        }
        if (!keepaResult.stopped_reason) keepaResult.stopped_reason = queue.length ? 'max_batches' : 'complete';
      }
    } else {
      keepaResult.stopped_reason = 'skip_keepa';
    }
  } catch (e) {
    keepaResult.error = String(e && e.message ? e.message : e).slice(0, 400);
    if (!keepaResult.stopped_reason) keepaResult.stopped_reason = 'error';
  }

  let progress = null;
  try {
    const prog = await sbq(`SELECT
      count(*)::int AS population,
      count(*) FILTER (WHERE c.current_price IS NOT NULL)::int AS active,
      count(*) FILTER (WHERE m.featured_offer_state IN ('present','withheld','no_active_offer') AND m.featured_offer_checked_at > now() - interval '26 hours')::int AS fresh,
      count(*) FILTER (WHERE m.featured_offer_state IN ('present','withheld') AND m.featured_offer_observed_price_cents IS NOT NULL AND m.competitive_price_threshold_cents > 0)::int AS comparable,
      count(*) FILTER (WHERE m.featured_offer_state = 'withheld')::int AS withheld,
      count(*) FILTER (WHERE m.featured_offer_state = 'withheld' AND m.competitive_external_price_state = 'present' AND m.competitive_price_threshold_cents > 0 AND m.featured_offer_observed_price_cents > 0 AND (m.featured_offer_observed_price_cents + COALESCE(m.featured_offer_observed_shipping_cents, 0)) > m.competitive_price_threshold_cents)::int AS confirmed_high_price,
      count(*) FILTER (WHERE m.featured_offer_state = 'check_failed')::int AS check_failed,
      count(*) FILTER (WHERE m.featured_offer_state IS NULL OR m.featured_offer_state = 'not_checked')::int AS not_checked,
      count(*) FILTER (WHERE c.current_price IS NOT NULL AND (m.featured_offer_state IS NULL OR m.featured_offer_state IN ('not_checked','check_failed') OR (m.featured_offer_state IN ('present','withheld') AND m.featured_offer_observed_price_cents IS NULL) OR m.featured_offer_checked_at IS NULL OR m.featured_offer_checked_at <= now() - interval '26 hours'))::int AS remaining
    FROM ${MAP} m LEFT JOIN ${CAT} c ON c.asin = m.asin`);
    progress = prog[0] || null;
    const fresh = Number((progress || {}).fresh || 0);
    const extra = {
      version: 12,
      stopped_reason: keepaResult.stopped_reason,
      attempted: keepaResult.attempted,
      written: keepaResult.written,
      failed: keepaResult.failed,
      present: keepaResult.present,
      withheld: keepaResult.withheld,
      no_active_offer: keepaResult.no_active_offer,
      cep_present: keepaResult.cep_present,
      cep_unavailable: keepaResult.cep_unavailable,
      observed_offer_written: keepaResult.observed_offer_written,
      catalog_no_offer: keepaResult.catalog_no_offer,
      tokens_start: keepaResult.tokens_start,
      tokens_left: keepaResult.tokens_left,
      refill_per_minute: keepaResult.refill_per_minute,
      remaining: progress ? Number(progress.remaining) : null,
      comparable: progress ? Number(progress.comparable) : null,
      confirmed_high_price: progress ? Number(progress.confirmed_high_price) : null,
      population: progress ? Number(progress.population) : null,
      active: progress ? Number(progress.active) : null,
      error: keepaResult.error
    };
    await write(`INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at)
VALUES ('${JOB}', ${fresh}, '${TS}'::timestamptz, '${esc(JSON.stringify(extra))}'::jsonb, '${TS}'::timestamptz)
ON CONFLICT (job_key) DO UPDATE SET cursor_offset = EXCLUDED.cursor_offset, last_run_at = EXCLUDED.last_run_at, extra = EXCLUDED.extra, updated_at = EXCLUDED.updated_at;
SELECT 1 AS ok;`);
  } catch (e) {
    keepaResult.error = (keepaResult.error ? keepaResult.error + ' | ' : '') + String(e && e.message ? e.message : e).slice(0, 200);
  }

  return {
    success: !keepaResult.error, audit_run_id: runId,
    total_skus: meta.total_skus, active_skus: meta.active_skus, amazon_1p_skus: meta.amazon_1p_skus,
    unharvested_skus: meta.unharvested_skus, bundle_skus_active: meta.bundle_skus_active, bundle_skus_catalog: meta.bundle_skus_catalog,
    kpis: Number(out.kpis), divisions: Number(out.divisions), map_rows_touched: Number(out.map_rows), no_active_offer: Number(out.no_active_offer),
    keepa: keepaResult, progress, dualWrite: dw
  };
}