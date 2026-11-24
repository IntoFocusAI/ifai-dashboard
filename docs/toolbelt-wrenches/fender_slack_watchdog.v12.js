async function run(inputs) {
  const DRY = inputs.dryRun === true;
  const CHANNEL = inputs.channel || 'C0CGQ6EBL5V';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const ASSISTANT = '8a2db70d-9381-421f-a057-e47fba63a5f1';
  const FINDABILITY_WF = '1bb03a5c-7ec0-44d8-be2a-cd536280479f';
  const STATE_FILE = 'watchdog/slack_watchdog_state.json';
  const SELF = 'fender_slack_watchdog';
  const now = Date.now();
  const HOUR = 3600e3;

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
    if (/error/i.test(t)) throw new Error('Supabase: ' + t.slice(0, 300));
    return [];
  }
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { error: String(e.message || e).slice(0, 300) }; } }
    }));
    return out;
  }
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function et(ms) {
    try {
      const p = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) p[x.type] = x.value;
      return `${p.day} ${p.month}, ${p.hour}:${p.minute} ET`;
    } catch (e) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'; }
  }
  function dur(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m >= 2880) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  function titleTime(title) {
    const m = String(title || '').match(/ - ([A-Z][a-z]{2}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) ([AP]M)\s*$/);
    if (!m) return null;
    let h = Number(m[4]) % 12; if (m[6] === 'PM') h += 12;
    return Date.UTC(Number(m[3]), MON.indexOf(m[1]), Number(m[2]), h, Number(m[5]));
  }
  function periodHours(rec) {
    const r = String(rec || '');
    let m = r.match(/Every (\d+) hours?/i); if (m) return Number(m[1]);
    m = r.match(/Every (\d+) minutes?/i); if (m) return Number(m[1]) / 60;
    if (/^Daily/i.test(r)) return 24;
    if (/^Weekdays/i.test(r)) return 72;
    if (/^Weekends/i.test(r)) return 120;
    if (/^Weekly/i.test(r)) return 168;
    if (/^Monthly/i.test(r)) return 744;
    return 24;
  }
  const short = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  // v10: list_scheduled_tasks now returns name + descriptionPreview (shortened) instead of description.
  const descOf = t => String(t.description || t.descriptionPreview || '');

  // ---------- job catalogue for scheduled tasks (first match on the task text wins) ----------
  // Workflows are watched from the WORKFLOWS list in section 2, not from here.
  const JOBS = [
    { m: 'fender_spec_readiness_audit', name: 'Spec readiness checker', sev: 'red', affects: 'Spec readiness scores on the dashboard are going stale.' },
    { m: '964a76a0', name: 'Dashboard metrics sync', sev: 'red', affects: 'Headline numbers on the dashboard canvas are not being refreshed.' },
    { m: 'Start the AI simulation battery', name: 'AI Search run start', sev: 'red', affects: 'No new AI Search run starts, so the dashboard keeps showing the last published run.' },
    { m: 'AI battery worker', name: 'AI Search battery worker', sev: 'red', affects: 'The current AI Search run is not being answered, finalized or published.', ignore: /Wrench execution timeout after 540000ms/ },
    { m: 'Retry pass for the weekly AI simulation battery', name: 'AI Search battery retry', sev: 'red', affects: 'Missing AI Search answers are not being retried.' },
    { m: 'fender_retail_buybox_map_audit', name: 'Walmart MAP checker', sev: 'red', affects: 'Walmart prices and MAP leakage on the dashboard are going stale.' },
    { m: 'fender_map_checker_musiciansfriend', name: "Musician's Friend MAP checker", sev: 'red', affects: "Musician's Friend prices and MAP leakage on the dashboard are going stale." },
    { m: '5be13583', name: 'Omnichannel sync (Buy Box and featured offer)', sev: 'red', affects: 'Buy Box and featured offer figures on the dashboard are going stale.' },
    { m: 'fender_buybox_seller_harvester', name: 'Buy Box seller harvester (old scheduled task)', sev: 'red', affects: 'Buy Box seller names are not being refreshed.' },
    { m: 'fender_catalog_harvester', name: 'Catalog harvester (old scheduled task)', sev: 'red', affects: 'New Fender listings and price changes from Keepa are not being loaded.' },
    { m: 'Copy upkeep', name: 'Copy upkeep (prompt sync and write replay)', sev: 'orange', affects: 'The sandbox, mirror and Claude copies are not being caught up. Production and the dashboard are fine.' },
    { m: 'fender_keepa_history_harvester', name: 'Keepa history harvester', sev: 'red', affects: 'Daily sales rank and price history are not being updated, so out-of-stock and sales-loss figures go stale.' },
    { m: 'fender_keepa_content_enrich', name: 'Keepa listing content refresh', sev: 'red', affects: 'Listing description, A+ and video data are not being refreshed.' },
    { m: 'fender_smartscout_snapshot', name: 'SmartScout snapshot', sev: 'red', affects: 'SmartScout sales estimates are not being refreshed.' },
    { m: 'Monday health check', name: 'Monday AI Search check', sev: 'orange', affects: 'The weekly AI Search check is not running, so a failed run may go unreported.' },
    { m: 'Stall alert for the AI battery', name: 'AI battery stall alert', sev: 'orange', affects: 'The AI battery stall check is not running, so a stuck run may go unreported.' },
    { m: 'fmic_sandbox_drift_check', name: 'Copy drift checks', sev: 'orange', affects: 'The copies are not being compared with production. Production and the dashboard are fine.' },
    { m: 'Scheduled AI sub-chat lane', name: 'AI sub-chat lane', sev: 'orange', affects: 'The AI sub-chat lane run is not being answered or closed. It does not publish to the dashboard.' },
    { m: 'site_type_classifier_21a', name: 'Site type classifier', sev: 'red', affects: 'Newly cited domains are not being classified by site type.' }
  ];
  const DOT = { red: '🔴', orange: '🟠' };
  const problems = {}; // key -> { title, body }
  const checkErrors = [];
  const summary = [];

  // ---------- state (read first: v12 keeps each job's last run sighting in it) ----------
  let state = { open: {} };
  try {
    const r = await callTool('workspace', 'read_storage_file', { fileName: STATE_FILE, raw: true, force: true });
    const t = text(r);
    const i = t.indexOf('{');
    if (i >= 0) { const s = JSON.parse(t.slice(i)); if (s && s.open) state = s; }
  } catch (_) { /* first run: no state file */ }
  if (!state.lastSeen || typeof state.lastSeen !== 'object') state.lastSeen = {};

  // ---------- v8: each job's own run record ----------
  // Runs of wrench-type scheduled tasks stopped showing up in search_chats on 17 Nov 2026, so a job that records
  // its own run is also judged by that record. Last run = the newest of all sources.
  const JOB_STATE = {
    'Spec readiness checker': 'spec_readiness',
    'Walmart MAP checker': 'map_leakage_walmart',
    "Musician's Friend MAP checker": 'map_parity_musiciansfriend',
    'Omnichannel sync (Buy Box and featured offer)': 'featured_offer_keepa',
    'Keepa history harvester': 'keepa_history',
    'SmartScout snapshot': 'smartscout_snapshot' // v12
  };
  const recorded = {};       // job name -> { at, source }
  const STALE_OVERRIDE_H = {}; // job name -> alert threshold in hours
  let subchatIdle = false;
  try {
    const keys = Object.values(JOB_STATE).map(k => `'${k}'`).join(',');
    const rows = await sql(`SELECT job_key, last_run_at FROM command.fmic_job_state WHERE job_key IN (${keys})`);
    for (const [name, key] of Object.entries(JOB_STATE)) {
      const r = rows.find(x => x.job_key === key);
      const at = r ? Date.parse(r.last_run_at) : NaN;
      if (Number.isFinite(at)) recorded[name] = { at, source: 'job_state ' + key };
    }
  } catch (e) { checkErrors.push('job run records: ' + String(e.message || e).slice(0, 300)); }
  // v12: rows the job itself writes. Keepa content stamps content_checked_at on every listing it refreshes
  // (about 150 a day); each AI battery start task creates an ai_simulation row in fmic_audit_runs.
  try {
    const rows = await sql(`SELECT (SELECT max(content_checked_at) FROM command.fmic_listing_content) keepa_content, (SELECT max(started_at) FROM command.fmic_audit_runs WHERE run_kind = 'ai_simulation') ai_start`);
    const r = rows[0] || {};
    const kc = Date.parse(r.keepa_content), ai = Date.parse(r.ai_start);
    if (Number.isFinite(kc)) recorded['Keepa listing content refresh'] = { at: kc, source: 'newest content_checked_at in fmic_listing_content' };
    if (Number.isFinite(ai)) recorded['AI Search run start'] = { at: ai, source: 'newest ai_simulation run in fmic_audit_runs' };
  } catch (e) { checkErrors.push('job rows: ' + String(e.message || e).slice(0, 300)); }
  // Dashboard metrics sync rewrites fender-v3-spec.json only when a number changes, so its last write is a floor:
  // alert only after 26h with no write.
  try {
    const meta = jsonOf(await callTool('workspace', 'get_storage_file_metadata', { fileName: 'fender-v3-spec.json' }));
    const at = Date.parse(meta.updatedAt || (meta.metadata && meta.metadata.uploadedAt));
    if (Number.isFinite(at)) { recorded['Dashboard metrics sync'] = { at, source: 'last write of fender-v3-spec.json' }; STALE_OVERRIDE_H['Dashboard metrics sync'] = 26; }
  } catch (e) { checkErrors.push('metrics sync file: ' + String(e.message || e).slice(0, 300)); }
  // AI sub-chat lane: idle between runs. Watched only while a scheduled ai_subchat run (started in the last 24h) is open,
  // from its newest saved answer. Older 'running' rows are orphaned test runs.
  try {
    const rows = await sql(`SELECT r.started_at, (SELECT max(s.created_at) FROM command.fmic_ai_simulations s WHERE s.audit_run_id = r.id) last_row FROM command.fmic_audit_runs r WHERE r.run_kind = 'ai_subchat' AND r.run_state = 'running' AND r.started_at > now() - interval '24 hours' ORDER BY r.started_at DESC LIMIT 1`);
    if (!rows.length) subchatIdle = true;
    else {
      const at = Date.parse(rows[0].last_row || rows[0].started_at);
      if (Number.isFinite(at)) recorded['AI sub-chat lane'] = { at, source: 'newest answer in the open sub-chat run' };
      STALE_OVERRIDE_H['AI sub-chat lane'] = 2;
    }
  } catch (e) { checkErrors.push('sub-chat run: ' + String(e.message || e).slice(0, 300)); }

  // ---------- v12: newest 100 run chats from list_chats ----------
  // search_chats misses some run chats entirely (23 Nov 2026: the Keepa content and SmartScout runs of that morning
  // were in list_chats but search_chats returned nothing). list_chats only returns the newest 100 (about 11 hours),
  // so every sighting is also remembered in state.lastSeen and weekly jobs stay covered between runs.
  let recentChats = [];
  try {
    const lc = await tb('list_chats', { assistantId: ASSISTANT, type: 'events', limit: 100 });
    recentChats = (lc.chats || []).filter(c => String(c.title || '').startsWith('Scheduled: '));
  } catch (e) { checkErrors.push('recent runs: ' + String(e.message || e).slice(0, 300)); }

  // ---------- 1. scheduled tasks (paused tasks are skipped: isActive must be true) ----------
  try {
    const lt = await tb('list_scheduled_tasks', {});
    const isSelf = t => descOf(t).includes(SELF) || String(t.name || '').includes(SELF) || String(t.wrenchId || '').startsWith('ba72bbdd');
    const tasks = (lt.tasks || []).filter(t => t.isActive && t.assistantId === ASSISTANT && !isSelf(t));
    const groups = new Map();
    for (const t of tasks) {
      const desc = descOf(t);
      const label = String(t.name || '');
      const hay = desc + ' ' + label + ' ' + String(t.wrenchId || '');
      const job = JOBS.find(j => hay.includes(j.m)) || { name: (label || desc.slice(0, 50)).trim(), sev: 'red', affects: 'See the task instructions in Toolbelt.' };
      const key = 'task:' + job.name;
      if (!groups.has(key)) groups.set(key, { key, job, tasks: [], prefixes: new Set() });
      const g = groups.get(key); g.tasks.push(t);
      if (desc) g.prefixes.add(desc.slice(0, 45));
      if (label) g.prefixes.add(label.slice(0, 45));
    }
    const results = await pool([...groups.values()], 10, async g => {
      // Expected interval = longest gap between consecutive scheduled runs of the group's tasks,
      // so tasks that fire together (e.g. the 3 drift checks, every 6h within 40 min) count as one run.
      const fixedH = t => { const r = String(t.recurrence || ''); let m = r.match(/Every (\d+) hours?/i); if (m) return Number(m[1]); m = r.match(/Every (\d+) minutes?/i); if (m) return Number(m[1]) / 60; if (/^Daily/i.test(r)) return 24; if (/^Weekly/i.test(r)) return 168; return null; };
      let periodH;
      const fh = g.tasks.map(fixedH);
      if (fh.some(p => p == null) || g.tasks.some(t => !Number.isFinite(Date.parse(t.scheduledAt)))) {
        periodH = 1 / g.tasks.reduce((s, t) => s + 1 / periodHours(t.recurrence), 0);
      } else if (g.tasks.length === 1) {
        periodH = fh[0];
      } else {
        const winStart = now - 336 * HOUR, times = [];
        g.tasks.forEach((t, i) => { const P = fh[i] * HOUR, a = Date.parse(t.scheduledAt); for (let x = a + Math.ceil((winStart - a) / P) * P; x <= now; x += P) times.push(x); });
        times.sort((a, b) => a - b);
        let gap = 0; for (let i = 1; i < times.length; i++) gap = Math.max(gap, times[i] - times[i - 1]);
        periodH = gap > 0 ? gap / HOUR : Math.max(...fh);
      }
      const threshold = (STALE_OVERRIDE_H[g.job.name] || 2 * periodH) * HOUR;
      const firstDue = Math.min(...g.tasks.map(t => Date.parse(t.scheduledAt) || now));
      let chats = [];
      const titleMatch = title => [...g.prefixes].some(p => String(title || '').startsWith('Scheduled: ' + p));
      for (const p of g.prefixes) {
        const sr = await tb('search_chats', { query: p, type: 'events', limit: 6 });
        for (const c of (sr.results || [])) {
          if (c.assistantId && c.assistantId !== ASSISTANT) continue;
          if (!String(c.chatTitle || '').startsWith('Scheduled: ' + p)) continue;
          if (!chats.some(x => x.chatId === c.chatId)) chats.push({ chatId: c.chatId, title: c.chatTitle, at: titleTime(c.chatTitle) });
        }
      }
      // v12: add matching chats from list_chats (newest 100)
      for (const c of recentChats) {
        if (!titleMatch(c.title)) continue;
        if (!chats.some(x => x.chatId === c.id)) chats.push({ chatId: c.id, title: c.title, at: Date.parse(c.createdAt) || titleTime(c.title) });
      }
      chats.sort((a, b) => (b.at || 0) - (a.at || 0));
      const chatAt = chats.length ? chats[0].at : null;
      // v12: remember the newest run chat seen, so a weekly job is still covered after its chat leaves list_chats
      const seen = state.lastSeen[g.job.name];
      if (chatAt && (!seen || !(seen.at >= chatAt))) state.lastSeen[g.job.name] = { at: chatAt, chatId: chats[0].chatId };
      const rec = recorded[g.job.name];
      const cands = [];
      if (chatAt) cands.push({ at: chatAt, source: 'Toolbelt run history' });
      if (rec && rec.at) cands.push(rec);
      if (seen && seen.at) cands.push({ at: seen.at, source: 'Toolbelt run history, remembered by the watchdog' });
      cands.sort((a, b) => b.at - a.at);
      const lastAt = cands.length ? cands[0].at : null;
      const lastSource = cands.length ? cands[0].source : null;
      const idle = g.job.name === 'AI sub-chat lane' && subchatIdle;
      const recLabel = g.tasks.length > 1 ? `${g.tasks.length} tasks, ${g.tasks.map(t => String(t.recurrence).toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(' / ')} each` : String(g.tasks[0].recurrence).toLowerCase();
      const taskRef = g.tasks.map(t => { const d = descOf(t); const w = d.match(/\bwrench\s+(fender_[a-z0-9_]+|fmic_[a-z0-9_]+|site_type_classifier_21a)\b/) || d.match(/\((fender_[a-z0-9_]+|fmic_[a-z0-9_]+)\)/) || d.match(/\b(fender_[a-z0-9_]+|site_type_classifier_21a)\b/); return (w ? w[1] + ' ' : '') + '(' + String(t.id).slice(0, 8) + ')'; }).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      const res = { name: g.job.name, lastRun: lastAt ? et(lastAt) : null, lastRunSource: lastSource, staleAfterH: +(threshold / HOUR).toFixed(1) };
      if (idle) res.idle = 'no open sub-chat run';
      if (!idle && (lastAt ? now - lastAt : now - firstDue) > threshold && now - firstDue > threshold) {
        problems['stale:' + g.key] = {
          title: `Job not running: ${g.job.name}`,
          body: `${DOT[g.job.sev]} Job not running: ${g.job.name}\nLast run: ${lastAt ? `${et(lastAt)} (${dur(now - lastAt)} ago, from ${lastSource})` : 'none found in Toolbelt run history'}\nNormally runs: ${recLabel} (alert after ${dur(threshold)})\nWhat this affects: ${g.job.affects}\nTask: ${taskRef}`
        };
        res.stale = true;
      }
      // Latest finished run: did any wrench fail or return success false?
      for (const c of chats.slice(0, 3)) {
        const chat = await tb('get_chat', { chatId: c.chatId, assistantId: ASSISTANT, messageLimit: 80 });
        if (chat.isProcessing) continue;
        const seq = [];
        for (const msg of (chat.messages || [])) {
          if (msg.role !== 'tool' || msg.name !== 'wrench_execute') continue;
          let t = String(msg.content || '');
          try { t = text(JSON.parse(t)); } catch (_) {}
          const f = t.match(/❌ Wrench execution failed:\s*([^\n]+)/);
          if (f) { seq.push({ ok: false, err: f[1] }); continue; }
          const o = t.indexOf('Outputs:');
          if (o >= 0) {
            try {
              const out = JSON.parse(t.slice(o + 8).trim());
              if (out && out.success === false) { const wn = (t.match(/Wrench "([^"]+)"/) || [])[1] || 'wrench'; seq.push({ ok: false, named: true, err: wn + ' returned success: false' + ((out.error || out.message || out.reason) ? ': ' + String(out.error || out.message || out.reason) : '') }); continue; }
            } catch (_) {}
          }
          seq.push({ ok: true });
        }
        // One-wrench task: a failure followed by a later success in the same run was retried and recovered.
        const single = g.tasks[0].runType === 'wrench' || (descOf(g.tasks[0]).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || []).filter((v, i, a) => a.indexOf(v) === i).length <= 1;
        const errs = seq.map((s, i) => (!s.ok && !(g.job.ignore && g.job.ignore.test(s.err)) && !(single && !s.named && seq.slice(i + 1).some(x => x.ok))) ? s.err : null).filter(Boolean);
        res.latestFinished = et(Date.parse(chat.createdAt) || c.at);
        if (errs.length) {
          const runAt = Date.parse(chat.createdAt) || c.at;
          problems['fail:' + g.key] = {
            title: `Job failed: ${g.job.name}`,
            body: `${DOT[g.job.sev]} Job failed: ${g.job.name}\nRun: ${et(runAt)}\nError: "${short(errs[0])}"${errs.length > 1 ? ` (and ${errs.length - 1} more wrench call${errs.length > 2 ? 's' : ''} failed in this run)` : ''}\nWhat this affects: ${g.job.affects}\nTask: ${taskRef}`
          };
          res.failed = errs.length;
        }
        break;
      }
      return res;
    });
    summary.push(...results);
  } catch (e) { checkErrors.push('scheduled tasks: ' + String(e.message || e).slice(0, 300)); }

  // ---------- 2. workflows (data-driven: add an entry to WORKFLOWS to watch a new workflow) ----------
  // staleH: alert "Job not running" when the newest execution started longer ago than this.
  // checkOutputs: also fetch the latest finished execution and alert when a wrench step returned success false.
  // abortJobState: Findability only, reads the aborted flag from command.fmic_job_state.
  const WORKFLOWS = [
    { key: 'findability', id: FINDABILITY_WF, name: 'Findability recheck', sev: 'red', staleH: 1, every: 'every 30 minutes',
      affects: 'fender.com Findability is not being refreshed.',
      ref: 'Workflow: Fender Findability weekly recheck (1bb03a5c), wrench fender_findability_recheck (ac814a8b)',
      abortJobState: 'findability_recheck' },
    { key: 'catalog_harvester', id: '8d3b06ee-d3ff-47a2-94e9-53310361ce69', name: 'Catalog harvester', sev: 'red', staleH: 13, every: 'every 6 hours (02:00, 08:00, 14:00, 20:00 UTC)',
      affects: 'New Fender listings and price changes from Keepa are not being loaded.',
      ref: 'Workflow: Fender catalog harvester (every 6h) (8d3b06ee), wrench fender_catalog_harvester (c4174648)',
      checkOutputs: true },
    { key: 'buybox_seller_harvester', id: '0a17de3b-e968-428e-80dd-def08c09745a', name: 'Buy Box seller harvester', sev: 'red', staleH: 13, every: 'every 6 hours (02:30, 08:30, 14:30, 20:30 UTC)',
      affects: 'Buy Box seller names are not being refreshed.',
      ref: 'Workflow: Fender Buy Box seller harvester (every 6h) (0a17de3b), wrench fender_buybox_seller_harvester (892063d0)',
      checkOutputs: true }
  ];
  const FAILED_STATUS = ['failed', 'error', 'timeout', 'timed_out', 'cancelled', 'canceled'];
  for (const w of WORKFLOWS) {
    try {
      const ex = jsonOf(await callTool('workspace', 'manage_workflows', { action: 'list_executions', workflowId: w.id, limit: 5 }));
      const list = (Array.isArray(ex) ? ex : (ex.executions || [])).filter(x => x.status !== 'running' && x.status !== 'pending');
      const last = list[0];
      const lastAt = last ? Date.parse(last.startedAt) : null;
      const threshold = w.staleH * HOUR;
      if (!lastAt || now - lastAt > threshold) {
        problems['stale:wf:' + w.key] = { title: `Job not running: ${w.name}`, body: `${DOT[w.sev]} Job not running: ${w.name}\nLast run: ${lastAt ? `${et(lastAt)} (${dur(now - lastAt)} ago)` : 'none found'}\nNormally runs: ${w.every} (alert after ${dur(threshold)})\nWhat this affects: ${w.affects}\n${w.ref}` };
      }
      let failMsg = null, failAt = lastAt;
      if (last && (FAILED_STATUS.includes(String(last.status).toLowerCase()) || (last.steps || []).some(s => FAILED_STATUS.includes(String(s.status).toLowerCase())))) {
        const st = (last.steps || []).find(s => s.errorMessage) || {};
        failMsg = `Error: "${short(st.errorMessage || 'workflow execution ' + last.status)}"`;
      } else if (last && w.checkOutputs) {
        const d = jsonOf(await callTool('workspace', 'manage_workflows', { action: 'get_status', executionId: last.id }));
        const bad = [];
        for (const s of (d.steps || [])) {
          const o = s.outputs || {};
          const inner = o.outputs && typeof o.outputs === 'object' ? o.outputs : null;
          if (o.success === false || (inner && inner.success === false)) {
            const why = o.error || (inner && (inner.error || inner.message || inner.reason || inner.stopReason));
            bad.push(`${s.name || s.stepId} returned success: false${why ? ': ' + String(why) : ''}`);
          }
        }
        if (bad.length) failMsg = `Error: "${short(bad[0])}"${bad.length > 1 ? ` (and ${bad.length - 1} more step${bad.length > 2 ? 's' : ''} failed in this run)` : ''}`;
      } else if (w.abortJobState) {
        const js = await sql(`SELECT last_run_at, extra FROM command.fmic_job_state WHERE job_key='${w.abortJobState}'`);
        const j = js[0];
        const x = j && (typeof j.extra === 'string' ? JSON.parse(j.extra) : j.extra);
        if (x && x.aborted === true && Date.parse(j.last_run_at) > now - 2 * HOUR) {
          failAt = Date.parse(j.last_run_at);
          failMsg = `Result: aborted, wrote nothing (${x.errored} of ${x.checked} listings blocked or timed out on fender.com)\n${x.remaining != null ? x.remaining + ' listings still due.' : ''}`.trim();
        }
      }
      if (failMsg) problems['fail:wf:' + w.key] = { title: `Job failed: ${w.name}`, body: `${DOT[w.sev]} Job failed: ${w.name}\nRun: ${et(failAt)}\n${failMsg}\nWhat this affects: ${w.affects}\n${w.ref}` };
      summary.push({ name: w.name, lastRun: lastAt ? et(lastAt) : null, status: last && last.status, staleAfterH: w.staleH, failed: !!failMsg });
    } catch (e) { checkErrors.push(`${w.name} workflow: ` + String(e.message || e).slice(0, 300)); }
  }

  // ---------- 3. copy write failures ----------
  try {
    const rows = await sql(`SELECT target, count(*)::int n, min(created_at) oldest,
        (SELECT left(e2.error, 200) FROM command.fmic_dual_write_errors e2 WHERE e2.replayed_at IS NULL AND e2.target = e.target GROUP BY left(e2.error, 200) ORDER BY count(*) DESC LIMIT 1) top_error
      FROM command.fmic_dual_write_errors e WHERE replayed_at IS NULL GROUP BY target`);
    for (const r of rows) {
      const oldest = Date.parse(r.oldest);
      if (now - oldest < 2 * HOUR) continue;
      problems['copywrite:' + r.target] = {
        title: `Copy writes failing: ${r.target}`,
        body: `🟠 Copy writes failing: ${r.target}\nUnreplayed failed writes: ${r.n} (oldest ${et(oldest)})\nMost common error: "${short(r.top_error)}"\nWhat this affects: the ${r.target} copy is behind production. Production and the dashboard are fine.\nReplayed hourly by the Copy upkeep task (fmic_dual_write_replay).`
      };
    }
    summary.push({ name: 'copy write failures', pending: rows.map(r => `${r.target}:${r.n}`).join(', ') || 'none' });
  } catch (e) { checkErrors.push('copy write failures: ' + String(e.message || e).slice(0, 300)); }

  // ---------- 4. copy drift ----------
  try {
    const rows = await sql(`SELECT job_key, last_run_at, extra FROM command.fmic_job_state WHERE job_key IN ('sandbox_drift_check','mirror_drift_check','claude_drift_check')`);
    for (const r of rows) {
      const target = r.job_key.replace('_drift_check', '');
      const x = typeof r.extra === 'string' ? JSON.parse(r.extra) : (r.extra || {});
      const drift = Array.isArray(x.drift) ? x.drift : [];
      if (!drift.length) continue;
      const tables = drift.map(d => d.t || d.table).filter(Boolean).sort();
      problems['drift:' + target] = {
        title: `Drift found: ${target}`,
        body: `🟠 Drift found: ${target}\nTables that don't match production after recheck (${tables.length}): ${tables.join(', ')}\nChecked: ${et(Date.parse(r.last_run_at))}\nWhat this affects: the ${target} copy differs from production. Production and the dashboard are fine.\nTo fix: run the drift check with target ${target} and autoRepair=true.`
      };
    }
    summary.push({ name: 'copy drift', drifted: rows.filter(r => { const x = typeof r.extra === 'string' ? JSON.parse(r.extra) : (r.extra || {}); return Array.isArray(x.drift) && x.drift.length; }).map(r => r.job_key) });
  } catch (e) { checkErrors.push('copy drift: ' + String(e.message || e).slice(0, 300)); }

  for (const ce of checkErrors) {
    const k = 'watchdog:' + ce.split(':')[0];
    problems[k] = { title: `Watchdog check failed: ${ce.split(':')[0]}`, body: `🟠 Watchdog check failed: ${ce.split(':')[0]}\nError: "${short(ce.split(':').slice(1).join(':'))}"\nWhat this affects: this part of the pipeline is not being watched until the check works again.\nWrench: ${SELF} (ba72bbdd)` };
  }

  // ---------- Slack ----------
  const toSend = [];
  for (const [k, p] of Object.entries(problems)) if (!state.open[k]) toSend.push({ k, kind: 'new', msg: p.body, title: p.title });
  for (const [k, o] of Object.entries(state.open)) if (!problems[k]) {
    const was = dur(now - (o.since || now));
    const msg = k.startsWith('stale:') || k.startsWith('fail:')
      ? `✅ Resolved: ${o.title.replace(/^Job (not running|failed): /, '')}\n${k.startsWith('stale:') ? 'Running again' : 'Latest run finished without a wrench failure'} as of ${et(now)}. Was ${k.startsWith('stale:') ? 'down' : 'failing'} ${was}.`
      : `✅ Resolved: ${o.title}\nCleared as of ${et(now)}. Was open ${was}.`;
    toSend.push({ k, kind: 'resolved', msg, title: o.title });
  }

  const sent = [], sendErrors = [];
  if (!DRY) {
    for (const s of toSend) {
      try {
        const r = await callTool('workspace', 'send_external_message', { provider: 'slack', channel: CHANNEL, message: s.msg });
        const t = text(r);
        if (/error|not found|failed/i.test(t) && !/sent/i.test(t)) throw new Error(t.slice(0, 200));
        if (s.kind === 'new') state.open[s.k] = { title: s.title, since: now };
        else delete state.open[s.k];
        sent.push(s.k);
      } catch (e) { sendErrors.push(s.k + ': ' + String(e.message || e).slice(0, 200)); }
    }
    state.updatedAt = new Date(now).toISOString();
    await callTool('workspace', 'write_text_file', { fileName: STATE_FILE, content: JSON.stringify(state, null, 1), allowOverwrite: true, waitForUpload: true });
  }

  return {
    success: sendErrors.length === 0,
    dryRun: DRY,
    wrench_version: 12,
    openProblems: Object.keys(problems),
    newOrResolved: toSend.map(s => ({ key: s.k, kind: s.kind })),
    messages: DRY ? toSend.map(s => s.msg) : undefined,
    sent, sendErrors, checkErrors, summary
  };
}