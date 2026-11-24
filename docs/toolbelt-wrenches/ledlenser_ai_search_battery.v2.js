async function run(inputs) {
  const aiServer = 'AI-Search';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COLLECTOR = 'ledlenser_ai_v1';
  const t0 = Date.now();
  const genUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function withTimeout(p, ms, label) { let t; const x = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Timed out after ' + ms + 'ms: ' + label)), ms); }); return Promise.race([p, x]).finally(() => clearTimeout(t)); }
  const parse = r => { const t = typeof r === 'string' ? r : (r && r.result) || JSON.stringify(r); const m = String(t).match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/); return m ? JSON.parse(m[1]) : null; };
  const sbErr = r => { if (!r) return 'no response'; if (r.error) return (r.error.message || JSON.stringify(r.error)).slice(0, 400); const t = JSON.stringify(r); if (/HttpException|Failed to run sql/.test(t) && !/untrusted-data/.test(t)) return t.slice(0, 400); return null; };
  const sql = async q => { const r = await callTool(SB, 'execute_sql', { query: q }); const e = sbErr(r); if (e) throw new Error(e); return parse(r); };
  const sq = s => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/\u0000/g, '').replace(/'/g, "''")}'`;
  const toArr = a => Array.isArray(a) ? a : (a ? String(a).replace(/^\{|\}$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')).filter(Boolean) : []);
  const arr = a => { const v = toArr(a); return v.length ? `ARRAY[${v.map(sq).join(',')}]::text[]` : 'NULL'; };
  const jparse = v => typeof v === 'string' ? JSON.parse(v) : v;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const action = inputs.action || 'status';
  const engines = ['chatgpt', 'perplexity', 'gemini'];
  const FIELDS = ['MAX LUMENS', 'BEAM DISTANCE', 'IP RATING'];
  const ROT_RULE = 'In scope: complete rows of the Ledlenser product sheet (ledlenser.brand_catalog), one product per model, sorted by division and model. Each run takes the models whose index parity equals cycle_no parity (full set every 2 runs); field = first available of FIELDS[(index + cycle_no) mod 3] over MAX LUMENS, BEAM DISTANCE, IP RATING; expected values from the brand sheet (beam distance parsed from key features); models spread round robin over the rotating prompts, one ask per engine.';

  // Config: ledlenser.job_state ai_battery_config (repeats, rotation). Defaults: 3 repeats, rotation on.
  const cfgRow = ((await sql(`SELECT extra FROM ledlenser.job_state WHERE job_key='ai_battery_config'`)) || [])[0];
  const cfg = Object.assign({ repeats: 3, rotation: { active: true } }, cfgRow ? jparse(cfgRow.extra) : {});
  const rotOn = !!(cfg.rotation && cfg.rotation.active === true);
  const cc = ((await sql(`SELECT display_name, brand_name_terms, competitor_brands FROM ledlenser.client_config WHERE client_key='ledlenser'`)) || [])[0];
  if (!cc) return { success: false, error: 'ledlenser.client_config row missing' };
  const BRAND_LABEL = cc.display_name || 'Ledlenser';
  const brandTerms = Array.from(new Set(toArr(cc.brand_name_terms).concat(['led-lenser']).map(s => s.toLowerCase())));
  const competitors = (jparse(cc.competitor_brands) || []).map(c => ({ name: c.name, terms: (c.terms || [c.name]).map(String) }));
  const allPrompts = (await sql(`SELECT prompt_key, prompt_text, category, prompt_kind, active, analytical_intent, headline_denominator, coalesce(probe_mode,'fixed') AS probe_mode, probe_slots FROM ledlenser.ai_prompts ORDER BY prompt_key`)) || [];
  const isRot = p => !!p && p.probe_mode === 'rotating';
  const active = allPrompts.filter(p => p.active === true || p.active === 't' || p.active === 'true');
  const byKey = Object.fromEntries(allPrompts.map(p => [p.prompt_key, p]));
  const hash = ((await sql(`SELECT ledlenser.ai_prompt_set_hash() AS h`)) || [])[0].h;
  const facts = {};
  for (const f of (await sql(`SELECT prompt_key, claim, contradiction_pattern, source_url FROM ledlenser.ai_probe_facts`)) || []) facts[f.prompt_key] = f;

  const SCOPE_SQL = `WITH b AS (SELECT sku, model, division, max_lumens, ip_rating, key_features, datasheet_url FROM ledlenser.brand_catalog WHERE sheet_status = 'Complete' AND model IS NOT NULL),
m AS (SELECT model, min(division) division, min(sku) sku, array_agg(DISTINCT sku) skus, max(max_lumens) lumens, min(ip_rating) ip, min(key_features) kf, min(datasheet_url) src FROM b GROUP BY model),
a AS (SELECT brand_sku, asin FROM ledlenser.catalog WHERE brand_sku IS NOT NULL)
SELECT m.model, m.division, m.sku, m.lumens, m.ip, m.kf, m.src, (SELECT array_agg(DISTINCT a.asin ORDER BY a.asin) FROM a WHERE a.brand_sku = ANY(m.skus)) asins FROM m ORDER BY m.division, m.model`;
  const beamOf = kf => { const m = String(kf || '').match(/beam (?:range|distance)[^|]*?(\d[\d,]*)\s?m\b/i); return m ? Number(m[1].replace(/,/g, '')) : null; };
  const QT = {
    'MAX LUMENS': x => `What is the maximum light output in lumens of the ${x}?`,
    'BEAM DISTANCE': x => `What is the maximum beam distance of the ${x}?`,
    'IP RATING': x => `What is the IP rating of the ${x}?`,
  };
  const expectedFor = (x, f) => f === 'MAX LUMENS' ? (x.lumens ? String(x.lumens) : null) : f === 'BEAM DISTANCE' ? (beamOf(x.kf) ? beamOf(x.kf) + ' m' : null) : (x.ip ? String(x.ip).trim() : null);
  function buildPlan(list, cycleNo, rotPrompts) {
    const chosen = [];
    list.forEach((x, idx) => {
      if (idx % 2 !== cycleNo % 2) return;
      let field = null, expected = null;
      for (let s = 0; s < FIELDS.length; s++) { const f = FIELDS[(idx + cycleNo + s) % FIELDS.length]; const e = expectedFor(x, f); if (e) { field = f; expected = e; break; } }
      if (!field) return;
      const asins = toArr(x.asins);
      chosen.push({ idx, field, spec_field: field, question: QT[field]('Ledlenser ' + String(x.model).trim()), expected, source_url: x.src || null, asin: asins[0] || null, asins, sku: x.sku || null, category: x.division || null, series: String(x.model).trim() });
    });
    const keys = rotPrompts.map(p => p.prompt_key);
    const cap = Object.fromEntries(rotPrompts.map(p => [p.prompt_key, Math.max(1, Number(p.probe_slots || 30))]));
    const slots = Object.fromEntries(keys.map(k => [k, 0]));
    const rows = [];
    let j = 0;
    for (const c of chosen) {
      let placed = false;
      for (let t = 0; t < keys.length && !placed; t++) {
        const k = keys[(j + t) % keys.length];
        if (slots[k] < cap[k]) { slots[k]++; rows.push(Object.assign({ prompt_key: k, repeat_no: slots[k] }, c)); placed = true; j = (j + t + 1) % keys.length; }
      }
      if (!placed) break;
    }
    return { rows, slots, eligible: chosen.length };
  }

  async function startRun() {
    const running = ((await sql(`SELECT id FROM ledlenser.audit_runs WHERE run_kind='ai_simulation' AND NOT is_published AND run_state='running' AND started_at > now() - interval '20 hours' ORDER BY started_at DESC LIMIT 1`)) || [])[0];
    if (running) return { success: true, action: 'start', already_running: running.id, note: 'a run is already in progress; not starting another' };
    const rotPromptsActive = active.filter(isRot);
    const useRot = rotOn && rotPromptsActive.length > 0;
    const repeats = Math.max(1, Math.min(50, Number(inputs.repeats || cfg.repeats || 3)));
    const runP = useRot ? active : active.filter(p => !isRot(p));
    const fixedN = runP.filter(p => !isRot(p)).length;
    if (!fixedN) return { success: false, error: 'no active fixed prompts in ledlenser.ai_prompts' };
    const runId = genUUID(), ts = new Date().toISOString();
    const meta = { source: 'ledlenser_ai_search_battery', collector: COLLECTOR, repeats, prompt_keys: runP.map(p => p.prompt_key), brand_terms: brandTerms, competitors: competitors.map(c => c.name) };
    let expected = fixedN * engines.length * repeats, planSql = '', cursorSql = '';
    if (useRot) {
      const stRow = ((await sql(`SELECT cursor_offset FROM ledlenser.job_state WHERE job_key='ai_probe_rotation'`)) || [])[0];
      const cycleNo = (stRow ? Number(stRow.cursor_offset) : 0) + 1;
      const list = (await sql(SCOPE_SQL)) || [];
      if (list.length < 2) return { success: false, error: 'in-scope model list is empty' };
      const pl = buildPlan(list, cycleNo, runP.filter(isRot));
      const totalSlots = Object.values(pl.slots).reduce((a, b) => a + b, 0);
      expected += totalSlots * engines.length;
      meta.rotating_slots = pl.slots;
      meta.probe_rotation = { rule: ROT_RULE, cycle_no: cycleNo, in_scope_models: list.length, products_this_run: totalSlots, runs_per_full_cycle: 2, asks_per_engine: 1, fields: FIELDS, rotating_prompts: Object.keys(pl.slots) };
      if (pl.rows.length) planSql = `INSERT INTO ledlenser.ai_probe_plan (audit_run_id, prompt_key, repeat_no, asin, asins, sku, category, series, spec_field, question, expected_value, source_url) VALUES\n` + pl.rows.map(r => `(${sq(runId)}, ${sq(r.prompt_key)}, ${r.repeat_no}, ${sq(r.asin)}, ${arr(r.asins)}, ${sq(r.sku)}, ${sq(r.category)}, ${sq(r.series)}, ${sq(r.spec_field)}, ${sq(r.question)}, ${sq(r.expected)}, ${sq(r.source_url)})`).join(',\n') + `\nON CONFLICT (audit_run_id, prompt_key, repeat_no) DO NOTHING;`;
      cursorSql = `INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES ('ai_probe_rotation', ${cycleNo}, ${sq(ts)}, jsonb_build_object('last_run_id', ${sq(runId)}, 'last_cycle_no', ${cycleNo}), ${sq(ts)}) ON CONFLICT (job_key) DO UPDATE SET cursor_offset=EXCLUDED.cursor_offset, last_run_at=EXCLUDED.last_run_at, extra=ledlenser.job_state.extra || EXCLUDED.extra, updated_at=EXCLUDED.updated_at;`;
    }
    const runSql = `INSERT INTO ledlenser.audit_runs (id, workflow_execution_id, trigger_type, started_at, status, metadata, run_kind, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls, answered_calls, error_calls, is_published) VALUES (${sq(runId)}, ${sq('ledlenser_ai_' + runId)}, ${sq(inputs.trigger_type || 'scheduled')}, ${sq(ts)}, 'running', ${sq(JSON.stringify(meta))}::jsonb, 'ai_simulation', 'running', ${sq(COLLECTOR)}, ${sq(hash)}, ${expected}, 0, 0, 0, false);`;
    await sql(`BEGIN;\n${runSql}\n${planSql}\n${cursorSql}\nCOMMIT;\nSELECT 1 ok;`);
    return { success: true, action: 'start', audit_run_id: runId, repeats, expected_calls: expected, prompt_set_hash: hash, rotation: useRot ? { cycle_no: meta.probe_rotation.cycle_no, slots: meta.rotating_slots } : null };
  }

  if (action === 'start') return await startRun();
  if (action === 'plan_preview') {
    const rp = active.filter(isRot);
    const stRow = ((await sql(`SELECT cursor_offset FROM ledlenser.job_state WHERE job_key='ai_probe_rotation'`)) || [])[0];
    const cycleNo = Number(inputs.cycle_no || ((stRow ? Number(stRow.cursor_offset) : 0) + 1));
    const list = (await sql(SCOPE_SQL)) || [];
    const pl = buildPlan(list, cycleNo, rp);
    const byField = {}; pl.rows.forEach(r => { byField[r.field] = (byField[r.field] || 0) + 1; });
    const reps = Math.max(1, Math.min(50, Number(cfg.repeats || 3)));
    const fixedN = active.filter(p => !isRot(p)).length;
    return { success: true, action, rotation_active: rotOn, cycle_no: cycleNo, in_scope_models: list.length, products_this_run: pl.rows.length, slots: pl.slots, by_field: byField, repeats: reps, expected_calls: fixedN * 3 * reps + pl.rows.length * 3, sample: pl.rows.slice(0, 6).map(r => ({ prompt_key: r.prompt_key, repeat_no: r.repeat_no, question: r.question, expected: r.expected, asins: r.asins })) };
  }

  async function loadRun(runId) {
    const runRow = ((await sql(`SELECT id, prompt_set_hash, metadata, is_published, run_state FROM ledlenser.audit_runs WHERE id=${sq(runId)}`)) || [])[0];
    if (!runRow) return null;
    const meta = jparse(runRow.metadata) || {};
    const repeats = Math.max(1, Number(meta.repeats || 1));
    const runPrompts = Array.isArray(meta.prompt_keys) ? meta.prompt_keys.map(k => byKey[k]).filter(Boolean) : active.filter(p => !isRot(p));
    const slots = meta.rotating_slots || {};
    const fixedIdx = [], rotIdx = [];
    runPrompts.forEach((p, i) => (isRot(p) ? rotIdx : fixedIdx).push(i));
    const rotCells = rotIdx.reduce((a, i) => a + Number(slots[runPrompts[i].prompt_key] || 0), 0);
    const expected = fixedIdx.length * engines.length * repeats + rotCells * engines.length;
    const parts = [];
    if (fixedIdx.length) parts.push(`SELECT r, i, k, r*1000+i*10+k+1 AS sid FROM generate_series(1,${repeats}) r, unnest(ARRAY[${fixedIdx.join(',')}]::int[]) i, generate_series(0,2) k`);
    for (const i of rotIdx) { const s = Number(slots[runPrompts[i].prompt_key] || 0); if (s > 0) parts.push(`SELECT r, ${i} AS i, k, r*1000+${i}*10+k+1 AS sid FROM generate_series(1,${s}) r, generate_series(0,2) k`); }
    const gridSql = parts.length ? parts.join(' UNION ALL ') : 'SELECT 1 AS r, 0 AS i, 0 AS k, 0 AS sid WHERE false';
    return { runId, runRow, meta, repeats, runPrompts, slots, expected, gridSql, minPerEngine: Math.ceil(0.7 * expected / engines.length), sweepStartedAt: meta.sweep_started_at || null };
  }

  async function statusOf(ctx) {
    const rid = sq(ctx.runId);
    const c = (await sql(`SELECT count(*) AS n, count(*) FILTER (WHERE call_status='answered') AS answered, count(*) FILTER (WHERE call_status='error') AS errors, count(*) FILTER (WHERE outcome='unresolved') AS unresolved, (SELECT count(*) FROM ledlenser.ai_citations WHERE audit_run_id=${rid}) AS cites${ctx.sweepStartedAt ? `, count(*) FILTER (WHERE call_status='error' AND updated_at < ${sq(ctx.sweepStartedAt)}::timestamptz) AS sweep_remaining` : ''} FROM ledlenser.ai_simulations WHERE audit_run_id=${rid}`))[0];
    const pe = (await sql(`SELECT engine, count(*) AS n, count(*) FILTER (WHERE call_status='answered') AS answered, count(*) FILTER (WHERE call_status='error') AS errors FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} GROUP BY engine ORDER BY engine`)) || [];
    const per_engine = Object.fromEntries(pe.map(r => [r.engine, { rows: Number(r.n), answered: Number(r.answered), errors: Number(r.errors) }]));
    const n = Number(c.n), answered = Number(c.answered), errors = Number(c.errors);
    const engines_below_min = engines.filter(e => (per_engine[e] ? per_engine[e].answered : 0) < ctx.minPerEngine);
    const hash_matches = ctx.runRow.prompt_set_hash === hash;
    return { rows: n, answered, errors, unresolved: Number(c.unresolved), citation_rows: Number(c.cites), expected_calls: ctx.expected, missing_rows: ctx.expected - n, sweep_started_at: ctx.sweepStartedAt, sweep_remaining: ctx.sweepStartedAt ? Number(c.sweep_remaining) : null, is_published: !!ctx.runRow.is_published, run_state: ctx.runRow.run_state, per_engine, engines_below_min, hash_matches, publishable: hash_matches && n > 0 && answered > 0 };
  }
  async function beginSweep(ctx) {
    if (ctx.sweepStartedAt) return { sweep_started_at: ctx.sweepStartedAt, note: 'already started' };
    const ts = new Date().toISOString();
    await sql(`UPDATE ledlenser.audit_runs SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('sweep_started_at', ${sq(ts)}) WHERE id=${sq(ctx.runId)} AND NOT is_published; SELECT 1 ok;`);
    ctx.sweepStartedAt = ts;
    return { sweep_started_at: ts };
  }
  async function finalize(ctx) {
    const s = await statusOf(ctx);
    const state = (s.answered === ctx.expected && s.errors === 0) ? 'completed' : (s.answered > 0 ? 'partial' : 'failed');
    await sql(`UPDATE ledlenser.audit_runs SET run_state=${sq(state)}, status=${sq(state === 'failed' ? 'failed' : 'completed')}, completed_at=${sq(new Date().toISOString())}, attempted_calls=${s.rows}, answered_calls=${s.answered}, error_calls=${s.errors}, expected_calls=${ctx.expected} WHERE id=${sq(ctx.runId)} AND NOT is_published; SELECT 1 ok;`);
    return { run_state: state, attempted: s.rows, answered: s.answered, errors: s.errors, expected_calls: ctx.expected, per_engine: s.per_engine, engines_below_min: s.engines_below_min, publishable: s.publishable && state !== 'failed' };
  }
  async function publish(ctx) {
    try { await sql(`SELECT ledlenser.ai_publish_run(${sq(ctx.runId)}::uuid) AS ok;`); }
    catch (e) { return { published: false, error: String(e.message || e).slice(0, 300) }; }
    const cur = ((await sql(`SELECT audit_run_id FROM ledlenser.canvas_ai_current_run`)) || [])[0];
    return { published: true, current_run: cur ? cur.audit_run_id : null };
  }

  // Grading of rotating fact checks: none when the brand-sheet value appears, suspected when a different value for the same field appears, else not_evaluated. Never confirmed.
  const snip = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const wins = (t, re, span) => Array.from(t.matchAll(re)).map(m => t.slice(Math.max(0, m.index - span), m.index + m[0].length + span));
  const num = s => Number(String(s).replace(/,/g, ''));
  function grade(field, expected, text) {
    const t = String(text || '');
    if (field === 'MAX LUMENS') {
      const exp = parseInt(String(expected).replace(/,/g, ''), 10); if (!exp) return { mh: 'not_evaluated' };
      const ms = Array.from(t.matchAll(/(\d{1,3}(?:,\d{3})+|\d{2,6})\s*(?:lm|lumens?)\b/gi));
      const got = ms.map(m => num(m[1]));
      if (got.includes(exp)) return { mh: 'none' };
      if (ms.length) return { mh: 'suspected', ev: snip(t.slice(Math.max(0, ms[0].index - 80), ms[0].index + 120)) };
      return { mh: 'not_evaluated' };
    }
    if (field === 'BEAM DISTANCE') {
      const exp = num(String(expected).replace(/[^\d,.]/g, '')); if (!exp) return { mh: 'not_evaluated' };
      const lens = s => { const out = []; for (const m of s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:m|meters?|metres?)\b/gi)) out.push(num(m[1])); for (const m of s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot)\b/gi)) out.push(num(m[1]) * 0.3048); return out; };
      const close = a => a.some(v => Math.abs(v - exp) <= Math.max(2, exp * 0.03));
      const near = wins(t, /beam|throw|distance|range|reach/gi, 80);
      const got = near.flatMap(lens).filter(v => v >= 5 && v <= 3000);
      if (close(got) || close(lens(t))) return { mh: 'none' };
      if (got.length) return { mh: 'suspected', ev: snip(near.find(w => lens(w).some(v => v >= 5 && v <= 3000)) || near[0]) };
      return { mh: 'not_evaluated' };
    }
    if (field === 'IP RATING') {
      const exp = String(expected || '').toUpperCase().replace(/\s|-/g, ''); if (!/^IP[0-9X]{2}$/.test(exp)) return { mh: 'not_evaluated' };
      const ms = Array.from(t.matchAll(/\bIP\s?-?([0-9X]{2})\b/gi));
      const got = ms.map(m => 'IP' + m[1].toUpperCase());
      if (got.includes(exp)) return { mh: 'none' };
      if (ms.length) return { mh: 'suspected', ev: snip(t.slice(Math.max(0, ms[0].index - 80), ms[0].index + 120)) };
      return { mh: 'not_evaluated' };
    }
    return { mh: 'not_evaluated' };
  }

  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Common-word brand names (Coast, Klein) are only counted when capitalized.
  const CASED = new Set(['coast', 'klein']);
  const termRe = term => CASED.has(term.toLowerCase()) ? new RegExp('\\b' + reEsc(term.charAt(0).toUpperCase() + term.slice(1)) + '\\b', 'g') : new RegExp('\\b' + reEsc(term).replace(/\\? /g, '[\\s-]?') + '\\b', 'gi');
  // Each mention counts once, even when several terms match it: "Ledlenser" matches both "ledlenser"
  // and "led lenser"; "Klein Tools" matches both "Klein" and "Klein Tools".
  const countMentions = (text, terms) => {
    const spans = [];
    for (const t of terms) for (const m of text.matchAll(termRe(t))) spans.push([m.index, m.index + m[0].length]);
    spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    let n = 0, end = -1;
    for (const [s, e] of spans) { if (s >= end) { n++; end = e; } else if (e > end) end = e; }
    return n;
  };
  function score(text) {
    const fam = countMentions(text, brandTerms);
    const comp = competitors.map(c => ({ c: c.name, n: countMentions(text, c.terms) })).sort((a, b) => b.n - a.n);
    const top = comp[0] || { c: null, n: 0 };
    if (fam === 0 && top.n === 0) return { outcome: 'unresolved', brand: null, label: 'Unclear' };
    if (fam > top.n) return { outcome: 'brand_win', brand: BRAND_LABEL, label: BRAND_LABEL };
    if (top.n > fam) return { outcome: 'competitor_win', brand: top.c, label: top.c };
    return { outcome: 'unresolved', brand: null, label: 'Unclear' };
  }
  const domainOf = u => { const m = String(u).match(/^https?:\/\/(?:www\.)?([^\/:?#\s]+)/i); return m ? m[1].toLowerCase() : null; };

  async function rescore(ctx) {
    if (ctx.runRow.is_published) return { success: false, error: 'run is published; rescore is not allowed' };
    const rid = sq(ctx.runId);
    const rows = (await sql(`SELECT id, answer_text, outcome, primary_brand FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND call_status='answered' AND coalesce(prompt_kind,'') <> 'probe' AND answer_text IS NOT NULL`)) || [];
    const stmts = [];
    for (const r of rows) {
      const sc = score(String(r.answer_text));
      if (sc.outcome === r.outcome && (sc.brand || null) === (r.primary_brand || null)) continue;
      stmts.push(`UPDATE ledlenser.ai_simulations SET outcome=${sq(sc.outcome)}, primary_brand=${sq(sc.brand)}, winner=${sq(sc.label)}, brand_win_rate=${sc.outcome === 'brand_win' ? 100 : 0}, updated_at=${sq(new Date().toISOString())} WHERE id=${sq(r.id)};`);
    }
    for (let i = 0; i < stmts.length; i += 100) await sql('BEGIN;\n' + stmts.slice(i, i + 100).join('\n') + '\nCOMMIT;\nSELECT 1 ok;');
    const after = (await sql(`SELECT engine, count(*) FILTER (WHERE outcome='brand_win') AS brand_wins, count(*) FILTER (WHERE outcome='competitor_win') AS competitor_wins, count(*) FILTER (WHERE outcome='unresolved') AS unresolved FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND call_status='answered' GROUP BY 1 ORDER BY 1`)) || [];
    return { success: true, checked: rows.length, changed: stmts.length, by_engine: after };
  }

  async function chunk(ctx, mode) {
    if (ctx.runRow.is_published) return { success: false, error: 'run is published; chunks are not allowed' };
    if (!['missing', 'errors', 'any'].includes(mode)) return { success: false, error: 'mode must be missing, errors or any' };
    if (mode === 'errors' && !ctx.sweepStartedAt) return { success: false, error: 'run begin_sweep before chunk mode errors' };
    const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, n)) : d; };
    const size = clamp(inputs.size, 1, 300, 60);
    const batchSize = clamp(inputs.batchSize, 1, 5, 5);
    const concurrency = clamp(inputs.concurrency, 1, 10, 4);
    const maxTries = clamp(inputs.maxTries, 1, 3, 2);
    const callTimeout = { gemini: 150000, chatgpt: 200000, perplexity: 270000 };
    const budgetMs = Math.max(60000, Number(inputs.budgetMs || 420000));
    const deadline = t0 + budgetMs;
    const MIN_CALL_MS = 45000;
    const rid = sq(ctx.runId);
    const cond = mode === 'missing' ? 's.id IS NULL'
      : mode === 'errors' ? `s.call_status = 'error' AND s.updated_at < ${sq(ctx.sweepStartedAt)}::timestamptz`
      : `s.id IS NULL OR s.call_status IS DISTINCT FROM 'answered'`;
    const pending = await sql(`WITH g AS (${ctx.gridSql}) SELECT g.r, g.i, g.k, g.sid FROM g LEFT JOIN ledlenser.ai_simulations s ON s.audit_run_id=${rid} AND s.sim_id=g.sid WHERE ${cond} ORDER BY (s.id IS NOT NULL), g.r, g.i, g.k LIMIT ${size}`) || [];
    if (!pending.length) return { success: true, action: 'chunk', mode, processed: 0, message: 'no cells for this mode' };
    const planMap = {};
    if (ctx.runPrompts.some(p => p.prompt_kind === 'probe')) {
      for (const r of (await sql(`SELECT prompt_key, repeat_no, asin, asins, sku, category, series, spec_field, question, expected_value, source_url FROM ledlenser.ai_probe_plan WHERE audit_run_id=${rid}`)) || []) planMap[r.prompt_key + ':' + r.repeat_no] = r;
    }
    function cellPrompt(base, r) {
      if (!base || base.prompt_kind !== 'probe') return base;
      const pl = planMap[base.prompt_key + ':' + r];
      if (isRot(base)) {
        if (!pl || !pl.question) return null;
        return Object.assign({}, base, { prompt_text: pl.question, plan: { asin: pl.asin, asins: pl.asins, sku: pl.sku, category: pl.category, series: pl.series, spec_field: pl.spec_field, expected_value: pl.expected_value, source_url: pl.source_url, amazon: null, anchor: false } });
      }
      const f = facts[base.prompt_key];
      return Object.assign({}, base, { plan: { asin: null, asins: null, sku: null, category: null, series: null, spec_field: null, expected_value: f ? f.claim : null, source_url: f ? f.source_url : null, amazon: null, anchor: true } });
    }
    function cellSql(r) {
      const ts = new Date().toISOString();
      const sid = r.cell.sid, p = r.p;
      const q = [];
      let o;
      if (r.ok) {
        const full = String(r.res.answer);
        const sc = score(full);
        const cites = []; const seen = new Set();
        for (const c of (Array.isArray(r.res.citations) ? r.res.citations : [])) {
          const url = c && c.url ? String(c.url).trim() : '';
          if (!/^https?:\/\/\S+$/i.test(url) || seen.has(url)) continue;
          const d = domainOf(url); if (!d) continue;
          seen.add(url); cites.push({ url, d, title: c.title ? String(c.title).slice(0, 300) : null });
        }
        const probe = p.prompt_kind === 'probe';
        let mh = 'not_evaluated', ev = null, rc = null;
        if (probe && isRot(p) && p.plan) {
          const g = grade(p.plan.spec_field, p.plan.expected_value, full);
          mh = g.mh;
          if (g.mh === 'suspected') { ev = g.ev || null; rc = 'Possible mismatch with the Ledlenser product sheet (unconfirmed): ' + p.plan.spec_field + ' = ' + p.plan.expected_value + (p.plan.source_url ? ' (' + p.plan.source_url + ')' : ''); }
        } else if (probe && facts[p.prompt_key]) {
          let re = null; try { re = new RegExp(facts[p.prompt_key].contradiction_pattern, 'i'); } catch (_) {}
          const m = re ? full.match(re) : null;
          if (m) { mh = 'confirmed'; ev = full.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80); rc = 'Answer contradicts verified fact: ' + facts[p.prompt_key].claim + ' (' + facts[p.prompt_key].source_url + ')'; }
          else mh = 'none';
        }
        o = { call_status: 'answered', outcome: probe ? 'not_scored' : sc.outcome, brand: probe ? null : sc.brand, label: sc.label, mh, ev, rc, full, cites, model: r.res.model || r.res.engine_model || null, err: null };
      } else {
        o = { call_status: 'error', outcome: 'error', brand: null, label: 'Error', mh: 'not_evaluated', ev: null, rc: null, full: null, cites: [], model: null, err: String(r.err || 'unknown').slice(0, 500) };
      }
      const pc = p.plan || null;
      const pcCols = pc ? ', probe_asin, probe_asins, probe_brand_sku, probe_category, probe_series, probe_spec_field, probe_expected_value, probe_source_url, probe_amazon_value, probe_is_anchor' : '';
      const pcVals = pc ? `, ${sq(pc.asin)}, ${arr(pc.asins)}, ${sq(pc.sku)}, ${sq(pc.category)}, ${sq(pc.series)}, ${sq(pc.spec_field)}, ${sq(pc.expected_value)}, ${sq(pc.source_url)}, ${sq(pc.amazon)}, ${pc.anchor ? 'true' : 'false'}` : '';
      const pcUpd = pc ? ', probe_asin=EXCLUDED.probe_asin, probe_asins=EXCLUDED.probe_asins, probe_brand_sku=EXCLUDED.probe_brand_sku, probe_category=EXCLUDED.probe_category, probe_series=EXCLUDED.probe_series, probe_spec_field=EXCLUDED.probe_spec_field, probe_expected_value=EXCLUDED.probe_expected_value, probe_source_url=EXCLUDED.probe_source_url, probe_amazon_value=EXCLUDED.probe_amazon_value, probe_is_anchor=EXCLUDED.probe_is_anchor' : '';
      const citeTitles = o.cites.map(c => c.title || c.url).join('; ');
      const citeUrls = o.cites.map(c => c.url).join(' | ');
      q.push(`INSERT INTO ledlenser.ai_simulations (id, audit_run_id, sim_id, category, prompt, brand_win_rate, winner, citations, hallucination_flag, root_cause, remediation_patch, created_at, updated_at, answer_text, citation_urls, engine, repeat_no, prompt_key, prompt_text, prompt_kind, model, call_status, outcome, primary_brand, material_hallucination, hallucination_evidence, attempt_no, error_message, record_origin, analytical_intent, headline_denominator${pcCols}) VALUES (${sq(genUUID())}, ${rid}, ${sid}, ${sq(p.category)}, ${sq(p.prompt_text)}, ${o.outcome === 'brand_win' ? 100 : 0}, ${sq(o.label)}, ${sq(citeTitles)}, ${o.mh === 'confirmed'}, ${sq(o.rc)}, NULL, ${sq(ts)}, ${sq(ts)}, ${sq(o.full)}, ${sq(citeUrls)}, ${sq(r.engine)}, ${r.cell.r}, ${sq(p.prompt_key)}, ${sq(p.prompt_text)}, ${sq(p.prompt_kind)}, ${sq(o.model)}, ${sq(o.call_status)}, ${sq(o.outcome)}, ${sq(o.brand)}, ${sq(o.mh)}, ${sq(o.ev)}, ${r.tries}, ${sq(o.err)}, ${sq(COLLECTOR)}, ${sq(p.analytical_intent)}, ${sq(p.headline_denominator)}${pcVals}) ON CONFLICT (audit_run_id, sim_id) DO UPDATE SET brand_win_rate=EXCLUDED.brand_win_rate, winner=EXCLUDED.winner, citations=EXCLUDED.citations, hallucination_flag=EXCLUDED.hallucination_flag, root_cause=EXCLUDED.root_cause, updated_at=EXCLUDED.updated_at, answer_text=EXCLUDED.answer_text, citation_urls=EXCLUDED.citation_urls, model=EXCLUDED.model, call_status=EXCLUDED.call_status, outcome=EXCLUDED.outcome, primary_brand=EXCLUDED.primary_brand, material_hallucination=EXCLUDED.material_hallucination, hallucination_evidence=EXCLUDED.hallucination_evidence, attempt_no=EXCLUDED.attempt_no, error_message=EXCLUDED.error_message${pcUpd};`);
      q.push(`DELETE FROM ledlenser.ai_citations WHERE simulation_id IN (SELECT id FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND sim_id=${sid});`);
      o.cites.forEach((c, idx) => {
        q.push(`INSERT INTO ledlenser.ai_citations (id, created_at, simulation_id, audit_run_id, sim_id, engine, position, url, domain, title) SELECT ${sq(genUUID())}::uuid, ${sq(ts)}::timestamptz, s.id, s.audit_run_id, s.sim_id, s.engine, ${idx + 1}, ${sq(c.url)}, ${sq(c.d)}, ${sq(c.title)} FROM ledlenser.ai_simulations s WHERE s.audit_run_id=${rid} AND s.sim_id=${sid} ON CONFLICT (simulation_id, position) DO NOTHING;`);
      });
      return q.join('\n');
    }

    const queues = { chatgpt: [], perplexity: [], gemini: [] };
    let skippedNoPlan = 0;
    for (const c of pending) {
      const cell = { r: Number(c.r), i: Number(c.i), k: Number(c.k), sid: Number(c.sid) };
      const p = cellPrompt(ctx.runPrompts[cell.i], cell.r);
      if (!p) { skippedNoPlan++; continue; }
      queues[engines[cell.k]].push({ cell, p, engine: engines[cell.k], tries: 0, err: null });
    }
    let rot = 0;
    const cooldown = {}, rlHits = {}, openBy = {};
    const engineMax = { chatgpt: concurrency, gemini: concurrency, perplexity: 1 };
    function takeBatch() {
      for (let n = 0; n < engines.length; n++) {
        const e = engines[(rot + n) % engines.length];
        const q = queues[e];
        if (!q.length || (cooldown[e] || 0) > Date.now() || (openBy[e] || 0) >= engineMax[e]) continue;
        rot = (rot + n + 1) % engines.length;
        const batch = [], seen = new Set(), rest = [];
        for (const it of q) { if (batch.length < batchSize && !seen.has(it.p.prompt_text)) { batch.push(it); seen.add(it.p.prompt_text); } else rest.push(it); }
        queues[e] = rest;
        return { engine: e, items: batch };
      }
      return null;
    }
    const finished = [], saveErrors = [];
    const stats = { calls: 0, callTimeouts: 0, callErrors: 0, rateLimited: 0 };
    let inFlight = 0, activeBatches = 0;
    async function saveCells(items) {
      if (!items.length) return;
      try { await sql('BEGIN;\n' + items.map(x => cellSql(x)).join('\n') + '\nCOMMIT;\nSELECT 1 ok;'); items.forEach(x => { x.saved = true; }); }
      catch (e) { items.forEach(x => { x.saved = false; }); saveErrors.push([items.map(x => x.cell.sid).join(','), String(e.message || e).slice(0, 200)]); }
    }
    async function runBatch(b) {
      const timeout = Math.min(callTimeout[b.engine], deadline - Date.now() - 5000);
      const args = { engine: b.engine, prompts: b.items.map(x => x.p.prompt_text), auto_database_threshold: 0, return_type: 'standard' };
      if (b.engine === 'chatgpt') args.search = true;
      stats.calls++; inFlight++; openBy[b.engine] = (openBy[b.engine] || 0) + 1;
      const settled = callTool(aiServer, 'ask', args).then(r => r, e => ({ __err: String(e && e.message || e) }));
      settled.then(() => { inFlight--; openBy[b.engine]--; });
      let res;
      try { res = await withTimeout(settled, timeout, b.engine + ' batch of ' + b.items.length); }
      catch (e) { res = { __timeout: String(e.message) }; stats.callTimeouts++; }
      if (res && res.__err) stats.callErrors++;
      const list = res && Array.isArray(res.results) ? res.results : (res && res.answer ? [res] : []);
      const errs = res && Array.isArray(res.errors) ? res.errors : [];
      const norm = s => String(s || '').trim().replace(/\s+/g, ' ');
      const done = [];
      const rl = /rate limit|too many requests/i.test(JSON.stringify(res || null).slice(0, 3000));
      if (rl) { stats.rateLimited++; rlHits[b.engine] = (rlHits[b.engine] || 0) + 1; cooldown[b.engine] = Date.now() + Math.min(120000, 20000 * Math.pow(2, rlHits[b.engine] - 1)); }
      for (const it of b.items) {
        it.tries++;
        const hit = list.find(x => x && norm(x.prompt) === norm(it.p.prompt_text)) || (list.length === b.items.length && !errs.length ? list[b.items.indexOf(it)] : null);
        if (hit && hit.answer) { it.ok = true; it.res = hit; done.push(it); continue; }
        if (rl && (it.rl = (it.rl || 0) + 1) <= 4) { it.tries--; it.err = 'rate limited'; queues[it.engine].unshift(it); continue; }
        const er = errs.find(x => x && x.payload && norm(x.payload.prompt) === norm(it.p.prompt_text));
        it.err = er ? 'provider: ' + String(er.message || JSON.stringify(er)).slice(0, 400) : res && res.__timeout ? res.__timeout : res && res.__err ? 'call failed: ' + res.__err.slice(0, 300) : 'no answer for prompt in batch: ' + JSON.stringify(res || null).slice(0, 300);
        if (it.tries < maxTries) queues[it.engine].push(it); else { it.ok = false; done.push(it); }
      }
      done.forEach(x => finished.push(x));
      await saveCells(done);
    }
    async function worker() {
      while (true) {
        if (deadline - Date.now() < MIN_CALL_MS) return;
        while (inFlight >= concurrency && deadline - Date.now() >= MIN_CALL_MS) await sleep(1000);
        if (deadline - Date.now() < MIN_CALL_MS) return;
        const b = takeBatch();
        if (!b) { if (activeBatches === 0 && !engines.some(e => queues[e].length)) return; await sleep(2000); continue; }
        activeBatches++;
        try { await runBatch(b); } finally { activeBatches--; }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const leftover = [];
    for (const e of engines) for (const it of queues[e]) if (it.tries > 0) { it.ok = false; leftover.push(it); }
    leftover.forEach(x => finished.push(x));
    await saveCells(leftover);
    const okN = finished.filter(x => x.ok).length;
    return { success: saveErrors.length === 0, action: 'chunk', mode, processed: finished.length, answered: okN, errors: finished.length - okN, skippedForBudget: engines.reduce((a, e) => a + queues[e].filter(it => it.tries === 0).length, 0), skippedNoPlan, elapsedSec: Math.round((Date.now() - t0) / 1000), calls: stats.calls, callTimeouts: stats.callTimeouts, callErrors: stats.callErrors, rateLimited: stats.rateLimited, byEngine: engines.reduce((a, e) => { const xs = finished.filter(x => x.engine === e); a[e] = { processed: xs.length, answered: xs.filter(x => x.ok).length }; return a; }, {}), errorCells: finished.filter(x => !x.ok).slice(0, 20).map(x => [x.cell.sid, x.engine, String(x.err || '').slice(0, 100)]), saveErrors };
  }

  if (action === 'tick') {
    // One scheduled step: fill missing cells, then one error sweep, then finalize and publish.
    const cur = ((await sql(`SELECT id FROM ledlenser.audit_runs WHERE run_kind='ai_simulation' AND NOT is_published AND run_state='running' AND started_at > now() - interval '40 hours' ORDER BY started_at DESC LIMIT 1`)) || [])[0];
    if (!cur) return { success: true, action, idle: true };
    const ctx = await loadRun(cur.id);
    let st = await statusOf(ctx);
    if (st.missing_rows > 0) { const r = await chunk(ctx, 'missing'); return { action, audit_run_id: ctx.runId, step: 'fill', ...r, missing_before: st.missing_rows }; }
    if (!ctx.sweepStartedAt) { await beginSweep(ctx); st = await statusOf(ctx); }
    if (st.sweep_remaining > 0) { const r = await chunk(ctx, 'errors'); return { action, audit_run_id: ctx.runId, step: 'sweep', ...r, sweep_remaining_before: st.sweep_remaining }; }
    // Re-score before publishing so rows written by an earlier collector build use the current count.
    const rs = await rescore(ctx);
    const fin = await finalize(ctx);
    const pub = fin.publishable ? await publish(ctx) : { published: false, reason: 'not publishable' };
    return { success: true, action, audit_run_id: ctx.runId, step: 'finalize', rescored: rs.changed, ...fin, ...pub };
  }

  const runId = inputs.audit_run_id;
  if (!runId || !uuidRe.test(runId)) return { success: false, error: 'audit_run_id required for ' + action };
  const ctx = await loadRun(runId);
  if (!ctx) return { success: false, error: 'run not found' };
  if (action === 'status') return { success: true, action, ...(await statusOf(ctx)) };
  if (action === 'begin_sweep') return { success: true, action, ...(await beginSweep(ctx)) };
  if (action === 'finalize') return { success: true, action, ...(await finalize(ctx)) };
  if (action === 'publish') return { success: true, action, ...(await publish(ctx)) };
  if (action === 'rescore') return { action, ...(await rescore(ctx)) };
  if (action === 'chunk') return await chunk(ctx, inputs.mode || 'any');
  return { success: false, error: 'unknown action ' + action };
}