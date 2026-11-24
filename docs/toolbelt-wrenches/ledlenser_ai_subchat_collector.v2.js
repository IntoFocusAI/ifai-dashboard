async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COLLECTOR = 'ledlenser_subchat_v1';
  const ASSISTANT = '52a2934c-c2df-4e1a-8d1a-90088d72f0b5';
  const DEFAULT_LANES = [
    { engine: 'openai_api', provider: 'openai', model: 'gpt-6.1-sol' },
    { engine: 'gemini_api', provider: 'gemini', model: 'gemini-3.5-flash-lite' },
  ];
  const t0 = Date.now();
  const genUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const parse = r => { const t = typeof r === 'string' ? r : (r && r.result) || JSON.stringify(r); const m = String(t).match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/); return m ? JSON.parse(m[1]) : null; };
  const sbErr = r => { if (!r) return 'no response'; if (r.error) return (r.error.message || JSON.stringify(r.error)).slice(0, 400); const t = JSON.stringify(r); if (/HttpException|Failed to run sql/.test(t) && !/untrusted-data/.test(t)) return t.slice(0, 400); return null; };
  const sql = async q => { const r = await callTool(SB, 'execute_sql', { query: q }); const e = sbErr(r); if (e) throw new Error(e); return parse(r); };
  const sq = s => (s === null || s === undefined) ? 'NULL' : `'${String(s).replace(/\u0000/g, '').replace(/'/g, "''")}'`;
  const toArr = a => Array.isArray(a) ? a : (a ? String(a).replace(/^\{|\}$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')).filter(Boolean) : []);
  const jparse = v => typeof v === 'string' ? JSON.parse(v) : v;
  const tb = async (action, params) => {
    const r = await callTool('workspace', 'toolbelt', { action, params: JSON.stringify(params) });
    if (typeof r === 'string') { try { return JSON.parse(r); } catch (_) { return { raw: r }; } }
    return r;
  };
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const action = inputs.action || 'status';
  const prompts = await sql(`SELECT prompt_key, prompt_text, category, prompt_kind, analytical_intent, headline_denominator FROM ledlenser.ai_prompts WHERE active AND coalesce(probe_mode,'fixed')='fixed' ORDER BY prompt_key`);
  const hash = (await sql(`SELECT ledlenser.ai_prompt_set_hash() AS h`))[0].h;

  if (action === 'start') {
    const lanes = (Array.isArray(inputs.lanes) && inputs.lanes.length ? inputs.lanes : DEFAULT_LANES).slice(0, 9);
    for (const l of lanes) if (!/^[a-z0-9_]+$/.test(l.engine || '') || !l.provider || !l.model) return { success: false, error: 'each lane needs engine (a-z, 0-9, _), provider and model' };
    const repeats = Math.max(1, Math.min(50, Number(inputs.repeats || 3)));
    const expected = prompts.length * lanes.length * repeats;
    const runId = genUUID(), ts = new Date().toISOString();
    await sql(`INSERT INTO ledlenser.audit_runs (id, workflow_execution_id, trigger_type, started_at, status, metadata, run_kind, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls, answered_calls, error_calls, is_published) VALUES (${sq(runId)}, ${sq('ledlenser_subchat_' + runId)}, ${sq(inputs.auto === true ? 'scheduled' : 'manual')}, ${sq(ts)}, 'running', ${sq(JSON.stringify({ source: 'ledlenser_ai_subchat_collector', assistant_id: ASSISTANT, lanes, repeats, prompts_frozen: prompts.map(p => p.prompt_key), auto: inputs.auto === true }))}::jsonb, 'ai_subchat', 'running', ${sq(COLLECTOR)}, ${sq(hash)}, ${expected}, 0, 0, 0, false); SELECT 1 ok;`);
    return { success: true, action, audit_run_id: runId, lanes, repeats, prompts: prompts.length, expected_calls: expected };
  }

  if (action === 'tick') {
    const AUTO_LANES = [
      { engine: 'openai_api', provider: 'openai', model: 'gpt-6.1-sol' },
      { engine: 'gemini_api', provider: 'gemini', model: 'gemini-3.5-flash-lite' },
      { engine: 'claude_api', provider: 'anthropic', model: 'claude-sonnet-5-5' },
      { engine: 'crescent_api', provider: 'toolbelt', model: 'crescent-small' },
      { engine: 'grok_api', provider: 'xai', model: 'grok-4.7' },
    ];
    // Mon, Wed, Fri 08:00 UTC: the Ledlenser AI-Search battery slots, offset from Fender's Sun/Tue/Thu 06:00.
    const SLOT_DAYS = [1, 3, 5], SLOT_HOUR = 8;
    const now = new Date();
    let slot = null;
    for (let d = 0; d < 8 && !slot; d++) {
      const c = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d, SLOT_HOUR, 0, 0));
      if (SLOT_DAYS.includes(c.getUTCDay()) && c <= now) slot = c;
    }
    const maxTries = Math.max(1, Math.min(5, Number(inputs.maxTries || 3)));
    const cur = ((await sql(`SELECT id, run_state, started_at FROM ledlenser.audit_runs WHERE run_kind='ai_subchat' AND metadata->>'auto'='true' ORDER BY started_at DESC LIMIT 1`)) || [])[0];
    if (!cur || new Date(cur.started_at) < slot) {
      if (now - slot > 20 * 3600000) return { success: true, action, idle: true, message: 'no run due; next slot not reached', lastRun: cur || null };
      let closed = null;
      if (cur && cur.run_state === 'running') closed = await run({ action: 'finalize', audit_run_id: cur.id });
      const started = await run({ action: 'start', lanes: AUTO_LANES, repeats: Number(inputs.repeats || 3), auto: true });
      return { success: started.success, action, started: started.audit_run_id, expected_calls: started.expected_calls, slot: slot.toISOString(), closedPrevious: closed ? { id: cur.id, run_state: closed.run_state, answered: closed.answered } : null };
    }
    if (cur.run_state !== 'running') return { success: true, action, idle: true, message: 'latest scheduled run is ' + cur.run_state, audit_run_id: cur.id };
    const m0 = jparse((((await sql(`SELECT metadata FROM ledlenser.audit_runs WHERE id=${sq(cur.id)}`)) || [])[0] || {}).metadata) || {};
    const nCells = (m0.prompts_frozen || []).length * (m0.lanes || []).length * Math.max(1, Number(m0.repeats || 1));
    const counts = ((await sql(`SELECT count(*) AS n, count(*) FILTER (WHERE call_status='error' AND attempt_no < ${maxTries}) AS retriable FROM ledlenser.ai_simulations WHERE audit_run_id=${sq(cur.id)}`)) || [{}])[0];
    const missing = nCells - Number(counts.n || 0), retriable = Number(counts.retriable || 0);
    const chunkIn = { audit_run_id: cur.id, size: 200, concurrency: Number(inputs.concurrency || 15), budgetMs: Number(inputs.budgetMs || 500000), callMs: Number(inputs.callMs || 200000), maxTries };
    if (missing > 0) { const r = await run(Object.assign({ action: 'chunk', mode: 'missing' }, chunkIn)); return { success: r.success, action, audit_run_id: cur.id, phase: 'fill', missingBefore: missing, processed: r.processed, answered: r.answered, errors: r.errors, busy: r.busy || false, elapsedSec: r.elapsedSec }; }
    if (retriable > 0) { const r = await run(Object.assign({ action: 'chunk', mode: 'errors' }, chunkIn)); return { success: r.success, action, audit_run_id: cur.id, phase: 'retry', retriableBefore: retriable, processed: r.processed, answered: r.answered, errors: r.errors, busy: r.busy || false, elapsedSec: r.elapsedSec }; }
    const fin = await run({ action: 'finalize', audit_run_id: cur.id });
    const cost = {};
    for (const l of (m0.lanes || [])) { try { const c = await run({ action: 'cost', audit_run_id: cur.id, lane: l.engine }); cost[l.engine] = (c.per_lane || {})[l.engine] || null; } catch (e) { cost[l.engine] = 'cost failed: ' + String(e.message || e).slice(0, 120); } }
    return { success: true, action, audit_run_id: cur.id, phase: 'closed', run_state: fin.run_state, answered: fin.answered, errors: fin.errors, expected_calls: fin.expected_calls, cost };
  }

  const runId = inputs.audit_run_id;
  if (!runId || !uuidRe.test(runId)) return { success: false, error: 'audit_run_id required for ' + action };
  const runRow = ((await sql(`SELECT metadata, run_state, run_kind, prompt_set_hash FROM ledlenser.audit_runs WHERE id=${sq(runId)}`)) || [])[0];
  if (!runRow) return { success: false, error: 'run not found' };
  if (runRow.run_kind !== 'ai_subchat') return { success: false, error: 'not an ai_subchat run' };
  const meta = jparse(runRow.metadata) || {};
  const lanes = meta.lanes || DEFAULT_LANES;
  const repeats = Math.max(1, Number(meta.repeats || 1));
  const frozen = Array.isArray(meta.prompts_frozen) ? meta.prompts_frozen : prompts.map(p => p.prompt_key);
  const allPrompts = (await sql(`SELECT prompt_key, prompt_text, category, prompt_kind, analytical_intent, headline_denominator FROM ledlenser.ai_prompts ORDER BY prompt_key`)) || [];
  const byKey = Object.fromEntries(allPrompts.map(p => [p.prompt_key, p]));
  const runPrompts = frozen.map(k => byKey[k]).filter(Boolean);
  const expected = frozen.length * lanes.length * repeats;
  const rid = sq(runId);

  if (action === 'status' || action === 'finalize') {
    const c = (await sql(`SELECT count(*) AS n, count(*) FILTER (WHERE call_status='answered') AS answered, count(*) FILTER (WHERE call_status='error') AS errors FROM ledlenser.ai_simulations WHERE audit_run_id=${rid}`))[0];
    const pe = (await sql(`SELECT engine, model, count(*) AS n, count(*) FILTER (WHERE call_status='answered') AS answered, count(*) FILTER (WHERE outcome='brand_win') AS brand_wins, count(*) FILTER (WHERE outcome IN ('brand_win','competitor_win','unresolved')) AS scored FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} GROUP BY 1,2 ORDER BY 1`)) || [];
    const n = Number(c.n), answered = Number(c.answered), errors = Number(c.errors);
    const out = { rows: n, answered, errors, expected_calls: expected, missing_rows: expected - n, run_state: runRow.run_state, per_lane: pe };
    if (action === 'status') return { success: true, action, ...out };
    const state = (answered === expected && errors === 0) ? 'completed' : (answered > 0 ? 'partial' : 'failed');
    await sql(`UPDATE ledlenser.audit_runs SET run_state=${sq(state)}, status=${sq(state === 'failed' ? 'failed' : 'completed')}, completed_at=${sq(new Date().toISOString())}, attempted_calls=${n}, answered_calls=${answered}, error_calls=${errors}, expected_calls=${expected} WHERE id=${rid} AND run_kind='ai_subchat'; SELECT 1 ok;`);
    return { success: true, action, ...out, run_state: state };
  }

  if (action === 'cost') {
    const rows = (await sql(`SELECT engine, source_ref FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND source_ref IS NOT NULL${inputs.lane ? ' AND engine=' + sq(inputs.lane) : ''}`)) || [];
    const per = {}; let failures = 0;
    for (let i = 0; i < rows.length; i += 6) {
      await Promise.all(rows.slice(i, i + 6).map(async r => {
        try {
          const ch = await tb('get_chat', { chatId: r.source_ref, assistantId: ASSISTANT });
          const p = per[r.engine] || (per[r.engine] = { chats: 0, credits: 0, tokens: 0 });
          p.chats++; p.credits += Number(ch.totalCreditsUsed || 0); p.tokens += Number(ch.totalTokensUsed || 0);
        } catch (_) { failures++; }
      }));
    }
    for (const p of Object.values(per)) p.credits_per_answer = p.chats ? Math.round(p.credits / p.chats * 100) / 100 : null;
    await sql(`UPDATE ledlenser.audit_runs SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(${sq(inputs.lane ? 'cost_' + inputs.lane : 'cost')}, ${sq(JSON.stringify({ per_lane: per, measured_at: new Date().toISOString(), failures }))}::jsonb) WHERE id=${rid}; SELECT 1 ok;`);
    return { success: true, action, per_lane: per, failures };
  }

  if (action !== 'chunk' && action !== 'rescore') return { success: false, error: 'unknown action ' + action };

  // Same scoring as ledlenser_ai_search_battery.
  const cc = ((await sql(`SELECT display_name, brand_name_terms, competitor_brands FROM ledlenser.client_config WHERE client_key='ledlenser'`)) || [])[0] || {};
  const BRAND_LABEL = cc.display_name || 'Ledlenser';
  const brandTerms = Array.from(new Set(toArr(cc.brand_name_terms).concat(['led-lenser']).map(s => s.toLowerCase())));
  const competitors = (jparse(cc.competitor_brands) || []).map(c => ({ name: c.name, terms: (c.terms || [c.name]).map(String) }));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  if (action === 'rescore') {
    const rows = (await sql(`SELECT id, answer_text, outcome, primary_brand FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND call_status='answered' AND coalesce(prompt_kind,'') <> 'probe' AND answer_text IS NOT NULL`)) || [];
    const stmts = [];
    for (const r of rows) {
      const sc = score(String(r.answer_text));
      if (sc.outcome === r.outcome && (sc.brand || null) === (r.primary_brand || null)) continue;
      stmts.push(`UPDATE ledlenser.ai_simulations SET outcome=${sq(sc.outcome)}, primary_brand=${sq(sc.brand)}, winner=${sq(sc.label)}, brand_win_rate=${sc.outcome === 'brand_win' ? 100 : 0}, updated_at=${sq(new Date().toISOString())} WHERE id=${sq(r.id)};`);
    }
    for (let i = 0; i < stmts.length; i += 100) await sql('BEGIN;\n' + stmts.slice(i, i + 100).join('\n') + '\nCOMMIT;\nSELECT 1 ok;');
    const after = (await sql(`SELECT engine, count(*) FILTER (WHERE outcome='brand_win') AS brand_wins, count(*) FILTER (WHERE outcome='competitor_win') AS competitor_wins, count(*) FILTER (WHERE outcome='unresolved') AS unresolved FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND call_status='answered' GROUP BY 1 ORDER BY 1`)) || [];
    return { success: true, action, checked: rows.length, changed: stmts.length, by_lane: after };
  }

  if (runRow.run_state !== 'running') return { success: false, error: 'run is ' + runRow.run_state };
  const mode = inputs.mode || 'missing';
  const size = Math.max(1, Math.min(200, Number(inputs.size || 24)));
  const concurrency = Math.max(1, Math.min(15, Number(inputs.concurrency || 4)));
  const laneIdx = inputs.lane ? lanes.findIndex(l => l.engine === inputs.lane) : -1;
  if (inputs.lane && laneIdx < 0) return { success: false, error: 'lane ' + inputs.lane + ' is not in this run' };
  const laneCond = laneIdx >= 0 ? ` AND g.k = ${laneIdx}` : '';
  const budgetMs = Math.max(60000, Number(inputs.budgetMs || 420000));
  const deadline = t0 + budgetMs;
  const CALL_MS = Math.max(60000, Math.min(300000, Number(inputs.callMs || 125000)));
  const lockKey = 'subchat_lock_' + runId.slice(0, 8) + '_' + (inputs.lane || 'all');
  const nowIso = new Date().toISOString();
  const holdUntil = new Date(Date.now() + budgetMs + 150000).toISOString();
  const got = await sql(`INSERT INTO ledlenser.job_state (job_key, cursor_offset, last_run_at, extra, updated_at) VALUES (${sq(lockKey)}, 0, ${sq(holdUntil)}, '{}'::jsonb, ${sq(nowIso)}) ON CONFLICT (job_key) DO UPDATE SET last_run_at = EXCLUDED.last_run_at, updated_at = EXCLUDED.updated_at WHERE ledlenser.job_state.last_run_at < ${sq(nowIso)}::timestamptz RETURNING job_key`);
  if (!got || !got.length) return { success: true, action, lane: inputs.lane || null, busy: true, processed: 0, message: 'another worker is already working on this lane' };
  const cond = mode === 'errors' ? `s.call_status = 'error' AND s.attempt_no < ${Math.max(1, Math.min(5, Number(inputs.maxTries || 99)))}` : 's.id IS NULL';
  const pending = await sql(`WITH g AS (SELECT r, i, k, r*1000+i*10+k+1 AS sid FROM generate_series(1,${repeats}) r, generate_series(0,${runPrompts.length - 1}) i, generate_series(0,${lanes.length - 1}) k) SELECT g.r, g.i, g.k, g.sid FROM g LEFT JOIN ledlenser.ai_simulations s ON s.audit_run_id=${rid} AND s.sim_id=g.sid WHERE ${cond}${laneCond} ORDER BY g.r, g.i, g.k LIMIT ${size}`) || [];
  const release = async () => { const rel = new Date().toISOString(); try { await sql(`UPDATE ledlenser.job_state SET last_run_at = ${sq(rel)}, updated_at = ${sq(rel)} WHERE job_key = ${sq(lockKey)}; SELECT 1 ok`); } catch (_) {} };
  if (!pending.length) { await release(); return { success: true, action, mode, processed: 0, message: 'no cells for this mode' }; }
  const facts = {};
  for (const f of (await sql(`SELECT prompt_key, claim, contradiction_pattern, source_url FROM ledlenser.ai_probe_facts`)) || []) facts[f.prompt_key] = f;

  function cellSql(r) {
    const ts = new Date().toISOString();
    const sid = r.cell.sid, p = r.p;
    const q = [];
    let o;
    if (r.ok) {
      const full = r.answer;
      const sc = score(full);
      const cites = []; const seen = new Set();
      for (const m of full.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
        const url = m[0].replace(/[.,;:]+$/, '');
        if (seen.has(url)) continue;
        const d = domainOf(url); if (!d) continue;
        seen.add(url); cites.push({ url, d });
      }
      const probe = p.prompt_kind === 'probe';
      let mh = 'not_evaluated', ev = null, rc = null;
      if (probe && facts[p.prompt_key]) {
        let re = null; try { re = new RegExp(facts[p.prompt_key].contradiction_pattern, 'i'); } catch (_) {}
        const m = re ? full.match(re) : null;
        if (m) { mh = 'confirmed'; ev = full.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80); rc = 'Answer contradicts verified fact: ' + facts[p.prompt_key].claim + ' (' + facts[p.prompt_key].source_url + ')'; }
        else mh = 'none';
      }
      o = { call_status: 'answered', outcome: probe ? 'not_scored' : sc.outcome, brand: probe ? null : sc.brand, label: sc.label, mh, ev, rc, full, cites, err: null };
    } else {
      o = { call_status: 'error', outcome: 'error', brand: null, label: 'Error', mh: 'not_evaluated', ev: null, rc: null, full: null, cites: [], err: String(r.err || 'unknown').slice(0, 500) };
    }
    q.push(`INSERT INTO ledlenser.ai_simulations (id, audit_run_id, sim_id, category, prompt, brand_win_rate, winner, citations, hallucination_flag, root_cause, remediation_patch, created_at, updated_at, answer_text, citation_urls, engine, repeat_no, prompt_key, prompt_text, prompt_kind, model, call_status, outcome, primary_brand, material_hallucination, hallucination_evidence, attempt_no, error_message, record_origin, source_ref, analytical_intent, headline_denominator) VALUES (${sq(genUUID())}, ${rid}, ${sid}, ${sq(p.category)}, ${sq(p.prompt_text)}, ${o.outcome === 'brand_win' ? 100 : 0}, ${sq(o.label)}, ${sq(o.cites.map(c => c.url).join('; '))}, ${o.mh === 'confirmed'}, ${sq(o.rc)}, NULL, ${sq(ts)}, ${sq(ts)}, ${sq(o.full)}, ${sq(o.cites.map(c => c.url).join(' | '))}, ${sq(r.lane.engine)}, ${r.cell.r}, ${sq(p.prompt_key)}, ${sq(p.prompt_text)}, ${sq(p.prompt_kind)}, ${sq(r.servedModel || r.lane.model)}, ${sq(o.call_status)}, ${sq(o.outcome)}, ${sq(o.brand)}, ${sq(o.mh)}, ${sq(o.ev)}, ${r.tries}, ${sq(o.err)}, ${sq(COLLECTOR)}, ${sq(r.chatId)}, ${sq(p.analytical_intent)}, ${sq(p.headline_denominator)}) ON CONFLICT (audit_run_id, sim_id) DO UPDATE SET brand_win_rate=EXCLUDED.brand_win_rate, winner=EXCLUDED.winner, citations=EXCLUDED.citations, hallucination_flag=EXCLUDED.hallucination_flag, root_cause=EXCLUDED.root_cause, updated_at=EXCLUDED.updated_at, answer_text=EXCLUDED.answer_text, citation_urls=EXCLUDED.citation_urls, model=EXCLUDED.model, call_status=EXCLUDED.call_status, outcome=EXCLUDED.outcome, primary_brand=EXCLUDED.primary_brand, material_hallucination=EXCLUDED.material_hallucination, hallucination_evidence=EXCLUDED.hallucination_evidence, attempt_no=ledlenser.ai_simulations.attempt_no + 1, error_message=EXCLUDED.error_message, source_ref=EXCLUDED.source_ref;`);
    q.push(`DELETE FROM ledlenser.ai_citations WHERE simulation_id IN (SELECT id FROM ledlenser.ai_simulations WHERE audit_run_id=${rid} AND sim_id=${sid});`);
    o.cites.forEach((c, idx) => {
      q.push(`INSERT INTO ledlenser.ai_citations (id, created_at, simulation_id, audit_run_id, sim_id, engine, position, url, domain, title) SELECT ${sq(genUUID())}::uuid, ${sq(ts)}::timestamptz, s.id, s.audit_run_id, s.sim_id, s.engine, ${idx + 1}, ${sq(c.url)}, ${sq(c.d)}, NULL FROM ledlenser.ai_simulations s WHERE s.audit_run_id=${rid} AND s.sim_id=${sid} ON CONFLICT (simulation_id, position) DO NOTHING;`);
    });
    return 'BEGIN;\n' + q.join('\n') + '\nCOMMIT;\nSELECT 1 ok;';
  }

  // A sub-chat started from a wrench returns a delegation receipt; the answer is read from the callee chat.
  async function collect(corr, until) {
    let chatId = null;
    while (Date.now() < until) {
      try {
        if (!chatId) {
          const st = await callTool('workspace', 'manage_delegations', { action: 'status', correlationId: corr });
          const s = typeof st === 'string' ? JSON.parse(st) : st;
          chatId = (s && s.calleeChatId) || null;
        }
        if (chatId) {
          const ch = await tb('get_chat', { chatId, assistantId: ASSISTANT });
          const msgs = (ch && ch.messages) || [];
          const last = [...msgs].reverse().find(m => m.role === 'assistant' && String(m.content || '').trim());
          if (last && !ch.isProcessing) {
            const servedBy = [...msgs].reverse().find(m => m.role === 'assistant' && m.model);
            const meta = { chatId, servedModel: (servedBy && servedBy.model) || null, credits: Number(ch.totalCreditsUsed || 0) };
            const toolsRun = msgs.filter(m => m.role === 'tool').map(m => m.name || 'tool');
            if (toolsRun.length) return Object.assign({ ok: false, err: 'Rejected: a tool ran (' + Array.from(new Set(toolsRun)).join(', ') + '), so this is not a model-knowledge answer.' }, meta);
            if (/maximum number of message iterations/i.test(String(last.content))) return Object.assign({ ok: false, err: 'No answer: the assistant tried a tool and hit its step limit.' }, meta);
            const answer = String(last.content).replace(/^[\s\S]*<\/think>\s*/i, '').trim();
            if (!answer) return Object.assign({ ok: false, err: 'No answer after the model reasoning.' }, meta);
            return Object.assign({ ok: true, answer }, meta);
          }
        }
      } catch (_) {}
      await sleep(4000);
    }
    return { ok: false, err: 'no answer within the call limit (delegation ' + corr + ')', chatId };
  }

  async function one(cell) {
    const p = runPrompts[cell.i], lane = lanes[cell.k];
    if (!p) return { ok: false, cell, p: { prompt_key: frozen[cell.i], prompt_text: '', category: null, prompt_kind: null }, lane, err: 'prompt no longer in the prompt list', tries: 1, chatId: null };
    let res;
    try { res = await tb('create_sub_chat', { targetAssistantId: ASSISTANT, content: p.prompt_text, provider: lane.provider, model: lane.model, waitForResponse: false, priority: 'normal' }); }
    catch (e) { return { ok: false, cell, p, lane, err: String(e.message || e), tries: 1, chatId: null }; }
    const corr = (JSON.stringify(res || '').match(/dlg_[0-9a-f-]{36}/) || [])[0];
    if (!corr) return { ok: false, cell, p, lane, err: 'no delegation id: ' + JSON.stringify(res || null).slice(0, 300), tries: 1, chatId: null };
    const gotA = await collect(corr, Date.now() + CALL_MS);
    return Object.assign({ cell, p, lane, tries: 1 }, gotA);
  }

  const queue = pending.map(c => ({ r: Number(c.r), i: Number(c.i), k: Number(c.k), sid: Number(c.sid) }));
  const finished = [], saveErrors = [];
  let qi = 0;
  async function worker() {
    while (qi < queue.length) {
      if (deadline - Date.now() < CALL_MS) return;
      const cell = queue[qi++];
      const r = await one(cell);
      try { await sql(cellSql(r)); r.saved = true; } catch (e) { r.saved = false; saveErrors.push([cell.sid, String(e.message || e).slice(0, 200)]); }
      finished.push(r);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await release();
  const okN = finished.filter(x => x.ok).length;
  const firstOk = finished.find(x => x.ok);
  return { success: saveErrors.length === 0, action, mode, lane: inputs.lane || null, processed: finished.length, answered: okN, errors: finished.length - okN, skippedForBudget: queue.length - qi, elapsedSec: Math.round((Date.now() - t0) / 1000), byLane: lanes.map(l => ({ engine: l.engine, processed: finished.filter(x => x.lane.engine === l.engine).length, answered: finished.filter(x => x.ok && x.lane.engine === l.engine).length })), errorCells: finished.filter(x => !x.ok).slice(0, 10).map(x => [x.cell.sid, x.lane.engine, String(x.err).slice(0, 150)]), sample: firstOk ? { sid: firstOk.cell.sid, chatId: firstOk.chatId, answer: firstOk.answer.slice(0, 300) } : null, saveErrors };
}