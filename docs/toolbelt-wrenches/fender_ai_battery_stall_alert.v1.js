async function run(inputs) {
  const AS_OF = inputs.asOf ? Date.parse(inputs.asOf) : null;
  if (inputs.asOf && !Number.isFinite(AS_OF)) throw new Error('asOf is not a valid date: ' + inputs.asOf);
  const DRY = inputs.dryRun === true || AS_OF != null;
  const CHANNEL = inputs.channel || 'C0CGQ6EBL5V';
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const STATE_FILE = 'watchdog/ai_battery_stall_state.json';
  const REF = 'Task: AI battery stall alert (3c289d5a), wrench fender_ai_battery_stall_alert';
  const now = AS_OF != null ? AS_OF : Date.now();

  const text = r => {
    if (r == null) return '';
    if (typeof r === 'string') return r;
    if (typeof r.result === 'string') return r.result;
    if (Array.isArray(r.content)) return r.content.map(c => (c && c.text) || '').join('\n');
    if (typeof r.text === 'string') return r.text;
    return JSON.stringify(r);
  };
  async function sql(q) {
    const r = await callTool(SB, 'execute_sql', { query: q });
    const t = text(r);
    const m = t.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    throw new Error('Supabase: ' + t.slice(0, 300));
  }
  function et(ms) {
    try {
      const p = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms))) p[x.type] = x.value;
      return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} ET`;
    } catch (e) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'; }
  }
  function dur(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m >= 2880) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  const id8 = s => String(s || '').slice(0, 8);
  const calls = r => `Calls: ${r.answered} answered, ${r.errors} errors, of ${r.expected_calls} expected (live count from fmic_ai_simulations)`;

  const SQL = `WITH p AS (SELECT %NOW% AS t, %LIVE% AS live), runs AS ( SELECT r.id, r.run_kind, r.run_state, r.started_at, (r.is_published AND (p.live OR r.published_at <= p.t)) AS published, (r.completed_at IS NOT NULL AND r.completed_at <= p.t) OR (p.live AND r.run_state = 'failed') AS finished, (p.live AND r.run_state = 'failed') AS failed, coalesce(r.expected_calls, 0) AS expected_calls, s.answered, s.errors, s.last_write, extract(epoch FROM p.t - r.started_at) / 3600.0 AS age_h, extract(epoch FROM p.t - coalesce(s.last_write, r.started_at)) / 3600.0 AS quiet_h FROM command.fmic_audit_runs r CROSS JOIN p LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE x.call_status = 'answered')::int AS answered, count(*) FILTER (WHERE x.call_status = 'error')::int AS errors, max(greatest(x.created_at, coalesce(x.updated_at, x.created_at))) AS last_write FROM command.fmic_ai_simulations x WHERE x.audit_run_id = r.id AND greatest(x.created_at, coalesce(x.updated_at, x.created_at)) <= p.t ) s ON true WHERE r.run_kind IN ('ai_simulation', 'ai_subchat') AND r.started_at <= p.t AND r.started_at > p.t - interval '8 days' ), battery AS (SELECT * FROM runs WHERE run_kind = 'ai_simulation'), days AS ( SELECT d::date AS d FROM p, generate_series((p.t AT TIME ZONE 'UTC')::date - 3, (p.t AT TIME ZONE 'UTC')::date, interval '1 day') d WHERE extract(dow FROM d) IN (0, 2, 4) AND (d::date < (p.t AT TIME ZONE 'UTC')::date OR extract(hour FROM p.t AT TIME ZONE 'UTC') >= 8) ) SELECT 'a' AS rule, b.id::text AS run_id, b.started_at, b.run_state, b.answered, b.errors, b.expected_calls, b.last_write, round(b.age_h::numeric, 1) AS age_h, round(b.quiet_h::numeric, 1) AS quiet_h, NULL::text AS day, NULL::text AS sub_id, NULL::text AS sub_state FROM battery b WHERE NOT b.published AND b.age_h > 72 UNION ALL SELECT 'b', b.id::text, b.started_at, b.run_state, b.answered, b.errors, b.expected_calls, b.last_write, round(b.age_h::numeric, 1), round(b.quiet_h::numeric, 1), NULL, NULL, NULL FROM battery b WHERE NOT b.finished AND b.age_h >= 1 AND b.quiet_h >= 3 UNION ALL SELECT 'c', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, dy.d::text, NULL, NULL FROM days dy WHERE NOT EXISTS (SELECT 1 FROM battery b WHERE (b.started_at AT TIME ZONE 'UTC')::date = dy.d) UNION ALL SELECT 'd', b.id::text, b.started_at, b.run_state, NULL, NULL, NULL, NULL, round(b.age_h::numeric, 1), NULL, NULL, coalesce(sc.id::text, 'none'), CASE WHEN sc.id IS NULL THEN 'missing' WHEN sc.failed THEN 'failed' ELSE 'unfinished' END FROM battery b LEFT JOIN LATERAL (SELECT * FROM runs s WHERE s.run_kind = 'ai_subchat' AND s.started_at BETWEEN b.started_at - interval '6 hours' AND b.started_at + interval '6 hours' ORDER BY s.started_at LIMIT 1) sc ON true WHERE b.age_h <= 72 AND b.age_h >= 2 AND (sc.id IS NULL OR sc.failed OR (NOT sc.finished AND sc.age_h > 20)) ORDER BY 1, 2`;
  const nowExpr = AS_OF != null ? `'${new Date(AS_OF).toISOString()}'::timestamptz` : 'now()';
  const rows = await sql(SQL.replace('%NOW%', nowExpr).replace('%LIVE%', AS_OF != null ? 'false' : 'true'));

  const problems = {};
  const AFFECTS = 'What this affects: the dashboard keeps showing the last published AI Search run until this run publishes.';
  for (const r of rows) {
    const started = r.started_at ? Date.parse(r.started_at) : null;
    if (r.rule === 'a') {
      problems['a:' + r.run_id] = { title: `AI Battery Stall (Rule (a)) run ${id8(r.run_id)}`, body:
        `🔴 AI Battery Stall (Rule (a)): run not published within its 72 hour window\nRun: ${id8(r.run_id)}, started ${et(started)} (${dur(now - started)} ago)\nState: ${r.run_state}\n${calls(r)}\n${AFFECTS}\n${REF}` };
    } else if (r.rule === 'b') {
      const lw = r.last_write ? Date.parse(r.last_write) : null;
      problems['b:' + r.run_id] = { title: `AI Battery Stall (Rule (b)) run ${id8(r.run_id)}`, body:
        `🔴 AI Battery Stall (Rule (b)): no answers saved for ${dur(now - (lw || started))}\nRun: ${id8(r.run_id)}, started ${et(started)}\nState: ${r.run_state}\nLast answer saved: ${lw ? et(lw) : 'none yet'}\n${calls(r)}\nThe worker task (2c847070) runs every 30 minutes and normally saves answers at least hourly.\n${AFFECTS}\n${REF}` };
    } else if (r.rule === 'c') {
      problems['c:' + r.day] = { title: `AI Battery Stall (Rule (c)) ${r.day}`, body:
        `🔴 AI Battery Stall (Rule (c)): no AI Search run started on ${r.day}\nThe start tasks fire at 06:00 UTC (01:00 ET) on Sun, Tue and Thu. No run started that UTC day and it is now past 08:00 UTC.\nWhat this affects: no new AI Search run, so the dashboard keeps showing the last published run.\n${REF}` };
    } else if (r.rule === 'd') {
      const what = r.sub_state === 'missing' ? 'did not start' : r.sub_state === 'failed' ? 'failed' : 'did not finish within 20 hours';
      problems['d:' + r.run_id] = { title: `AI Battery Stall (Rule (d)) run ${id8(r.run_id)}`, body:
        `🟠 AI Battery Stall (Rule (d)): Brian Watson API job (AI sub-chat lane) ${what}\nBattery run: ${id8(r.run_id)}, started ${et(started)}\nSub-chat run: ${r.sub_id === 'none' ? 'none found within 6 hours of the battery start' : id8(r.sub_id) + ' (' + r.sub_state + ')'}\nWhat this affects: the sub-chat comparison run for this battery. It does not publish to the dashboard.\n${REF}` };
    }
  }

  let state = { open: {} };
  try {
    const t = text(await callTool('workspace', 'read_storage_file', { fileName: STATE_FILE, raw: true, force: true }));
    const i = t.indexOf('{');
    if (i >= 0) { const s = JSON.parse(t.slice(i)); if (s && s.open) state = s; }
  } catch (_) { /* first run: no state file */ }

  // A rule (c) day that left the 3 day window without a run is dropped quietly, not reported as resolved.
  const dropped = [];
  const goneDays = Object.keys(state.open).filter(k => k.startsWith('c:') && !problems[k]).map(k => k.slice(2));
  if (goneDays.length) {
    const found = await sql(`SELECT DISTINCT (started_at AT TIME ZONE 'UTC')::date::text AS d FROM command.fmic_audit_runs WHERE run_kind='ai_simulation' AND (started_at AT TIME ZONE 'UTC')::date IN (${goneDays.map(d => `'${d.replace(/[^0-9-]/g, '')}'`).join(',')})`);
    const have = new Set(found.map(f => f.d));
    for (const d of goneDays) if (!have.has(d)) dropped.push('c:' + d);
  }

  const toSend = [];
  for (const [k, p] of Object.entries(problems)) {
    if (!state.open[k]) toSend.push({ k, kind: 'new', msg: p.body, title: p.title });
    else if (state.open[k].slackPending) toSend.push({ k, kind: 'retry', msg: p.body, title: p.title });
  }
  for (const [k, o] of Object.entries(state.open)) if (!problems[k] && !dropped.includes(k)) {
    toSend.push({ k, kind: 'resolved', title: o.title, msg: `✅ Resolved: ${o.title}\n${k.startsWith('b:') ? 'Answers are being saved again' : k.startsWith('a:') ? 'Run published' : k.startsWith('c:') ? 'A run started for that day' : 'Sub-chat run found and finished'} as of ${et(now)}. Was open ${dur(now - (o.since || now))}.` });
  }

  const sent = [], sendErrors = [];
  if (!DRY) {
    for (const k of dropped) delete state.open[k];
    for (const s of toSend) {
      if (s.kind === 'new') {
        try {
          await callTool('workspace', 'toolbelt', { action: 'create_notification', params: JSON.stringify({ title: 'ALERT: ' + s.title, message: s.msg, notificationPriority: 'urgent', notificationType: 'assistant_message' }) });
        } catch (e) { sendErrors.push(s.k + ' notification: ' + String(e.message || e).slice(0, 200)); }
        state.open[s.k] = { title: s.title, since: now, slackPending: true };
      }
      try {
        const t = text(await callTool('workspace', 'send_external_message', { provider: 'slack', channel: CHANNEL, message: s.msg }));
        if (/error|not found|failed/i.test(t) && !/sent/i.test(t)) throw new Error(t.slice(0, 200));
        if (s.kind === 'resolved') delete state.open[s.k];
        else state.open[s.k].slackPending = false;
        sent.push(s.k);
      } catch (e) { sendErrors.push(s.k + ' slack: ' + String(e.message || e).slice(0, 200)); }
    }
    state.updatedAt = new Date(now).toISOString();
    await callTool('workspace', 'write_text_file', { fileName: STATE_FILE, content: JSON.stringify(state, null, 1), allowOverwrite: true, waitForUpload: true });
  }

  return {
    success: sendErrors.length === 0,
    dryRun: DRY,
    asOf: new Date(now).toISOString(),
    summary: Object.keys(problems).length ? `${Object.keys(problems).length} open stall problem(s): ${Object.keys(problems).join(', ')}` : 'AI battery stall check OK: no stalled runs detected.',
    openProblems: Object.keys(problems),
    newOrResolved: toSend.map(s => ({ key: s.k, kind: s.kind })),
    messages: DRY ? toSend.map(s => s.msg) : undefined,
    droppedQuietly: dropped,
    sent, sendErrors
  };
}