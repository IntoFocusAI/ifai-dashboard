async function run(inputs) {
  // v4: dollars at the Toolbelt per-credit price, 3/7/30-day averages with their N, monthly run rate,
  // per-product dollars. NEVER_POST=true makes this a read-only preview (no Slack, no state write).
  // v5 (20 Nov 2026): counted-run memory kept 48h instead of 8h. Since 17 Nov the latest 100 run chats span
  // ~10.5h, so v3 counted runs 2-3 times. One-time repair: mark already-counted chats as seen and scale the
  // 17-19 Nov job totals down to the runs that actually happened (V5_ACTUAL_RUNS).
  const SEEN_KEEP_MS = 48 * 3600e3;
  const RUNS_PER_DAY = { 'AI Search battery worker': 48, 'Copy upkeep': 24, "Musician's Friend MAP checker": 24, 'AI battery stall alert': 12, 'Copy drift checks': 12, 'Daily cost report': 24, 'Slack watchdog': 24, 'Findability recheck': 48, 'Workflow: Fender Buy Box seller harvester (every 6h)': 4, 'Workflow: Fender catalog harvester (every 6h)': 4, 'Keepa listing content refresh': 1, 'Site type classifier (IntoFocus dashboard, decisio': 1, 'Site type classifier': 1, 'AI Search run start': 1 };
  const V5_ACTUAL_RUNS = { '2026-11-17': RUNS_PER_DAY, '2026-11-18': RUNS_PER_DAY, '2026-11-19': RUNS_PER_DAY };
  const NEVER_POST = false;
  const DEFAULT_CREDIT_USD = 0.008333; // Marc Savy, 16 Nov 2026 ($500 / 60,000 credits)
  const DRY = NEVER_POST || inputs.dryRun === true;
  const CHANNEL = inputs.channel || 'C0CHBBUHJ0L';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const ASSISTANT = '8a2db70d-9381-421f-a057-e47fba63a5f1';
  const STATE_FILE = 'cost/cost_state.json';
  const REPORT_HOUR_ET = 7;
  const now = Date.now();
  const MIN = 60e3;

  // ---------- helpers ----------
  const text = r => {
    if (r == null) return '';
    if (typeof r === 'string') return r;
    if (typeof r.result === 'string') return r.result;
    if (Array.isArray(r.content)) return r.content.map(c => (c && c.text) || '').join('\n');
    if (typeof r.text === 'string') return r.text;
    return JSON.stringify(r);
  };
  const jsonOf = r => {
    if (r && typeof r === 'object' && !Array.isArray(r) && r.content === undefined && r.result === undefined && r.text === undefined) return r;
    if (Array.isArray(r)) return r;
    const t = text(r);
    try { return JSON.parse(t); } catch (e) {
      const i = t.search(/[\[{]/);
      if (i >= 0) { try { return JSON.parse(t.slice(i)); } catch (_) {} }
      throw new Error('Not JSON: ' + t.slice(0, 200));
    }
  };
  const tb = async (action, params) => jsonOf(await callTool('workspace', 'toolbelt', { action, params: JSON.stringify(params || {}) }));
  async function sql(q) {
    const r = await callTool(SB, 'execute_sql', { query: q });
    const t = text(r);
    const m = t.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    throw new Error('Supabase: ' + t.slice(0, 300));
  }
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { error: String(e.message || e).slice(0, 200) }; } }
    }));
    return out;
  }
  function etParts(ms) {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(ms))) p[x.type] = x.value;
    return p;
  }
  const dayKey = ms => { const p = etParts(ms); return `${p.year}-${p.month}-${p.day}`; };
  const MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayLabel = k => { const [y, m, d] = k.split('-').map(Number); const wd = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }); return `${wd} ${d} ${MONS[m - 1]}`; };
  const prevDay = k => { const [y, m, d] = k.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d - 1, 12)); return t.toISOString().slice(0, 10); };
  const etTime = ms => { const p = etParts(ms); return `${Number(p.day)} ${MONS[Number(p.month) - 1]}, ${p.hour}:${p.minute} ET`; };
  const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const usdFmt = v => {
    if (v >= 100) return '$' + fmt(v);
    if (v >= 0.01) return '$' + v.toFixed(2);
    if (v === 0) return '$0';
    return '$' + Number(v.toPrecision(2)).toString();
  };
  function periodHours(rec) {
    const r = String(rec || '');
    let m = r.match(/Every (\d+) hours?/i); if (m) return Number(m[1]);
    m = r.match(/Every (\d+) minutes?/i); if (m) return Number(m[1]) / 60;
    if (/^Daily/i.test(r)) return 24;
    if (/^Weekdays/i.test(r)) return 24 * 7 / 5;
    if (/^Weekends/i.test(r)) return 24 * 7 / 2;
    if (/^Weekly/i.test(r)) return 168;
    if (/^Monthly/i.test(r)) return 730;
    return null;
  }

  // ---------- job names and product bases ----------
  const JOBS = [
    { m: 'fender_spec_readiness_audit', name: 'Spec readiness checker' },
    { m: '964a76a0', name: 'Dashboard metrics sync' },
    { m: 'Start the AI simulation battery', name: 'AI Search run start' },
    { m: 'AI battery worker', name: 'AI Search battery worker' },
    { m: 'Retry pass for the weekly AI simulation battery', name: 'AI Search battery retry' },
    { m: 'fender_retail_buybox_map_audit', name: 'Walmart MAP checker', basis: 'walmart' },
    { m: 'fender_map_checker_musiciansfriend', name: "Musician's Friend MAP checker", basis: 'mf' },
    { m: '5be13583', name: 'Omnichannel sync (Buy Box and featured offer)', basis: 'amazon' },
    { m: 'fender_buybox_seller_harvester', name: 'Buy Box seller harvester', basis: 'amazon' },
    { m: 'fender_catalog_harvester', name: 'Daily catalog harvester' },
    { m: 'Copy upkeep', name: 'Copy upkeep' },
    { m: 'fender_keepa_history_harvester', name: 'Keepa history harvester', basis: 'amazon' },
    { m: 'fender_keepa_content_enrich', name: 'Keepa listing content refresh', basis: 'amazon' },
    { m: 'fender_smartscout_snapshot', name: 'SmartScout snapshot', basis: 'amazon' },
    { m: 'Monday health check', name: 'Monday AI Search check' },
    { m: 'Stall alert for the AI battery', name: 'AI battery stall alert' },
    { m: 'fmic_sandbox_drift_check', name: 'Copy drift checks' },
    { m: 'Scheduled AI sub-chat lane', name: 'AI sub-chat lane' },
    { m: 'site_type_classifier_21a', name: 'Site type classifier' },
    { m: 'fender_slack_watchdog', name: 'Slack watchdog' },
    { m: 'fender_daily_cost_report', name: 'Daily cost report' }
  ];
  const BASIS_LABEL = { catalog: 'catalog product', amazon: 'Amazon listing tracked', walmart: 'Walmart-matched product', mf: "Musician's Friend-matched product" };

  // ---------- state ----------
  let state = { days: {}, seen: {}, reported: {}, creditUsd: null, startedAt: now };
  try {
    const r = await callTool('workspace', 'read_storage_file', { fileName: STATE_FILE, raw: true, force: true });
    const t = text(r); const i = t.indexOf('{');
    if (i >= 0) { const s = JSON.parse(t.slice(i)); if (s && s.days) state = s; }
  } catch (_) { /* first run */ }
  if (typeof inputs.creditUsd === 'number') state.creditUsd = inputs.creditUsd;
  const usd = (typeof state.creditUsd === 'number' && state.creditUsd > 0) ? state.creditUsd : DEFAULT_CREDIT_USD;

  // ---------- tasks -> job names and expected runs ----------
  const lt = await tb('list_scheduled_tasks', {});
  const tasks = (lt.tasks || []).filter(t => t.assistantId === ASSISTANT);
  const jobOfDesc = d => { const j = JOBS.find(x => d.includes(x.m)); return j ? j.name : null; };
  const taskIndex = tasks.map(t => { const d = String(t.description || t.name || ''); return { prefix: d.slice(0, 45).trim(), name: jobOfDesc(d) || d.slice(0, 50).trim(), active: t.isActive, rec: t.recurrence }; });
  const expected = {};
  for (const t of taskIndex) { if (!t.active) continue; const ph = periodHours(t.rec); if (ph) expected[t.name] = (expected[t.name] || 0) + 24 / ph; }
  function jobOfTitle(title) {
    const tt = String(title || '');
    const core = tt.replace(/ - [A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M\s*$/, '');
    if (core.startsWith('Scheduled: ')) {
      const body = core.slice(11);
      const hit = taskIndex.find(t => t.prefix && body.startsWith(t.prefix));
      return hit ? hit.name : (jobOfDesc(body) || 'Other task: ' + body.slice(0, 40).trim());
    }
    if (core.startsWith('Workflow: ')) { const w = core.slice(10); return /watchdog/i.test(w) ? 'Slack watchdog' : /cost/i.test(w) ? 'Daily cost report' : /Findability/i.test(w) ? 'Findability recheck' : 'Workflow: ' + w; }
    return 'Other: ' + core.slice(0, 40);
  }

  // ---------- collect ----------
  const lc = await tb('list_chats', { assistantId: ASSISTANT, type: 'events', limit: 100 });
  const listed = lc.chats || [];
  const oldestListed = listed.length ? Date.parse(listed[listed.length - 1].createdAt) : now;
  const lastCollect = state.lastCollectAt || null;
  const gap = lastCollect && oldestListed > lastCollect - 30 * MIN;
  // v5 one-time repair (see header). v3 counted every finished chat when first seen, so listed chats older
  // than its 8h memory were counted already.
  let repair = null;
  if (state.collectorV !== 5) {
    repair = { seeded: 0, corrected: {}, backup: DRY ? null : 'cost/cost_state_pre_v5.json' };
    if (!DRY) await callTool('workspace', 'write_text_file', { fileName: 'cost/cost_state_pre_v5.json', content: JSON.stringify(state), allowOverwrite: true, waitForUpload: true });
    for (const c of listed) { const at = Date.parse(c.createdAt); if (!state.seen[c.id] && now - at > 8 * 3600e3) { state.seen[c.id] = at; repair.seeded++; } }
    for (const [dk, caps] of Object.entries(V5_ACTUAL_RUNS)) {
      const day = state.days[dk]; if (!day) continue;
      for (const [name, cap] of Object.entries(caps)) {
        const j = day.jobs[name]; if (!j || j.runs <= cap) continue;
        const f = cap / j.runs;
        repair.corrected[dk + ' ' + name] = { runs: `${j.runs}->${cap}`, credits: `${j.cr}->${Math.round(j.cr * f)}` };
        j.cr = Math.round(j.cr * f); j.tok = Math.round(j.tok * f); j.runs = cap;
      }
      day.corrected = 'v5: runs counted 2-3 times by the v3 collector; job totals scaled to the runs that happened';
    }
    state.collectorV = 5;
  }
  const todo = listed.filter(c => !state.seen[c.id] && now - Date.parse(c.createdAt) > 20 * MIN);
  const got = await pool(todo, 8, async c => {
    const g = await tb('get_chat', { chatId: c.id, assistantId: ASSISTANT, messageLimit: 1 });
    if (g.isProcessing) return { skip: true };
    return { id: c.id, at: Date.parse(c.createdAt), job: jobOfTitle(c.title), cr: Number(g.totalCreditsUsed) || 0, tok: Number(g.totalTokensUsed) || 0 };
  });
  let added = 0, errors = [];
  for (const r of got) {
    if (!r || r.skip) continue;
    if (r.error) { errors.push(r.error); continue; }
    const dk = dayKey(r.at);
    const day = state.days[dk] || (state.days[dk] = { jobs: {}, firstSeenAt: r.at, gaps: 0 });
    day.firstSeenAt = Math.min(day.firstSeenAt || r.at, r.at);
    const j = day.jobs[r.job] || (day.jobs[r.job] = { cr: 0, tok: 0, runs: 0 });
    j.cr += r.cr; j.tok += r.tok; j.runs += 1;
    state.seen[r.id] = r.at; added++;
  }
  if (gap) { const dk = dayKey(now); (state.days[dk] || (state.days[dk] = { jobs: {}, firstSeenAt: now, gaps: 0 })).gaps = ((state.days[dk] || {}).gaps || 0) + 1; }
  if (!state.startedAt) state.startedAt = now;
  state.lastCollectAt = now;
  for (const [id, at] of Object.entries(state.seen)) if (now - at > SEEN_KEEP_MS) delete state.seen[id];
  const keys = Object.keys(state.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete state.days[k];

  // ---------- report ----------
  const today = dayKey(now);
  const yday = prevDay(today);
  const hourEt = Number(etParts(now).hour);
  const target = inputs.reportDate || ((hourEt >= REPORT_HOUR_ET && !state.reported[yday] && state.days[yday]) ? yday : null);
  let report = null, sent = false, sendError = null;
  if (target && state.days[target]) {
    const day = state.days[target];
    const dayCr = d => Object.values(d.jobs).reduce((s, j) => s + j.cr, 0);
    const total = dayCr(day);
    const runs = Object.values(day.jobs).reduce((s, j) => s + j.runs, 0);
    const counts = {};
    const q = { catalog: 'SELECT count(*)::int n FROM command.fmic_electric_catalog', amazon: 'SELECT count(*)::int n FROM command.fmic_retail_buybox_map', walmart: 'SELECT count(*)::int n FROM command.fmic_retail_buybox_map WHERE wmt_checked_at IS NOT NULL', mf: 'SELECT count(*)::int n FROM command.fmic_retail_buybox_map WHERE mf_checked_at IS NOT NULL' };
    for (const [k, s] of Object.entries(q)) { try { counts[k] = (await sql(s))[0].n; } catch (e) { counts[k] = null; } }
    const D = cr => cr * usd;
    // full days only (counting started within 1h of midnight ET), looking back `n` calendar days
    const isFull = k => state.days[k] && state.days[k].firstSeenAt <= Date.parse(k + 'T05:00:00Z') + 60 * MIN;
    const window = n => { const out = []; let k = target; for (let i = 0; i < n; i++) { k = prevDay(k); if (isFull(k)) out.push(state.days[k]); } return out; };
    const prior = window(7); // also used for job jumps
    const partial = day.firstSeenAt > Date.parse(target + 'T05:00:00Z') + 60 * MIN && state.startedAt > Date.parse(target + 'T00:00:00Z');
    const lines = [];
    lines.push(`💰 Fender daily run cost: ${dayLabel(target)}${partial ? ' (partial day)' : ''}`);
    lines.push(`Total: ${usdFmt(D(total))} (${fmt(total)} credits) across ${fmt(runs)} runs`);
    const perLines = [];
    if (counts.catalog) perLines.push(`${usdFmt(D(total) / counts.catalog)} per catalog product (÷ ${fmt(counts.catalog)})`);
    if (counts.amazon) perLines.push(`${usdFmt(D(total) / counts.amazon)} per Amazon listing tracked (÷ ${fmt(counts.amazon)})`);
    if (perLines.length) lines.push(`Per product: ${perLines.join(' · ')}`);
    // averages: 3, 7, 30 days, each shown with its N until full
    let avg7 = null;
    const avgLines = [];
    for (const n of [3, 7, 30]) {
      const w = window(n);
      if (!w.length) continue;
      const a = w.reduce((s, d) => s + dayCr(d), 0) / w.length;
      if (n === 7) avg7 = a;
      const pct = a ? Math.round((total - a) / a * 100) : 0;
      const nLabel = w.length < n ? ` (${w.length} of ${n} days)` : '';
      avgLines.push(`• ${n}-day avg${nLabel}: ${usdFmt(D(a))}/day (${fmt(a)} credits) · this day ${pct >= 0 ? '+' : ''}${pct}%`);
    }
    if (avgLines.length) { lines.push('', 'Averages (before this day):', ...avgLines); }
    else lines.push('Averages: build up from the next full day');
    if (avg7 != null) {
      const mo = D(avg7) * 30;
      const moPer = counts.catalog ? ` · ${usdFmt(mo / counts.catalog)} per catalog product` : '';
      lines.push(`Monthly run rate (7-day avg × 30): ${usdFmt(mo)}${moPer}`);
    }
    if (partial) lines.push(`Partial day: counting started ${etTime(day.firstSeenAt)}.`);
    const jobs = Object.entries(day.jobs).sort((a, b) => b[1].cr - a[1].cr);
    lines.push('', 'Top jobs:');
    jobs.slice(0, 5).forEach(([name, j], i) => {
      const def = JOBS.find(x => x.name === name) || {};
      const basis = def.basis && counts[def.basis] ? def.basis : 'catalog';
      const per = counts[basis] ? ` · ${usdFmt(D(j.cr) / counts[basis])} per ${BASIS_LABEL[basis]} (${fmt(counts[basis])})` : '';
      lines.push(`${i + 1}. ${name}: ${usdFmt(D(j.cr))} (${fmt(j.cr)} credits, ${total ? Math.round(j.cr / total * 100) : 0}%), ${fmt(j.runs)} runs${per}`);
    });
    if (jobs.length > 5) { const rest = jobs.slice(5).reduce((s, [, j]) => s + j.cr, 0); lines.push(`Other ${jobs.length - 5} jobs: ${usdFmt(D(rest))} (${fmt(rest)} credits)`); }
    const jumps = [];
    if (prior.length >= 3) for (const [name, j] of jobs) {
      const avgJ = prior.reduce((s, d) => s + ((d.jobs[name] || {}).cr || 0), 0) / prior.length;
      if (j.cr >= 10 && j.cr > 2 * avgJ) jumps.push(`${name}: ${usdFmt(D(j.cr))} (${fmt(j.cr)} credits) vs ${usdFmt(D(avgJ))} average`);
    }
    if (jumps.length) lines.push('', '⚠️ Cost jumps (over 2× the job\'s average):', ...jumps.map(x => '• ' + x));
    const over = [];
    if (!partial) for (const [name, j] of jobs) { const e = expected[name]; if (e && j.runs > Math.ceil(e * 1.5) + 1) over.push(`${name}: ${fmt(j.runs)} runs, scheduled for about ${fmt(Math.max(1, e))}`); }
    if (over.length) lines.push('', '⚠️ Ran more often than scheduled:', ...over.map(x => '• ' + x));
    if (day.gaps) lines.push('', `Note: ${day.gaps} collection gap${day.gaps > 1 ? 's' : ''} this day, so some runs may be missing.`);
    if (day.corrected) lines.push('', 'Note: this day\'s totals were corrected for runs counted more than once (scaled to the runs that happened).');
    lines.push('', `Client: Fender only (this assistant's scheduled tasks and workflows). Dollars at $${usd} per Toolbelt credit. Not counted: people chatting with the assistant, scheduled tasks that run a wrench directly (Toolbelt stopped logging their runs on 17 Nov), and fixed subscriptions (Keepa, SmartScout, Supabase).`);
    report = lines.join('\n');
    if (!DRY) {
      try {
        const r = await callTool('workspace', 'send_external_message', { provider: 'slack', channel: CHANNEL, message: report });
        const t = text(r);
        if (/error|not found|failed/i.test(t) && !/sent/i.test(t)) throw new Error(t.slice(0, 200));
        sent = true; state.reported[target] = now;
      } catch (e) { sendError = String(e.message || e).slice(0, 200); }
    }
  }
  for (const rk of Object.keys(state.reported)) if (!state.days[rk]) delete state.reported[rk];

  if (!DRY) await callTool('workspace', 'write_text_file', { fileName: STATE_FILE, content: JSON.stringify(state), allowOverwrite: true, waitForUpload: true });

  return {
    success: !sendError && errors.length === 0,
    dryRun: DRY, creditUsd: usd,
    listed: listed.length, oldestListed: new Date(oldestListed).toISOString(), collectionGap: !!gap,
    newRunsCounted: added, errors: errors.slice(0, 5), repair,
    days: Object.fromEntries(Object.entries(state.days).slice(-5).map(([k, d]) => [k, { credits: Object.values(d.jobs).reduce((s, j) => s + j.cr, 0), usd: +(Object.values(d.jobs).reduce((s, j) => s + j.cr, 0) * usd).toFixed(2), corrected: !!d.corrected }])),
    today: state.days[today] ? { runs: Object.values(state.days[today].jobs).reduce((s, j) => s + j.runs, 0), credits: Object.values(state.days[today].jobs).reduce((s, j) => s + j.cr, 0) } : null,
    reportFor: target, report, sent, sendError
  };
}
