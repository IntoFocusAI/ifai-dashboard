async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SERVERS = { sandbox: '5528f699-8878-4b19-b26b-93ca0ee6bee7', mirror: 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532', claude: 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c' };
  const limit = Math.max(1, Math.min(500, Number(inputs.limit || 50)));
  const want = inputs.target && inputs.target !== 'all' ? [inputs.target] : Object.keys(SERVERS);
  if (want.some(t => !SERVERS[t])) return { success: false, error: 'target must be sandbox, mirror, claude or all' };
  async function sqlOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    throw new Error('Supabase: ' + txt.slice(0, 500));
  }
  const filter = want.map(t => `'${t}'`).join(',');
  const rows = await sqlOn(SB, `SELECT id, wrench, coalesce(target,'sandbox') target, sql_text FROM command.fmic_dual_write_errors WHERE replayed_at IS NULL AND coalesce(target,'sandbox') IN (${filter}) AND sql_text IS NOT NULL ORDER BY id LIMIT ${limit}`);
  if (inputs.dryRun) return { success: true, dryRun: true, pending: rows.length, ids: rows.map(r => ({ id: r.id, target: r.target })) };
  const ok = [], failed = [];
  const perTarget = Object.fromEntries(Object.keys(SERVERS).map(k => [k, { replayed: 0, failed: 0 }]));
  for (const r of rows) {
    try {
      let s = String(r.sql_text).trim();
      if (!/select\s+1\s+ok\s*;?\s*$/i.test(s)) s = s.replace(/;?\s*$/, '; SELECT 1 ok');
      await sqlOn(SERVERS[r.target], s);
      ok.push(r.id); perTarget[r.target].replayed++;
    } catch (e) { failed.push({ id: r.id, wrench: r.wrench, target: r.target, error: String(e.message || e).slice(0, 200) }); perTarget[r.target].failed++; }
  }
  if (ok.length) {
    const ts = new Date().toISOString();
    const stamp = `UPDATE command.fmic_dual_write_errors SET replayed_at='${ts}'::timestamptz WHERE id IN (${ok.join(',')}); SELECT 1 ok`;
    await sqlOn(SB, stamp);
    for (const id of Object.values(SERVERS)) { try { await sqlOn(id, stamp); } catch (_) {} }
  }
  const left = await sqlOn(SB, `SELECT coalesce(target,'sandbox') target, count(*)::int n FROM command.fmic_dual_write_errors WHERE replayed_at IS NULL GROUP BY 1`);
  const still = Object.fromEntries(left.map(r => [r.target, r.n]));
  const total = left.reduce((a, r) => a + r.n, 0);
  return { success: true, attempted: rows.length, replayed: ok.length, failed, per_target: perTarget, still_pending: total, still_pending_by_target: still, hint: failed.length ? 'Repeated failures: run fmic_sandbox_drift_check (target sandbox, mirror or claude) with autoRepair=true' : null };
}