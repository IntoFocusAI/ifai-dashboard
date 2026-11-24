async function run(inputs) {
  const aiServer = 'AI-Search';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SBX = '5528f699-8878-4b19-b26b-93ca0ee6bee7';
  const MIR = 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532';
  const CLA = 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c';
  const MIRRORS = [{ id: SBX, name: 'sandbox' }, { id: MIR, name: 'mirror' }, { id: CLA, name: 'claude' }];
  const WRENCH = 'fender_ai_simulation_battery_v11';
  const WRENCH_VERSION = 18;
  const t0 = Date.now();
  const genUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function withTimeout(p, ms, label) { let t; const x = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Timed out after ' + ms + 'ms: ' + label)), ms); }); return Promise.race([p, x]).finally(() => clearTimeout(t)); }
  const parse = r => { const t = typeof r === 'string' ? r : (r && r.result) || JSON.stringify(r); const m = String(t).match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/); return m ? JSON.parse(m[1]) : null; };
  const sbErr = r => { if (!r) return 'no response'; if (r.error) return (r.error.message || JSON.stringify(r.error)).slice(0, 400); const t = JSON.stringify(r); if (/HttpException|Failed to run sql/.test(t) && !/untrusted-data/.test(t)) return t.slice(0, 400); return null; };
  const sqlOn = async (id, q) => { const r = await callTool(id, 'execute_sql', { query: q }); const e = sbErr(r); if (e) throw new Error(e); return parse(r); };
  const sql = q => sqlOn(SB, q);
  const dw = { mirrored: 0, failed: 0, lastError: null, targets: { sandbox: { mirrored: 0, failed: 0 }, mirror: { mirrored: 0, failed: 0 }, claude: { mirrored: 0, failed: 0 } } };
  const sq = s => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/\u0000/g, '').replace(/'/g, "''")}'`;
  const toArr = a => Array.isArray(a) ? a : (a ? String(a).replace(/^\{|\}$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')).filter(Boolean) : []);
  const arr = a => { const v = toArr(a); return v.length ? `ARRAY[${v.map(sq).join(',')}]::text[]` : 'NULL'; };
  // Prod first; mirrors get mq when given (legacy-column copy), else the same SQL. Mirror failures are logged, never block.
  async function write(q, mq) {
    const res = await sqlOn(SB, q);
    const m = mq === undefined ? q : mq;
    if (m) await Promise.all(MIRRORS.map(async t => {
      try { await sqlOn(t.id, m); dw.mirrored++; dw.targets[t.name].mirrored++; }
      catch (e) {
        dw.failed++; dw.targets[t.name].failed++; dw.lastError = t.name + ': ' + String(e.message || e).slice(0, 300);
        try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES (${sq(WRENCH)}, ${sq(t.name)}, ${sq(String(e.message || e).slice(0, 2000))}, ${sq(m)}); SELECT 1 ok`); } catch (_) {}
      }
    }));
    return res;
  }
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const action = inputs.action || 'status';
  const engines = ['chatgpt', 'perplexity', 'gemini'];
  const FIELDS = ['SCALE LENGTH', 'BODY MATERIAL', 'FINGERBOARD RADIUS', 'NUMBER OF FRETS', 'NECK MATERIAL'];
  const ROT_RULE = 'In scope: fender.com spec pages (latest command.fmic_spec_readiness row per ASIN) whose specs include BODY MATERIAL and SCALE LENGTH, one model per fender_url, sorted by series, category, fender_url. Each run takes the models whose index parity equals cycle_no parity (full set every 2 runs); field = FIELDS[(index + cycle_no) mod 5] over SCALE LENGTH, BODY MATERIAL, FINGERBOARD RADIUS, NUMBER OF FRETS, NECK MATERIAL; models spread round robin over the rotating prompts, one ask per engine.';
  const ANCHOR_FIELD = { p17: 'FINGERBOARD RADIUS; NUMBER OF FRETS', p33: 'SCALE LENGTH' };
  const ANCHOR_SERIES = { p17: 'Player II' };
  const cfgRows = (await sql(`SELECT extra FROM command.fmic_job_state WHERE job_key='ai_battery_config'`)) || [];
  const cfgX = cfgRows[0] ? cfgRows[0].extra : {};
  const cfg = typeof cfgX === 'string' ? JSON.parse(cfgX) : (cfgX || {});
  const rotOn = !!(cfg.rotation && cfg.rotation.active === true);
  const allPrompts = (await sql(`SELECT prompt_key, prompt_text, category, prompt_kind, active, coalesce(probe_mode,'fixed') AS probe_mode, probe_slots FROM command.fmic_ai_prompts ORDER BY prompt_key`)) || [];
  const isRot = p => !!p && p.probe_mode === 'rotating';
  const active = allPrompts.filter(p => p.active === true || p.active === 't' || p.active === 'true');
  const byKey = Object.fromEntries(allPrompts.map(p => [p.prompt_key, p]));
  const hash = (await sql(`SELECT command.fmic_ai_prompt_set_hash() AS h`))[0].h;
  const facts = {};
  for (const f of (await sql(`SELECT prompt_key, claim, contradiction_pattern, source_url FROM command.fmic_ai_probe_facts`)) || []) facts[f.prompt_key] = f;

  const SCOPE_SQL = `WITH l AS (SELECT DISTINCT ON (asin) asin, category, fender_url, fender_variant_sku, fender_spec_values f, amazon_spec_values a FROM command.fmic_spec_readiness WHERE fender_spec_values IS NOT NULL AND fender_url IS NOT NULL ORDER BY asin, checked_at DESC),
sp AS (SELECT fender_url, upper(k) k, min(v) v FROM l, jsonb_each_text(l.f) e(k,v) WHERE v !~ '^\\s*[\\[{]' AND btrim(v)<>'' GROUP BY 1,2),
s AS (SELECT fender_url, jsonb_object_agg(k, v) uf FROM sp GROUP BY 1),
m AS (SELECT fender_url, array_agg(DISTINCT asin ORDER BY asin) asins, min(fender_variant_sku) sku, min(category) category, min(a->>'scale_length') a_scale, min(a->>'body_material_type') a_body, min(a->>'neck_material_type') a_neck FROM l GROUP BY 1)
SELECT s.fender_url, m.asins, m.sku, m.category, uf->>'SERIES' series, uf->>'PRODUCT NAME' pname, uf->>'SCALE LENGTH' scale, uf->>'BODY MATERIAL' body, uf->>'FINGERBOARD RADIUS' radius, uf->>'NUMBER OF FRETS' frets, uf->>'NECK MATERIAL' neck, m.a_scale, m.a_body, m.a_neck FROM s JOIN m USING (fender_url) WHERE uf ? 'BODY MATERIAL' AND uf ? 'SCALE LENGTH' ORDER BY coalesce(uf->>'SERIES',''), m.category, s.fender_url`;
  const cleanName = s => String(s || '').replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
  const normVal = v => (v === null || v === undefined || String(v).trim() === '') ? null : String(v).replace(/[“”″]/g, '"').replace(/\s+/g, ' ').trim();
  const QT = {
    'SCALE LENGTH': x => `What is the scale length of the ${x}?`,
    'BODY MATERIAL': x => `What wood is the body of the ${x} made of?`,
    'FINGERBOARD RADIUS': x => `What is the fingerboard radius of the ${x}?`,
    'NUMBER OF FRETS': x => `How many frets does the ${x} have?`,
    'NECK MATERIAL': x => `What wood is the neck of the ${x} made of?`,
  };
  const FCOL = { 'SCALE LENGTH': 'scale', 'BODY MATERIAL': 'body', 'FINGERBOARD RADIUS': 'radius', 'NUMBER OF FRETS': 'frets', 'NECK MATERIAL': 'neck' };
  const ACOL = { 'SCALE LENGTH': 'a_scale', 'BODY MATERIAL': 'a_body', 'NECK MATERIAL': 'a_neck' };
  function buildPlan(list, cycleNo, rotPrompts) {
    const base = list.map(x => cleanName(String(x.pname || '').split(',')[0]));
    const cnt = {}; base.forEach(b => { cnt[b] = (cnt[b] || 0) + 1; });
    const chosen = [];
    list.forEach((x, idx) => {
      if (idx % 2 !== cycleNo % 2) return;
      let name = base[idx];
      if (cnt[name] > 1) { const extra = cleanName(String(x.pname || '').split(',')[1]); if (extra) name += ' (' + extra + ')'; }
      const brand = /\b(fender|squier)\b/i.test(name) ? '' : (String(x.sku || '').startsWith('037') ? 'Squier ' : 'Fender ');
      let field = null;
      for (let s = 0; s < FIELDS.length; s++) { const f = FIELDS[(idx + cycleNo + s) % FIELDS.length]; if (normVal(x[FCOL[f]])) { field = f; break; } }
      if (!field) return;
      const asins = toArr(x.asins);
      chosen.push({ idx, field, spec_field: field, question: QT[field](brand + name), expected: normVal(x[FCOL[field]]), amazon: ACOL[field] ? normVal(x[ACOL[field]]) : null, source_url: x.fender_url, asin: asins[0] || null, asins, sku: x.sku || null, category: x.category || null, series: x.series ? cleanName(x.series) : null });
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

  if (action === 'start' || action === 'plan_preview') {
    const rotPromptsActive = active.filter(isRot);
    const useRot = rotOn && rotPromptsActive.length > 0;
    const stRow = ((await sql(`SELECT cursor_offset FROM command.fmic_job_state WHERE job_key='ai_probe_rotation'`)) || [])[0];
    if (action === 'plan_preview') {
      const rp = rotPromptsActive.length ? rotPromptsActive : ['p35', 'p36', 'p37'].map(k => ({ prompt_key: k, probe_slots: 30 }));
      const cycleNo = Number(inputs.cycle_no || (stRow ? Number(stRow.cursor_offset) + 1 : 1));
      const list = (await sql(SCOPE_SQL)) || [];
      const pl = buildPlan(list, cycleNo, rp);
      const byField = {}; pl.rows.forEach(r => { byField[r.field] = (byField[r.field] || 0) + 1; });
      const reps = Math.max(1, Math.min(50, Number(cfg.repeats || 3)));
      const fixedN = active.filter(p => !isRot(p)).length;
      const fixedProbes = active.filter(p => !isRot(p) && p.prompt_kind === 'probe').length;
      return { success: true, action, rotation_active: rotOn, rotating_prompts_active: rotPromptsActive.map(p => p.prompt_key), cycle_no: cycleNo, in_scope_models: list.length, products_this_run: pl.rows.length, slots: pl.slots, by_field: byField, repeats_when_rotating: reps, expected_calls_when_rotating: { total: fixedN * 3 * reps + pl.rows.length * 3, shopping: (fixedN - fixedProbes) * 3 * reps, anchors: fixedProbes * 3 * reps, rotating: pl.rows.length * 3 }, distinct_questions: new Set(pl.rows.map(r => r.question)).size, with_amazon_value: pl.rows.filter(r => r.amazon).length, sample: pl.rows.slice(0, 6).map(r => ({ prompt_key: r.prompt_key, repeat_no: r.repeat_no, question: r.question, expected: r.expected, amazon: r.amazon, source_url: r.source_url })) };
    }
    const repeats = useRot ? Math.max(1, Math.min(50, Number(cfg.repeats || 3))) : Math.max(1, Math.min(50, Number(inputs.repeats || 20)));
    const runP = useRot ? active : active.filter(p => !isRot(p));
    const fixedN = runP.filter(p => !isRot(p)).length;
    const runId = genUUID(), ts = new Date().toISOString();
    const meta = { source: WRENCH, version: 11, wrench_version: WRENCH_VERSION, collector_build: 'v15', repeats, prompt_keys: runP.map(p => p.prompt_key) };
    if (useRot && inputs.repeats && Number(inputs.repeats) !== repeats) meta.repeats_input_overridden = Number(inputs.repeats);
    let expected = fixedN * engines.length * repeats, planSql = '', cursorSql = '', cycleNo = null, planRows = 0;
    if (useRot) {
      if (!stRow) return { success: false, error: 'rotation is on but command.fmic_job_state ai_probe_rotation is missing' };
      cycleNo = Number(stRow.cursor_offset) + 1;
      const list = (await sql(SCOPE_SQL)) || [];
      if (list.length < 2) return { success: false, error: 'in-scope model list is empty' };
      const pl = buildPlan(list, cycleNo, runP.filter(isRot));
      const totalSlots = Object.values(pl.slots).reduce((a, b) => a + b, 0);
      expected += totalSlots * engines.length;
      meta.rotating_slots = pl.slots;
      meta.probe_rotation = { rule: ROT_RULE, cycle_no: cycleNo, in_scope_models: list.length, products_this_run: totalSlots, runs_per_full_cycle: 2, asks_per_engine: 1, fields: FIELDS, rotating_prompts: Object.keys(pl.slots), anchor_prompts: runP.filter(p => !isRot(p) && p.prompt_kind === 'probe').map(p => p.prompt_key), anchor_repeats: repeats };
      meta.probe_amazon_values = {};
      pl.rows.forEach(r => { if (r.amazon) meta.probe_amazon_values[r.prompt_key + ':' + r.repeat_no] = r.amazon; });
      const anchorRows = [];
      for (const p of runP.filter(p => !isRot(p) && p.prompt_kind === 'probe')) for (let r = 1; r <= repeats; r++) {
        const f = facts[p.prompt_key];
        anchorRows.push({ prompt_key: p.prompt_key, repeat_no: r, asin: null, asins: null, sku: null, category: null, series: ANCHOR_SERIES[p.prompt_key] || null, spec_field: ANCHOR_FIELD[p.prompt_key] || null, question: p.prompt_text, expected: f ? f.claim : null, source_url: f ? f.source_url : null });
      }
      const all = anchorRows.concat(pl.rows);
      planRows = all.length;
      planSql = `INSERT INTO command.fmic_ai_probe_plan (audit_run_id, prompt_key, repeat_no, asin, asins, sku, category, series, spec_field, question, expected_value, source_url) VALUES\n` + all.map(r => `(${sq(runId)}, ${sq(r.prompt_key)}, ${r.repeat_no}, ${sq(r.asin)}, ${arr(r.asins)}, ${sq(r.sku)}, ${sq(r.category)}, ${sq(r.series)}, ${sq(r.spec_field)}, ${sq(r.question)}, ${sq(r.expected)}, ${sq(r.source_url)})`).join(',\n') + `\nON CONFLICT (audit_run_id, prompt_key, repeat_no) DO NOTHING;`;
      cursorSql = `UPDATE command.fmic_job_state SET cursor_offset=${cycleNo}, last_run_at=${sq(ts)}, updated_at=${sq(ts)}, extra = coalesce(extra,'{}'::jsonb) || jsonb_build_object('last_run_id', ${sq(runId)}, 'last_cycle_no', ${cycleNo}, 'last_started_at', ${sq(ts)}) WHERE job_key='ai_probe_rotation';`;
    }
    const runSql = `INSERT INTO command.fmic_audit_runs (id, workflow_execution_id, trigger_type, started_at, status, metadata, run_kind, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls, answered_calls, error_calls, is_published) VALUES (${sq(runId)}, ${sq('ai_sim_v11_' + runId)}, 'scheduled', ${sq(ts)}, 'running', ${sq(JSON.stringify(meta))}::jsonb, 'ai_simulation', 'running', 'v11', ${sq(hash)}, ${expected}, 0, 0, 0, false);`;
    await write(`BEGIN;\n${runSql}\n${planSql}\n${cursorSql}\nCOMMIT;\nSELECT 1 ok;`, `BEGIN;\n${runSql}\n${cursorSql}\nCOMMIT;\nSELECT 1 ok;`);
    return { success: true, action, audit_run_id: runId, repeats, expected_calls: expected, prompt_set_hash: hash, rotation: useRot ? { cycle_no: cycleNo, slots: meta.rotating_slots, plan_rows: planRows } : null, dualWrite: dw };
  }

  const runId = inputs.audit_run_id;
  if (!runId || !uuidRe.test(runId)) return { success: false, error: 'audit_run_id required for ' + action };
  const runRow = ((await sql(`SELECT prompt_set_hash, metadata, is_published, run_state FROM command.fmic_audit_runs WHERE id=${sq(runId)}`)) || [])[0];
  if (!runRow) return { success: false, error: 'run not found' };
  const meta = typeof runRow.metadata === 'string' ? JSON.parse(runRow.metadata) : (runRow.metadata || {});
  const repeats = Math.max(1, Number(meta.repeats || 1));
  // Prompts are frozen at start (metadata.prompt_keys) so an edit mid-run cannot shift which question a cell holds.
  const runPrompts = Array.isArray(meta.prompt_keys) ? meta.prompt_keys.map(k => byKey[k]).filter(Boolean) : active.filter(p => !isRot(p));
  const slots = meta.rotating_slots || {};
  const fixedIdx = [], rotIdx = [];
  runPrompts.forEach((p, i) => (isRot(p) ? rotIdx : fixedIdx).push(i));
  const rotCells = rotIdx.reduce((a, i) => a + Number(slots[runPrompts[i].prompt_key] || 0), 0);
  const expected = fixedIdx.length * engines.length * repeats + rotCells * engines.length;
  const minPerEngine = Math.ceil(0.7 * expected / engines.length);
  const sweepStartedAt = meta.sweep_started_at || null;
  // sim_id = repeat (or rotation slot) * 1000 + promptIdx * 10 + engineIdx + 1, unique per run.
  const parts = [];
  if (fixedIdx.length) parts.push(`SELECT r, i, k, r*1000+i*10+k+1 AS sid FROM generate_series(1,${repeats}) r, unnest(ARRAY[${fixedIdx.join(',')}]::int[]) i, generate_series(0,2) k`);
  for (const i of rotIdx) { const s = Number(slots[runPrompts[i].prompt_key] || 0); if (s > 0) parts.push(`SELECT r, ${i} AS i, k, r*1000+${i}*10+k+1 AS sid FROM generate_series(1,${s}) r, generate_series(0,2) k`); }
  const gridSql = parts.length ? parts.join(' UNION ALL ') : 'SELECT 1 AS r, 0 AS i, 0 AS k, 0 AS sid WHERE false';

  if (action === 'begin_sweep') {
    if (sweepStartedAt) return { success: true, action, sweep_started_at: sweepStartedAt, note: 'already started' };
    const ts = new Date().toISOString();
    await write(`UPDATE command.fmic_audit_runs SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('sweep_started_at', ${sq(ts)}) WHERE id=${sq(runId)} AND NOT is_published; SELECT 1 ok;`);
    return { success: true, action, sweep_started_at: ts, dualWrite: dw };
  }

  if (action === 'status' || action === 'finalize') {
    const c = (await sql(`SELECT count(*) AS n, count(*) FILTER (WHERE call_status='answered') AS answered, count(*) FILTER (WHERE call_status='error') AS errors, count(*) FILTER (WHERE outcome='unresolved') AS unresolved, (SELECT count(*) FROM command.fmic_ai_citations WHERE audit_run_id=${sq(runId)}) AS cites, (SELECT count(*) FROM command.fmic_ai_probe_plan WHERE audit_run_id=${sq(runId)}) AS plan_rows${sweepStartedAt ? `, count(*) FILTER (WHERE call_status='error' AND updated_at < ${sq(sweepStartedAt)}::timestamptz) AS sweep_remaining` : ''} FROM command.fmic_ai_simulations WHERE audit_run_id=${sq(runId)}`))[0];
    const n = Number(c.n), answered = Number(c.answered), errors = Number(c.errors);
    const pe = (await sql(`SELECT engine, count(*) AS n, count(*) FILTER (WHERE call_status='answered') AS answered, count(*) FILTER (WHERE call_status='error') AS errors FROM command.fmic_ai_simulations WHERE audit_run_id=${sq(runId)} GROUP BY engine ORDER BY engine`)) || [];
    const per_engine = Object.fromEntries(pe.map(r => [r.engine, { rows: Number(r.n), answered: Number(r.answered), errors: Number(r.errors) }]));
    const engines_below_min = engines.filter(e => (per_engine[e] ? per_engine[e].answered : 0) < minPerEngine);
    const hash_matches = runRow.prompt_set_hash === hash;
    const publishable = hash_matches && n > 0 && answered > 0;
    const coverage = { repeats, per_engine, min_answered_per_engine: minPerEngine, engines_below_min, meets_engine_floor: engines_below_min.length === 0, hash_matches, publishable };
    const progress = { missing_rows: expected - n, error_rows: errors, sweep_started_at: sweepStartedAt, sweep_remaining: sweepStartedAt ? Number(c.sweep_remaining) : null, is_published: !!runRow.is_published, run_state: runRow.run_state, probe_rotation: meta.probe_rotation ? { cycle_no: meta.probe_rotation.cycle_no, products_this_run: meta.probe_rotation.products_this_run, plan_rows: Number(c.plan_rows) } : null };
    if (action === 'status') return { success: true, action, wrench_version: WRENCH_VERSION, rows: n, answered, errors, unresolved: Number(c.unresolved), citation_rows: Number(c.cites), expected_calls: expected, missing: expected - answered, ...progress, ...coverage };
    const state = (answered === expected && errors === 0) ? 'completed' : (answered > 0 ? 'partial' : 'failed');
    const ts = new Date().toISOString();
    await write(`UPDATE command.fmic_audit_runs SET run_state=${sq(state)}, status=${sq(state === 'failed' ? 'failed' : 'completed')}, completed_at=${sq(ts)}, attempted_calls=${n}, answered_calls=${answered}, error_calls=${errors}, expected_calls=${expected}, asins_audited=NULL WHERE id=${sq(runId)} AND NOT is_published; SELECT 1 ok;`);
    return { success: true, action, run_state: state, attempted: n, answered, errors, expected_calls: expected, missing: expected - answered, ...coverage, publishable: coverage.publishable && state !== 'failed', dualWrite: dw };
  }

  if (action !== 'chunk') return { success: false, error: 'unknown action ' + action };
  if (runRow.is_published) return { success: false, error: 'run is published; chunks are not allowed' };
  const mode = inputs.mode || 'any';
  if (!['missing', 'errors', 'any'].includes(mode)) return { success: false, error: 'mode must be missing, errors or any' };
  if (mode === 'errors' && !sweepStartedAt) return { success: false, error: 'run begin_sweep before chunk mode errors' };
  const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, n)) : d; };
  const size = clamp(inputs.size, 1, 300, 90);
  const batchSize = clamp(inputs.batchSize, 1, 5, 5);
  // v18: Toolbelt's Perplexity route allows one request in flight. A multi-prompt call fans out in parallel,
  // so all but one prompt fail with "Perplexity rate limit exceeded". Perplexity goes one prompt per call.
  const perplexityBatchSize = clamp(inputs.perplexityBatchSize, 1, 5, 1);
  const batchFor = e => e === 'perplexity' ? perplexityBatchSize : batchSize;
  const concurrency = clamp(inputs.concurrency, 1, 10, 6);
  const maxTries = clamp(inputs.maxTries, 1, 3, 2);
  const perplexityMaxTries = Math.min(maxTries, clamp(inputs.perplexityMaxTries, 1, 3, 2));
  // v18: Perplexity default timeout 270000 -> 90000. A single prompt answers in about 5 to 10 s, and the v17 budget
  // guard (timeout + 15 s must fit) blocked new Perplexity calls for the last 285 s of every 420 s chunk.
  const callTimeout = { gemini: clamp(inputs.perCallTimeoutMs, 30000, 280000, 150000), chatgpt: clamp(inputs.chatgptTimeoutMs, 30000, 280000, 200000), perplexity: clamp(inputs.perplexityTimeoutMs, 30000, 280000, 90000) };
  const triesFor = e => e === 'perplexity' ? perplexityMaxTries : maxTries;
  const budgetMs = Math.max(60000, Number(inputs.budgetMs || 420000));
  const deadline = t0 + budgetMs;
  const MIN_CALL_MS = 45000;
  const cond = mode === 'missing' ? 's.id IS NULL'
    : mode === 'errors' ? `s.call_status = 'error' AND s.updated_at < ${sq(sweepStartedAt)}::timestamptz`
    : `s.id IS NULL OR s.call_status IS DISTINCT FROM 'answered'`;
  const pending = await sql(`WITH g AS (${gridSql}) SELECT g.r, g.i, g.k, g.sid, (s.id IS NOT NULL) AS had_error FROM g LEFT JOIN command.fmic_ai_simulations s ON s.audit_run_id=${sq(runId)} AND s.sim_id=g.sid WHERE ${cond} ORDER BY (s.id IS NOT NULL), row_number() OVER (PARTITION BY g.k, (s.id IS NOT NULL) ORDER BY g.r, g.i), g.k LIMIT ${size}`) || [];
  if (!pending.length) return { success: true, action, mode, processed: 0, message: 'no cells for this mode' };

  const planMap = {};
  if (runPrompts.some(p => p.prompt_kind === 'probe')) {
    for (const r of (await sql(`SELECT prompt_key, repeat_no, asin, asins, sku, category, series, spec_field, question, expected_value, source_url FROM command.fmic_ai_probe_plan WHERE audit_run_id=${sq(runId)}`)) || []) planMap[r.prompt_key + ':' + r.repeat_no] = r;
  }
  const amz = meta.probe_amazon_values || {};
  function cellPrompt(base, r) {
    if (!base || base.prompt_kind !== 'probe') return base;
    const pl = planMap[base.prompt_key + ':' + r];
    if (isRot(base)) {
      if (!pl || !pl.question) return null;
      return Object.assign({}, base, { prompt_text: pl.question, plan: { asin: pl.asin, asins: pl.asins, sku: pl.sku, category: pl.category, series: pl.series, spec_field: pl.spec_field, expected_value: pl.expected_value, source_url: pl.source_url, amazon: amz[base.prompt_key + ':' + r] || null, anchor: false } });
    }
    const f = facts[base.prompt_key];
    return Object.assign({}, base, { plan: { asin: pl ? pl.asin : null, asins: pl ? pl.asins : null, sku: pl ? pl.sku : null, category: pl ? pl.category : null, series: pl ? pl.series : (ANCHOR_SERIES[base.prompt_key] || null), spec_field: pl ? pl.spec_field : (ANCHOR_FIELD[base.prompt_key] || null), expected_value: pl ? pl.expected_value : (f ? f.claim : null), source_url: pl ? pl.source_url : (f ? f.source_url : null), amazon: null, anchor: true } });
  }

  // Rotating grading: none when the fender.com value is found, suspected when a different value for the same field appears, else not_evaluated. Never confirmed.
  const WOODS = ['roasted maple', 'quartersawn maple', 'flame maple', 'maple', 'alder', 'swamp ash', 'ash', 'basswood', 'poplar', 'nyatoh', 'mahogany', 'pine', 'okoume', 'sapele', 'sassafras', 'spruce', 'paulownia', 'walnut', 'koa', 'agathis', 'meranti', 'linden'];
  const woodsIn = s => {
    const t = String(s || '').toLowerCase(), hits = [];
    for (const w of WOODS) { const m = t.match(new RegExp('\\b' + w + '\\b')); if (m) hits.push([m.index, /maple/.test(w) ? 'maple' : (w === 'swamp ash' ? 'ash' : w)]); }
    hits.sort((a, b) => a[0] - b[0]);
    return Array.from(new Set(hits.map(h => h[1])));
  };
  const wins = (t, re, span) => Array.from(t.matchAll(re)).map(m => t.slice(Math.max(0, m.index - span), m.index + m[0].length + span));
  const inchNums = s => {
    const t = String(s || ''), out = [];
    for (const m of t.matchAll(/(\d{1,2}(?:\.\d{1,3})?)\s*(?:"|”|″|-?\s?inch(?:es)?\b|-?\s?in\b)/gi)) out.push(Number(m[1]));
    for (const m of t.matchAll(/(\d{1,2}(?:\.\d{1,3})?)\s*(?:"|”)?\s*(?:-|–|to)\s*(\d{1,2}(?:\.\d{1,3})?)\s*(?:"|”|″|-?\s?inch(?:es)?\b)/gi)) { out.push(Number(m[1])); out.push(Number(m[2])); }
    return out;
  };
  const snip = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  function grade(field, expected, text) {
    const t = String(text || ''), e = String(expected || '');
    if (field === 'SCALE LENGTH' || field === 'FINGERBOARD RADIUS') {
      const exp = Array.from(new Set(inchNums(e.replace(/\([^)]*\)/g, ''))));
      if (!exp.length) return { mh: 'not_evaluated' };
      const lo = field === 'SCALE LENGTH' ? 20 : 5, hi = field === 'SCALE LENGTH' ? 36 : 21;
      const has = a => exp.every(x => a.some(g => Math.abs(g - x) < 0.01));
      const near = wins(t, field === 'SCALE LENGTH' ? /scale/gi : /radius|fingerboard|fretboard/gi, 80);
      const got = near.flatMap(w => inchNums(w)).filter(n => n >= lo && n <= hi);
      if (has(got) || has(inchNums(t))) return { mh: 'none' };
      if (got.length) return { mh: 'suspected', ev: snip(near.find(w => inchNums(w).some(n => n >= lo && n <= hi)) || near[0]) };
      return { mh: 'not_evaluated' };
    }
    if (field === 'NUMBER OF FRETS') {
      const x = parseInt(e, 10); if (!x) return { mh: 'not_evaluated' };
      const ms = Array.from(t.matchAll(/\b(\d{2})(?:[\s-]+[a-z]+){0,3}?[\s-]+frets?\b/gi)).filter(m => Number(m[1]) >= 18 && Number(m[1]) <= 36);
      if (ms.some(m => Number(m[1]) === x)) return { mh: 'none' };
      if (ms.length) return { mh: 'suspected', ev: snip(t.slice(Math.max(0, ms[0].index - 80), ms[0].index + 120)) };
      return { mh: 'not_evaluated' };
    }
    if (field === 'BODY MATERIAL' || field === 'NECK MATERIAL') {
      const expW = woodsIn(e); if (!expW.length) return { mh: 'not_evaluated' };
      const primary = expW[0];
      const near = wins(t, field === 'BODY MATERIAL' ? /\bbod(?:y|ies)\b/gi : /\bnecks?\b/gi, 90);
      const gotW = Array.from(new Set(near.flatMap(woodsIn)));
      if (gotW.includes(primary)) return { mh: 'none' };
      const other = gotW.filter(w => !expW.includes(w));
      if (other.length) return { mh: 'suspected', ev: snip(near.find(w => woodsIn(w).some(x => other.includes(x)))) };
      if (woodsIn(t).includes(primary)) return { mh: 'none' };
      return { mh: 'not_evaluated' };
    }
    return { mh: 'not_evaluated' };
  }

  const famTerms = ['fender', 'squier', 'player ii', 'american professional', 'american ultra', 'acoustasonic', 'mustang micro', 'mustang', 'tone master', 'stratocaster', 'telecaster'];
  const competitors = ['PRS', 'Taylor', 'Yamaha', 'Ibanez', 'Gibson', 'Boss', 'Positive Grid', 'Sire'];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const count = (text, term) => (text.match(new RegExp('\\b' + esc(term) + '\\b', 'gi')) || []).length;
  function score(text) {
    const fam = famTerms.reduce((a, t) => a + count(text, t), 0);
    const comp = competitors.map(c => ({ c, n: count(text, c) })).sort((a, b) => b.n - a.n);
    const top = comp[0];
    if (fam === 0 && top.n === 0) return { outcome: 'unresolved', brand: null, label: 'Unclear' };
    if (fam > top.n) return { outcome: 'fender_win', brand: 'Fender/Squier', label: 'Fender/Squier' };
    if (top.n > fam) return { outcome: 'competitor_win', brand: top.c, label: top.c };
    return { outcome: 'unresolved', brand: null, label: 'Unclear' };
  }
  const domainOf = u => { const m = String(u).match(/^https?:\/\/(?:www\.)?([^\/:?#\s]+)/i); return m ? m[1].toLowerCase() : null; };
  const rid = sq(runId);

  // SQL for one finished cell. withProbe=false gives the legacy-column copy for mirrors that lack the probe_* columns.
  function cellSql(r, withProbe) {
    const ts = new Date().toISOString();
    const sid = r.cell.sid, p = r.p;
    const q = [];
    let o;
    if (r.ok) {
      const full = String(r.res.answer);
      const sc = score(full);
      const cites = [];
      const seen = new Set();
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
        if (g.mh === 'suspected') { ev = g.ev || null; rc = 'Possible mismatch with fender.com spec (unconfirmed): ' + p.plan.spec_field + ' = ' + p.plan.expected_value + ' (' + p.plan.source_url + ')'; }
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
    const pc = withProbe && p.plan ? p.plan : null;
    const pcCols = pc ? ', probe_asin, probe_asins, probe_fender_sku, probe_category, probe_series, probe_spec_field, probe_expected_value, probe_source_url, probe_amazon_value, probe_is_anchor' : '';
    const pcVals = pc ? `, ${sq(pc.asin)}, ${arr(pc.asins)}, ${sq(pc.sku)}, ${sq(pc.category)}, ${sq(pc.series)}, ${sq(pc.spec_field)}, ${sq(pc.expected_value)}, ${sq(pc.source_url)}, ${sq(pc.amazon)}, ${pc.anchor ? 'true' : 'false'}` : '';
    const pcUpd = pc ? ', probe_asin=EXCLUDED.probe_asin, probe_asins=EXCLUDED.probe_asins, probe_fender_sku=EXCLUDED.probe_fender_sku, probe_category=EXCLUDED.probe_category, probe_series=EXCLUDED.probe_series, probe_spec_field=EXCLUDED.probe_spec_field, probe_expected_value=EXCLUDED.probe_expected_value, probe_source_url=EXCLUDED.probe_source_url, probe_amazon_value=EXCLUDED.probe_amazon_value, probe_is_anchor=EXCLUDED.probe_is_anchor' : '';
    const citeTitles = o.cites.map(c => c.title || c.url).join('; ');
    const citeUrls = o.cites.map(c => c.url).join(' | ');
    q.push(`INSERT INTO command.fmic_ai_simulations (id, audit_run_id, sim_id, category, prompt, fender_win_rate, winner, citations, hallucination_flag, root_cause, remediation_patch, created_at, updated_at, answer_text, citation_urls, engine, repeat_no, prompt_key, prompt_text, prompt_kind, model, call_status, outcome, primary_brand, material_hallucination, hallucination_evidence, attempt_no, error_message, record_origin${pcCols}) VALUES (${sq(genUUID())}, ${rid}, ${sid}, ${sq(p.category)}, ${sq(p.prompt_text)}, ${o.outcome === 'fender_win' ? 100 : 0}, ${sq(o.label)}, ${sq(citeTitles)}, ${o.mh === 'confirmed'}, ${sq(o.rc)}, NULL, ${sq(ts)}, ${sq(ts)}, ${sq(o.full)}, ${sq(citeUrls)}, ${sq(r.engine)}, ${r.cell.r}, ${sq(p.prompt_key)}, ${sq(p.prompt_text)}, ${sq(p.prompt_kind)}, ${sq(o.model)}, ${sq(o.call_status)}, ${sq(o.outcome)}, ${sq(o.brand)}, ${sq(o.mh)}, ${sq(o.ev)}, ${r.tries}, ${sq(o.err)}, 'collector_v11'${pcVals}) ON CONFLICT (audit_run_id, sim_id) DO UPDATE SET fender_win_rate=EXCLUDED.fender_win_rate, winner=EXCLUDED.winner, citations=EXCLUDED.citations, hallucination_flag=EXCLUDED.hallucination_flag, root_cause=EXCLUDED.root_cause, updated_at=EXCLUDED.updated_at, answer_text=EXCLUDED.answer_text, citation_urls=EXCLUDED.citation_urls, model=EXCLUDED.model, call_status=EXCLUDED.call_status, outcome=EXCLUDED.outcome, primary_brand=EXCLUDED.primary_brand, material_hallucination=EXCLUDED.material_hallucination, hallucination_evidence=EXCLUDED.hallucination_evidence, attempt_no=EXCLUDED.attempt_no, error_message=EXCLUDED.error_message${pcUpd};`);
    q.push(`DELETE FROM command.fmic_ai_citations WHERE simulation_id IN (SELECT id FROM command.fmic_ai_simulations WHERE audit_run_id=${rid} AND sim_id=${sid});`);
    o.cites.forEach((c, idx) => {
      q.push(`INSERT INTO command.fmic_ai_citations (id, created_at, simulation_id, audit_run_id, sim_id, engine, position, url, domain, title) SELECT ${sq(genUUID())}::uuid, ${sq(ts)}::timestamptz, s.id, s.audit_run_id, s.sim_id, s.engine, ${idx + 1}, ${sq(c.url)}, ${sq(c.d)}, ${sq(c.title)} FROM command.fmic_ai_simulations s WHERE s.audit_run_id=${rid} AND s.sim_id=${sid} ON CONFLICT (simulation_id, position) DO NOTHING;`);
    });
    return q.join('\n');
  }

  const queues = { chatgpt: [], perplexity: [], gemini: [] };
  let skippedNoPlan = 0;
  for (const c of pending) {
    const cell = { r: Number(c.r), i: Number(c.i), k: Number(c.k), sid: Number(c.sid) };
    const p = cellPrompt(runPrompts[cell.i], cell.r);
    if (!p) { skippedNoPlan++; continue; }
    queues[engines[cell.k]].push({ cell, p, engine: engines[cell.k], tries: 0, err: null });
  }
  let rot = 0;
  const cooldown = {}, rlHits = {};
  const openBy = {};
  const engineMax = { chatgpt: concurrency, gemini: concurrency, perplexity: clamp(inputs.perplexityConcurrency, 1, 10, 1) };
  function takeBatch() {
    for (let n = 0; n < engines.length; n++) {
      const e = engines[(rot + n) % engines.length];
      const q = queues[e];
      if (!q.length || (cooldown[e] || 0) > Date.now() || (openBy[e] || 0) >= engineMax[e] || deadline - Date.now() < callTimeout[e] + 15000) continue;
      rot = (rot + n + 1) % engines.length;
      const batch = [], seen = new Set(), rest = [];
      const bs = batchFor(e);
      for (const it of q) {
        if (batch.length < bs && !seen.has(it.p.prompt_text)) { batch.push(it); seen.add(it.p.prompt_text); } else rest.push(it);
      }
      queues[e] = rest;
      return { engine: e, items: batch };
    }
    return null;
  }
  const finished = [];
  const saveErrors = [];
  const stats = { calls: 0, callTimeouts: 0, callErrors: 0, rateLimited: 0 };
  let inFlight = 0, activeBatches = 0;

  async function saveCells(items) {
    if (!items.length) return;
    try {
      await write('BEGIN;\n' + items.map(x => cellSql(x, true)).join('\n') + '\nCOMMIT;\nSELECT 1 ok;', 'BEGIN;\n' + items.map(x => cellSql(x, false)).join('\n') + '\nCOMMIT;\nSELECT 1 ok;');
      items.forEach(x => { x.saved = true; });
    } catch (e) { items.forEach(x => { x.saved = false; }); saveErrors.push([items.map(x => x.cell.sid).join(','), String(e.message || e).slice(0, 200)]); }
  }

  async function runBatch(b) {
    const left = deadline - Date.now();
    const timeout = Math.min(callTimeout[b.engine], left - 5000);
    const args = { engine: b.engine, prompts: b.items.map(x => x.p.prompt_text), auto_database_threshold: 0, return_type: 'standard' };
    if (b.engine === 'chatgpt') args.search = true;
    stats.calls++;
    inFlight++;
    openBy[b.engine] = (openBy[b.engine] || 0) + 1;
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
    let anyHit = false;
    for (const it of b.items) {
      it.tries++;
      const hit = list.find(x => x && norm(x.prompt) === norm(it.p.prompt_text)) || (list.length === b.items.length && !errs.length ? list[b.items.indexOf(it)] : null);
      if (hit && hit.answer) { anyHit = true; it.ok = true; it.res = hit; done.push(it); continue; }
      if (rl && (it.rl = (it.rl || 0) + 1) <= 4) { it.tries--; it.err = 'rate limited'; queues[it.engine].unshift(it); continue; }
      const er = errs.find(x => x && x.payload && norm(x.payload.prompt) === norm(it.p.prompt_text));
      it.err = er ? 'provider: ' + String(er.message || JSON.stringify(er)).slice(0, 400)
        : res && res.__timeout ? res.__timeout
        : res && res.__err ? 'call failed: ' + res.__err.slice(0, 300)
        : 'no answer for prompt in batch: ' + JSON.stringify(res || null).slice(0, 300);
      if (it.tries < triesFor(it.engine)) queues[it.engine].push(it);
      else { it.ok = false; done.push(it); }
    }
    // v18: a clean answered call resets the engine's rate-limit backoff, so one early 429 does not hold the engine at 120 s for the rest of the chunk.
    if (!rl && anyHit) rlHits[b.engine] = 0;
    done.forEach(x => finished.push(x));
    await saveCells(done);
  }

  async function worker() {
    while (true) {
      if (deadline - Date.now() < MIN_CALL_MS) return;
      while (inFlight >= concurrency && deadline - Date.now() >= MIN_CALL_MS) await sleep(1000);
      if (deadline - Date.now() < MIN_CALL_MS) return;
      const b = takeBatch();
      if (!b) {
        if (activeBatches === 0 && !engines.some(e => queues[e].length)) return;
        await sleep(2000);
        continue;
      }
      activeBatches++;
      try { await runBatch(b); } finally { activeBatches--; }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const leftover = [];
  for (const e of engines) for (const it of queues[e]) if (it.tries > 0) { it.ok = false; leftover.push(it); }
  leftover.forEach(x => finished.push(x));
  await saveCells(leftover);
  const untried = engines.reduce((a, e) => a + queues[e].filter(it => it.tries === 0).length, 0);
  const okN = finished.filter(x => x.ok).length;
  return { success: saveErrors.length === 0, action, mode, wrench_version: WRENCH_VERSION, processed: finished.length, answered: okN, errors: finished.length - okN, skippedForBudget: untried, skippedNoPlan, saved: finished.filter(x => x.saved).length, elapsedSec: Math.round((Date.now() - t0) / 1000), calls: stats.calls, callTimeouts: stats.callTimeouts, callErrors: stats.callErrors, rateLimited: stats.rateLimited, stillOpenCalls: inFlight, settings: { size, batchSize, perplexityBatchSize, concurrency, engineMax, budgetMs, maxTries, perplexityMaxTries, callTimeout }, byEngine: engines.reduce((a, e) => { const xs = finished.filter(x => x.engine === e); a[e] = { processed: xs.length, answered: xs.filter(x => x.ok).length }; return a; }, {}), retriesUsed: finished.filter(x => x.tries > 1).length, errorCells: finished.filter(x => !x.ok).slice(0, 30).map(x => [x.cell.sid, x.engine, String(x.err || '').slice(0, 100)]), supabaseOk: saveErrors.length === 0, saveErrors, dualWrite: dw };
}