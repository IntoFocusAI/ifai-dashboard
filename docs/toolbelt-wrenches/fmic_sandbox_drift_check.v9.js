async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const SERVERS = { sandbox: '5528f699-8878-4b19-b26b-93ca0ee6bee7', mirror: 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532', claude: 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c' };
  const target = inputs.target || 'sandbox';
  if (!SERVERS[target]) return { success: false, error: 'target must be sandbox, mirror or claude' };
  const SBX = SERVERS[target];
  const WRENCH = 'fmic_sandbox_drift_check';
  const JOB_KEY = target + '_drift_check';
  const delay = Number(inputs.recheckDelaySec ?? 45) * 1000;
  const pageSize = Number(inputs.pageSize || 200);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sq = s => `'${String(s).replace(/'/g, "''")}'`;
  async function sqlOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    throw new Error('Supabase: ' + txt.slice(0, 500));
  }
  // Order-independent checksum over an explicit column list (all columns except updated_at and row_data).
  // No sort, no temp files, and the large row_data snapshots are never read.
  function buildHashQuery(only) {
    const filter = only && only.length ? ` and c.relname in (${only.map(sq).join(',')})` : '';
    return `select c.relname t, x.n::int n, x.h
    from pg_class c
    cross join lateral (select string_agg(z.chunk, ' || ' order by z.g) cols from (select a.g, format('jsonb_build_object(%s)', string_agg(format('%L, x.%I', a.attname, a.attname), ', ' order by a.attnum)) chunk from (select a.attname, a.attnum, (row_number() over (order by a.attnum) - 1) / 40 g from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and a.attname not in ('updated_at', 'row_data')) a group by a.g) z) k
    cross join lateral (select (xpath('/row/n/text()', q))[1]::text n, (xpath('/row/h/text()', q))[1]::text h from query_to_xml(format('select count(*) n, coalesce(sum((%L || substr(md5(j::text), 1, 16))::bit(64)::bigint), 0)::text h from (select %s j from command.%I x) s', 'x', k.cols, c.relname), false, true, '') q) x
    where c.relnamespace = 'command'::regnamespace and c.relkind = 'r' and c.relname <> 'fmic_dual_write_errors'${filter} order by 1`;
  }
  const LIST_Q = `select c.relname t from pg_class c where c.relnamespace = 'command'::regnamespace and c.relkind = 'r' and c.relname <> 'fmic_dual_write_errors' order by 1`;
  // v9: one table per statement, so no read lock is held across all tables for minutes.
  async function compare(only) {
    let names;
    if (only) names = only;
    else {
      const [pl, sl] = await Promise.all([
        sqlOn(SB, LIST_Q),
        sqlOn(SBX, LIST_Q).catch(e => ({ err: e.message }))
      ]);
      if (sl.err) throw new Error(target + ' unreachable: ' + sl.err.slice(0, 200));
      names = Array.from(new Set([...pl.map(r => r.t), ...sl.map(r => r.t)])).sort();
    }
    const pm = {}, sm = {};
    for (const t of names) {
      const q = buildHashQuery([t]);
      const [p, s] = await Promise.all([
        sqlOn(SB, q),
        sqlOn(SBX, q).catch(e => ({ err: e.message }))
      ]);
      if (s.err) throw new Error(target + ' unreachable: ' + s.err.slice(0, 200));
      for (const r of p) pm[r.t] = r;
      for (const r of s) sm[r.t] = r;
    }
    return names.filter(t => !pm[t] || !sm[t] || pm[t].h !== sm[t].h).map(t => ({ t, prod_n: pm[t] ? pm[t].n : null, [target === 'sandbox' ? 'sbx_n' : target + '_n']: sm[t] ? sm[t].n : null, missing: !pm[t] ? 'prod' : (!sm[t] ? target : null) }));
  }

  let first = await compare(null);
  let drift = first;
  if (first.length && delay > 0) { await sleep(delay); drift = await compare(first.map(d => d.t)); }

  const repaired = {};
  if (inputs.autoRepair && drift.length) {
    for (const d of drift) {
      if (d.missing) { repaired[d.t] = 'skipped: table missing on ' + d.missing; continue; }
      const fq = `command.${d.t}`;
      try {
        const pk = (await sqlOn(SB, `SELECT a.attname c FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid='${fq}'::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`)).map(r => r.c);
        if (!pk.length) { repaired[d.t] = 'no pk'; continue; }
        const cols = (await sqlOn(SB, `SELECT attname c FROM pg_attribute WHERE attrelid='${fq}'::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='' ORDER BY attnum`)).map(r => r.c);
        const qc = c => `"${c}"`, pkList = pk.map(qc).join(','), cl = cols.map(qc).join(',');
        const nonPk = cols.filter(c => !pk.includes(c));
        const setC = nonPk.length ? 'DO UPDATE SET ' + nonPk.map(c => `${qc(c)}=EXCLUDED.${qc(c)}`).join(',') : 'DO NOTHING';
        let off = 0, copied = 0;
        while (true) {
          const rows = await sqlOn(SB, `SELECT coalesce(json_agg(t),'[]'::json)::text j FROM (SELECT ${cl} FROM ${fq} ORDER BY ${pkList} LIMIT ${pageSize} OFFSET ${off}) t`);
          const arr = JSON.parse(rows[0].j);
          if (!arr.length) break;
          await sqlOn(SBX, `SET session_replication_role = replica; INSERT INTO ${fq} (${cl}) SELECT ${cl} FROM jsonb_populate_recordset(NULL::${fq}, ${sq(JSON.stringify(arr))}::jsonb) ON CONFLICT (${pkList}) ${setC}; SET session_replication_role = origin; SELECT 1 ok`);
          copied += arr.length; off += pageSize;
          if (arr.length < pageSize) break;
        }
        const keys = await sqlOn(SB, `SELECT coalesce(json_agg(json_build_array(${pkList})),'[]'::json)::text j FROM ${fq}`);
        const del = await sqlOn(SBX, `SET session_replication_role = replica; WITH k AS (SELECT value v FROM jsonb_array_elements(${sq(keys[0].j)}::jsonb)), d AS (DELETE FROM ${fq} t WHERE NOT EXISTS (SELECT 1 FROM k WHERE ${pk.map((c, i) => `(k.v->>${i}) = t.${qc(c)}::text`).join(' AND ')}) RETURNING 1) SELECT count(*)::int n FROM d`);
        await sqlOn(SBX, `SET session_replication_role = origin; SELECT 1 ok`);
        repaired[d.t] = { copied, deleted: del[0] ? del[0].n : 0 };
      } catch (e) { repaired[d.t] = 'ERR ' + String(e.message || e).slice(0, 200); }
    }
  }

  const pend = await sqlOn(SB, `SELECT count(*)::int n FROM command.fmic_dual_write_errors WHERE replayed_at IS NULL`);
  const ts = new Date().toISOString();
  const extra = { target, checked_at: ts, drift, transient: first.length - drift.length, repaired, pending_dual_write_errors: pend[0].n };
  const w = `INSERT INTO command.fmic_job_state (job_key, extra, last_run_at, updated_at) VALUES (${sq(JOB_KEY)}, ${sq(JSON.stringify(extra))}::jsonb, '${ts}'::timestamptz, '${ts}'::timestamptz) ON CONFLICT (job_key) DO UPDATE SET extra = EXCLUDED.extra, last_run_at = EXCLUDED.last_run_at, updated_at = EXCLUDED.updated_at; SELECT 1 ok`;
  await sqlOn(SB, w);
  const mirrored = {};
  for (const [name, id] of Object.entries(SERVERS)) {
    try { await sqlOn(id, w); mirrored[name] = true; } catch (e) {
      mirrored[name] = false;
      try { await sqlOn(SB, `INSERT INTO command.fmic_dual_write_errors (wrench, target, error, sql_text) VALUES (${sq(WRENCH)}, ${sq(name)}, ${sq(String(e.message || e).slice(0, 2000))}, ${sq(w)}); SELECT 1 ok`); } catch (_) {}
    }
  }
  return { success: true, target, in_sync: drift.length === 0, drift, transient: extra.transient, repaired, pending_dual_write_errors: pend[0].n, mirrored };
}