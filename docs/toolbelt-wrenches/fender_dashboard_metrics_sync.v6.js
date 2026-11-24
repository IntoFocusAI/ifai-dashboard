async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const dryRun = !!inputs.dryRun;

  async function sbq(query) {
    const r = await callTool(SB, 'execute_sql', { query });
    const txt = typeof r === 'string' ? r : (r && typeof r.result === 'string' ? r.result : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (!m) throw new Error('Supabase error: ' + txt.slice(0, 600));
    return JSON.parse(m[1]);
  }

  const row = (await sbq(`WITH r AS (
      SELECT audit_run_id FROM command.fmic_brand_kpi_summary WHERE metric_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
    m AS (SELECT
      count(*) total,
      count(*) FILTER (WHERE buybox_status = 'Amazon 1P') a1p,
      count(*) FILTER (WHERE buybox_status = '3P Confirmed') p3,
      count(*) FILTER (WHERE buybox_status = 'Unknown/Not Harvested') unk,
      count(*) FILTER (WHERE wmt_checked_at IS NOT NULL) wmt_chk,
      count(*) FILTER (WHERE wmt_price IS NOT NULL) wmt_px,
      count(*) FILTER (WHERE wmt_leakage < 0) wmt_leak,
      count(*) FILTER (WHERE mf_checked_at IS NOT NULL) mf_chk,
      count(*) FILTER (WHERE mf_price IS NOT NULL) mf_px,
      count(*) FILTER (WHERE mf_leakage < 0) mf_leak,
      round(avg(least(coalesce(wmt_leakage, 0), coalesce(mf_leakage, 0))) FILTER (WHERE wmt_leakage < 0 OR mf_leakage < 0)::numeric, 2) leak_avg
      FROM command.fmic_retail_buybox_map)
    SELECT (SELECT audit_run_id FROM r) run_id,
      (SELECT json_object_agg(metric_id, metric_value) FROM command.fmic_brand_kpi_summary WHERE audit_run_id = (SELECT audit_run_id FROM r)) kpi,
      (SELECT count(DISTINCT division) FROM command.fmic_division_metrics WHERE audit_run_id = (SELECT audit_run_id FROM r)) division_count,
      (SELECT count(*) FROM command.v_fmic_spec_readiness_latest) spec_n,
      (SELECT round(avg(amazon_completeness_pct)::numeric, 1) FROM command.v_fmic_spec_readiness_latest) spec_amz,
      (SELECT round(100.0 * count(*) FILTER (WHERE fender_found) / nullif(count(*), 0), 1) FROM command.v_fmic_spec_readiness_latest) spec_ff_pct,
      (SELECT count(*) FILTER (WHERE fender_found) FROM command.v_fmic_spec_readiness_latest) spec_ff_n,
      (SELECT row_to_json(m) FROM m) map;`))[0] || {};

  const sim = (await sbq(`WITH s AS (SELECT * FROM command.v_fmic_ai_simulations_all),
      r AS (SELECT * FROM s WHERE winner IS NOT NULL AND winner NOT IN ('Error','Unclear'))
    SELECT (SELECT count(*) FROM s) total, (SELECT count(DISTINCT audit_run_id) FROM s) runs,
      (SELECT count(*) FROM r) resolved, (SELECT count(*) FROM r WHERE winner='Fender/Squier') wins,
      (SELECT count(*) FROM s WHERE winner='Unclear') unclear, (SELECT count(*) FROM s WHERE winner='Error' OR winner IS NULL) err,
      (SELECT count(*) FROM s WHERE hallucination_flag) halluc,
      (SELECT row_to_json(x) FROM (SELECT category, count(*) n, round(100.0*count(*) FILTER (WHERE winner='Fender/Squier')/count(*),1) pct FROM r GROUP BY 1 HAVING count(*) >= 10 ORDER BY 3 ASC LIMIT 1) x) weakest;`))[0] || {};

  const kpi = typeof row.kpi === 'string' ? JSON.parse(row.kpi) : (row.kpi || {});
  const mp = typeof row.map === 'string' ? JSON.parse(row.map) : (row.map || {});
  const wk = typeof sim.weakest === 'string' ? JSON.parse(sim.weakest) : (sim.weakest || null);
  const N = v => Number(v || 0);
  const pct = (a, b) => b > 0 ? (Math.round(1000 * a / b) / 10).toFixed(1) : '0.0';
  const fmtInt = n => Number(n).toLocaleString('en-US');
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const total = N(mp.total);
  const computed = {
    total_monitored_skus: kpi.total_monitored_skus || null,
    active_offer_skus: kpi.active_offer_skus || null,
    bundle_skus_active: kpi.bundle_skus || null,
    division_count: row.division_count != null ? Number(row.division_count) : null,
    spec_total_checked: N(row.spec_n),
    spec_avg_amazon_pct: row.spec_amz != null ? Number(row.spec_amz) : null,
    spec_fender_found_pct: row.spec_ff_pct != null ? Number(row.spec_ff_pct) : null,
    spec_fender_found_n: N(row.spec_ff_n),
    bb_total: total, bb_1p: N(mp.a1p), bb_3p: N(mp.p3), bb_unk: N(mp.unk),
    bb_1p_pct: pct(N(mp.a1p), total), bb_3p_pct: pct(N(mp.p3), total), bb_unk_pct: pct(N(mp.unk), total),
    wmt_checked: N(mp.wmt_chk), wmt_priced: N(mp.wmt_px), wmt_leaks: N(mp.wmt_leak),
    mf_checked: N(mp.mf_chk), mf_priced: N(mp.mf_px), mf_leaks: N(mp.mf_leak),
    leak_avg: mp.leak_avg != null ? Number(mp.leak_avg) : null,
    sim_total: N(sim.total), sim_runs: N(sim.runs), sim_resolved: N(sim.resolved), sim_wins: N(sim.wins),
    sim_unclear: N(sim.unclear), sim_err: N(sim.err), sim_halluc: N(sim.halluc),
    sim_win_pct: pct(N(sim.wins), N(sim.resolved)),
    sim_weakest: wk ? { category: cap(wk.category), n: N(wk.n), pct: Number(wk.pct).toFixed(1) } : null,
    source_audit_run_id: row.run_id || null
  };

  if (dryRun) return { dryRun: true, computed };

  const fileRes = await callTool('workspace', 'read_storage_file', { fileName: 'fender-v3-spec.json', raw: true });
  let spec;
  try {
    if (fileRes && fileRes.nodes) spec = fileRes;
    else if (fileRes && fileRes.content && fileRes.content[0] && fileRes.content[0].text) spec = JSON.parse(fileRes.content[0].text);
    else if (typeof fileRes === 'string') spec = JSON.parse(fileRes);
    else return { error: 'unrecognized read_storage_file shape', keys: fileRes ? Object.keys(fileRes) : null };
  } catch (e) { return { error: 'spec.json did not parse: ' + e.message }; }

  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  const byId = id => nodes.find(n => n && n.id === id);
  const updates = [];
  function apply(obj, label, field, value) {
    if (!obj) return;
    const before = JSON.stringify(obj[field]);
    if (before !== JSON.stringify(value)) { obj[field] = value; updates.push({ id: label, field, before, after: JSON.stringify(value) }); }
  }
  const set = (id, field, value) => apply(byId(id), id, field, value);
  const setTip = (id, field, value) => { const n = byId(id); if (n) { n.tooltip = n.tooltip || {}; apply(n.tooltip, id + '.tooltip', field, value); } };
  const tickers = Array.isArray(spec.tickers) ? spec.tickers : [];

  if (computed.spec_total_checked > 0) {
    const active = computed.active_offer_skus || '993';
    set('spoke-specs', 'stats', [`${computed.spec_fender_found_pct}% Found`, '0% Specs']);
    set('spoke-specs', 'meta', `Live Sample: ${computed.spec_total_checked} of ${active}`);
    set('sat-schema', 'stats', ['0% Specs', `${computed.spec_total_checked} Checked`]);
    set('sat-tables', 'stats', [`${computed.spec_avg_amazon_pct}% Amazon`, `${computed.spec_total_checked} Checked`]);
  }

  if (total > 0) {
    const c = computed;
    set('sat-buybox', 'stats', [`${c.bb_1p_pct}% 1P`, `${c.bb_3p_pct}% 3P`]);
    set('sat-buybox', 'meta', `${fmtInt(total)} Active · ${c.bb_unk_pct}% Unharvested`);
    setTip('sat-buybox', 'desc', `Amazon 1P holds the Buy Box on ${c.bb_1p} of ${fmtInt(total)} active listings (${c.bb_1p_pct}%). Third-party sellers hold it on ${c.bb_3p} (${c.bb_3p_pct}%). Seller data not yet harvested for ${c.bb_unk} (${c.bb_unk_pct}%). Source: Supabase command.fmic_retail_buybox_map, refreshed hourly.`);
    set('spoke-retail', 'stats', [`${c.bb_1p_pct}% 1P`, `${fmtInt(total)} Active`]);
    set('spoke-retail', 'meta', `${c.bb_3p_pct}% 3P · ${c.bb_unk_pct}% Unharvested`);
    setTip('spoke-retail', 'desc', `Buy Box ${c.bb_1p_pct}% Amazon 1P of ${fmtInt(total)} active offers; ${c.bb_3p_pct}% held by third-party sellers; ${c.bb_unk_pct}% unharvested. ${c.total_monitored_skus ? fmtInt(c.total_monitored_skus) : ''} catalog SKUs monitored. Brand Registry consolidation with Austin Bazaar & GearTree across the Monitored ASIN Sample.`.replace('  ', ' '));
    const hub = byId('hub');
    if (hub && Array.isArray(hub.stats)) { const s = hub.stats.slice(); s[0] = `${c.bb_1p_pct}% 1P`; set('hub', 'stats', s); }
    apply(tickers.find(t => t && t.id === 'buybox'), 'ticker.buybox', 'label', `Buy Box (Active Offers): <strong>${c.bb_1p_pct}% 1P</strong> (${c.bb_1p} of ${fmtInt(total)} active) · ${c.bb_3p_pct}% 3P`);
  }

  if (computed.bundle_skus_active) {
    const tot = computed.total_monitored_skus ? fmtInt(computed.total_monitored_skus) : '';
    set('sat-asin', 'stats', [`${fmtInt(computed.bundle_skus_active)} Active Bundles`, 'Reviews: not harvested']);
    set('sat-asin', 'meta', `of ${computed.active_offer_skus ? fmtInt(computed.active_offer_skus) : ''} active offers (${tot} catalog)`);
  }

  {
    const c = computed;
    const checked = c.wmt_checked + c.mf_checked, priced = c.wmt_priced + c.mf_priced, leaks = c.wmt_leaks + c.mf_leaks;
    set('sat-map', 'stats', [leaks > 0 && c.leak_avg != null ? `-$${Math.abs(c.leak_avg).toFixed(2)} Avg` : `${leaks} Leaks Found`, `${checked} Checked`]);
    set('sat-map', 'meta', `Walmart ${c.wmt_checked} · Musician's Friend ${c.mf_checked} (Live)`);
    set('sat-map', 'status', leaks > 0 ? 'danger' : 'warning');
    setTip('sat-map', 'desc', `Live off-Amazon MAP checks (non-bundle SKUs, price and title match guardrails). Walmart: ${c.wmt_checked} checked, ${c.wmt_priced} matched with a price, ${c.wmt_leaks} below MAP. Musician's Friend: ${c.mf_checked} checked, ${c.mf_priced} matched, ${c.mf_leaks} below MAP. Coverage grows hourly; the prior 14-ASIN -$39.21 figure was a test fixture and has been retired.`);
  }

  // AI simulation nodes (Phase 5 Step D)
  if (computed.sim_total > 0) {
    const c = computed, w = c.sim_weakest;
    const wTxt = w ? `${w.category} ${w.pct}%` : 'n/a';
    set('sat-prompts', 'title', `${fmtInt(c.sim_total)} SIMS`);
    set('sat-prompts', 'stats', ['34 Prompts x 3 Engines', `${c.sim_win_pct}% Win (of Resolved)`]);
    set('sat-prompts', 'meta', `${fmtInt(c.sim_runs)} Runs · ChatGPT · Perplexity · Gemini`);
    setTip('sat-prompts', 'title', 'Real AI Simulation Battery (All Runs)');
    setTip('sat-prompts', 'desc', `${fmtInt(c.sim_total)} real AI search simulations across ${fmtInt(c.sim_runs)} runs (34 prompts x ChatGPT, Perplexity, Gemini, repeated). Of ${fmtInt(c.sim_resolved)} resolved answers: ${fmtInt(c.sim_wins)} Fender/Squier wins (${c.sim_win_pct}%), ${fmtInt(c.sim_resolved - c.sim_wins)} competitor wins. Excluded: ${c.sim_unclear} unclear, ${c.sim_err} errors. ${c.sim_halluc} answers flagged for spec hallucinations. Source: Supabase command.v_fmic_ai_simulations_all.`);
    set('spoke-aeo', 'stats', [`${c.sim_win_pct}% Win`, `${fmtInt(c.sim_total)} Sims`]);
    set('spoke-aeo', 'meta', `Weakest: ${wTxt}`);
    setTip('spoke-aeo', 'desc', `Real AI win rate: ${c.sim_win_pct}% of ${fmtInt(c.sim_resolved)} resolved simulations (${fmtInt(c.sim_wins)} Fender/Squier wins; ${c.sim_unclear} unclear and ${c.sim_err} errors excluded). Weakest category is ${w ? w.category : 'n/a'} at ${w ? w.pct + '%' : 'n/a'}. Click to inspect all ${fmtInt(c.sim_total)} simulations. Prior 62 Scan/42% Readiness figures were unvalidated placeholders and have been retired.`);
    apply(tickers.find(t => t && t.id === 'aeo'), 'ticker.aeo', 'label', `AI Win Rate: <strong>${c.sim_win_pct}%</strong> · Weakest: <strong>${wTxt}</strong>`);
  }

  if (updates.length === 0) return { noChanges: true, computed };
  await callTool('workspace', 'write_text_file', { fileName: 'fender-v3-spec.json', content: JSON.stringify(spec, null, 2), allowOverwrite: true, contentType: 'application/json' });
  return { computed, updateCount: updates.length, updates, written: true };
}