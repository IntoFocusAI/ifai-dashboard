async function run(inputs) {
  const SB = '114f7b2c-b33b-4eb4-b361-9b15112fc711';
  const COPIES = { sandbox: '5528f699-8878-4b19-b26b-93ca0ee6bee7', mirror: 'f0f38cfe-176d-42f2-b92b-7df5d8cf1532', claude: 'd7ecf1b4-c8e3-49c3-863c-f4e48761611c' };
  const esc = s => String(s).replace(/'/g, "''");
  async function sqlOn(id, query) {
    const r = await callTool(id, 'execute_sql', { query });
    const txt = r && typeof r.result === 'string' ? r.result : (typeof r === 'string' ? r : JSON.stringify(r));
    const m = txt.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
    if (m) return JSON.parse(m[1]);
    throw new Error('Supabase: ' + txt.slice(0, 500));
  }
  const HASH = `select (select md5(coalesce(string_agg(to_jsonb(p)::text, '|' order by prompt_key), '')) from command.fmic_ai_prompts p) prompts_h, (select count(*) from command.fmic_ai_prompts) prompts_n, (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by id), '')) from command.fmic_ai_prompt_edits e) edits_h, (select count(*) from command.fmic_ai_prompt_edits) edits_n`;
  const prodH = (await sqlOn(SB, HASH))[0];
  const out = { prod: prodH, copies: {} };
  let prodPrompts = null, prodEdits = null;
  for (const [name, id] of Object.entries(COPIES)) {
    try {
      const h = (await sqlOn(id, HASH))[0];
      const res = { promptsMatch: h.prompts_h === prodH.prompts_h, editsMatch: h.edits_h === prodH.edits_h };
      if (!inputs.dryRun && (!res.promptsMatch || !res.editsMatch)) {
        if (!prodPrompts) {
          prodPrompts = (await sqlOn(SB, `select coalesce(json_agg(p order by prompt_key), '[]'::json)::text j from command.fmic_ai_prompts p`))[0].j;
          prodEdits = (await sqlOn(SB, `select coalesce(json_agg(e order by id), '[]'::json)::text j from command.fmic_ai_prompt_edits e`))[0].j;
        }
        const cols = (await sqlOn(SB, `select string_agg(quote_ident(attname), ',' order by attnum) c from pg_attribute where attrelid='command.fmic_ai_prompts'::regclass and attnum>0 and not attisdropped`))[0].c;
        const setC = cols.split(',').filter(c => c !== 'prompt_key').map(c => `${c}=EXCLUDED.${c}`).join(',');
        const ecols = (await sqlOn(SB, `select string_agg(quote_ident(attname), ',' order by attnum) c from pg_attribute where attrelid='command.fmic_ai_prompt_edits'::regclass and attnum>0 and not attisdropped`))[0].c;
        await sqlOn(id, `BEGIN; SET LOCAL session_replication_role = replica;
          INSERT INTO command.fmic_ai_prompts (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::command.fmic_ai_prompts, '${esc(prodPrompts)}'::jsonb) ON CONFLICT (prompt_key) DO UPDATE SET ${setC};
          DELETE FROM command.fmic_ai_prompts WHERE prompt_key NOT IN (SELECT x->>'prompt_key' FROM jsonb_array_elements('${esc(prodPrompts)}'::jsonb) x);
          INSERT INTO command.fmic_ai_prompt_edits (${ecols}) SELECT ${ecols} FROM jsonb_populate_recordset(NULL::command.fmic_ai_prompt_edits, '${esc(prodEdits)}'::jsonb) ON CONFLICT (id) DO NOTHING;
          COMMIT; SELECT 1 ok`);
        const h2 = (await sqlOn(id, HASH))[0];
        res.synced = true; res.promptsMatchAfter = h2.prompts_h === prodH.prompts_h; res.editsMatchAfter = h2.edits_h === prodH.edits_h;
      }
      out.copies[name] = res;
    } catch (e) { out.copies[name] = { error: String(e.message || e).slice(0, 300) }; }
  }
  const ok = Object.values(out.copies).every(c => !c.error && (c.synced ? (c.promptsMatchAfter && c.editsMatchAfter) : (inputs.dryRun || (c.promptsMatch && c.editsMatch))));
  return { success: ok, dryRun: !!inputs.dryRun, ...out };
}