-- Prompt edit functions: IntoFocus staff only.
--
-- Problem: public.ai_prompt_save and public.ai_prompt_set_active are SECURITY DEFINER and
-- EXECUTE is granted to anon. They never check the caller, so anyone holding the public anon key
-- (it ships in every dashboard page) could add, rewrite or switch off Fender's AI battery prompts.
-- The only caller is the staff-only Build prompts page (decision 99).
--
-- Change (alters existing functions and permissions, so Brian Watson applies it):
--   1. Each function now starts with: IF NOT command.is_intofocus_admin() THEN RAISE ... .
--      The rest of each body is unchanged from the live definition on 18 Nov 2026.
--   2. EXECUTE is revoked from PUBLIC and anon and granted to authenticated and service_role.
--   The app change in the same PR makes lib/ai-search/prompt-editor.ts call these with the
--   signed-in browser session instead of the anon client.
--
-- Not changed: the read functions ai_prompts_list, ai_prompts_status and ai_prompt_edits_list stay
-- callable by anon (clients see the question list, decision 99).
--
-- Check after applying (both should return false, then true for authenticated):
--   select has_function_privilege('anon', 'public.ai_prompt_save(text,text,text)', 'execute'),
--          has_function_privilege('anon', 'public.ai_prompt_set_active(text,boolean)', 'execute'),
--          has_function_privilege('authenticated', 'public.ai_prompt_save(text,text,text)', 'execute');
--
-- Undo: re-run the two CREATE OR REPLACE statements below without the staff check block, then
--   grant execute on function public.ai_prompt_save(text,text,text) to anon;
--   grant execute on function public.ai_prompt_set_active(text,boolean) to anon;

begin;

CREATE OR REPLACE FUNCTION public.ai_prompt_save(p_prompt_key text, p_prompt_text text, p_category text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  l record; old_row command.fmic_ai_prompts%ROWTYPE; new_key text; txt text; cat text; ts timestamptz := now(); n int;
BEGIN
  IF NOT command.is_intofocus_admin() THEN
    RAISE EXCEPTION 'Only IntoFocus staff can edit prompts. Sign in and try again.' USING errcode = '42501';
  END IF;
  SELECT * INTO l FROM command.fmic_ai_prompt_lock();
  IF l.locked THEN
    RAISE EXCEPTION 'Prompts are locked while AI run % is in progress (started %). Try again after it publishes.', l.run_id, l.run_started_at;
  END IF;
  txt := btrim(regexp_replace(coalesce(p_prompt_text, ''), '\s+', ' ', 'g'));
  cat := lower(btrim(coalesce(p_category, '')));
  IF length(txt) < 10 OR length(txt) > 500 THEN RAISE EXCEPTION 'Prompt text must be 10 to 500 characters.'; END IF;
  IF cat !~ '^[a-z0-9][a-z0-9 _-]{0,39}$' THEN RAISE EXCEPTION 'Category must be 1 to 40 letters, numbers, spaces, dashes or underscores.'; END IF;
  IF EXISTS (SELECT 1 FROM command.fmic_ai_prompts WHERE lower(prompt_text) = lower(txt) AND prompt_key IS DISTINCT FROM p_prompt_key) THEN
    RAISE EXCEPTION 'Another prompt already has this exact text.';
  END IF;

  IF p_prompt_key IS NULL THEN
    SELECT count(*) INTO n FROM command.fmic_ai_prompts WHERE active;
    IF n >= 99 THEN RAISE EXCEPTION 'At most 99 prompts can be active.'; END IF;
    -- Never reuse a key: look at the prompt list and every key ever answered.
    SELECT 'p' || lpad((greatest(
             coalesce((SELECT max(substring(prompt_key FROM '^p(\d+)$')::int) FROM command.fmic_ai_prompts), 0),
             coalesce((SELECT max(substring(prompt_key FROM '^p(\d+)$')::int) FROM command.fmic_ai_simulations), 0)
           ) + 1)::text, 2, '0')
      INTO new_key;
    INSERT INTO command.fmic_ai_prompts (prompt_key, prompt_text, category, prompt_kind, active, created_at, updated_at)
    VALUES (new_key, txt, cat, 'commercial', true, ts, ts);
    INSERT INTO command.fmic_ai_prompt_edits (edited_at, action, prompt_key, before, after, source)
    VALUES (ts, 'add', new_key, NULL, jsonb_build_object('prompt_text', txt, 'category', cat, 'prompt_kind', 'commercial', 'active', true), 'dashboard');
    RETURN new_key;
  END IF;

  SELECT * INTO old_row FROM command.fmic_ai_prompts WHERE prompt_key = p_prompt_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prompt % not found.', p_prompt_key; END IF;
  IF old_row.prompt_text = txt AND old_row.category::text = cat THEN RETURN p_prompt_key; END IF;
  UPDATE command.fmic_ai_prompts SET prompt_text = txt, category = cat, updated_at = ts WHERE prompt_key = p_prompt_key;
  INSERT INTO command.fmic_ai_prompt_edits (edited_at, action, prompt_key, before, after, source)
  VALUES (ts, 'edit', p_prompt_key,
          jsonb_build_object('prompt_text', old_row.prompt_text, 'category', old_row.category),
          jsonb_build_object('prompt_text', txt, 'category', cat), 'dashboard');
  RETURN p_prompt_key;
END $function$;

CREATE OR REPLACE FUNCTION public.ai_prompt_set_active(p_prompt_key text, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l record; old_row command.fmic_ai_prompts%ROWTYPE; ts timestamptz := now(); n int;
BEGIN
  IF NOT command.is_intofocus_admin() THEN
    RAISE EXCEPTION 'Only IntoFocus staff can edit prompts. Sign in and try again.' USING errcode = '42501';
  END IF;
  SELECT * INTO l FROM command.fmic_ai_prompt_lock();
  IF l.locked THEN
    RAISE EXCEPTION 'Prompts are locked while AI run % is in progress (started %). Try again after it publishes.', l.run_id, l.run_started_at;
  END IF;
  SELECT * INTO old_row FROM command.fmic_ai_prompts WHERE prompt_key = p_prompt_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prompt % not found.', p_prompt_key; END IF;
  IF old_row.active = p_active THEN RETURN; END IF;
  IF p_active THEN
    SELECT count(*) INTO n FROM command.fmic_ai_prompts WHERE active;
    IF n >= 99 THEN RAISE EXCEPTION 'At most 99 prompts can be active.'; END IF;
  ELSE
    SELECT count(*) INTO n FROM command.fmic_ai_prompts WHERE active;
    IF n <= 1 THEN RAISE EXCEPTION 'At least one prompt must stay active.'; END IF;
  END IF;
  UPDATE command.fmic_ai_prompts SET active = p_active, updated_at = ts WHERE prompt_key = p_prompt_key;
  INSERT INTO command.fmic_ai_prompt_edits (edited_at, action, prompt_key, before, after, source)
  VALUES (ts, CASE WHEN p_active THEN 'restore' ELSE 'remove' END, p_prompt_key,
          jsonb_build_object('active', old_row.active), jsonb_build_object('active', p_active), 'dashboard');
END $function$;

revoke execute on function public.ai_prompt_save(text, text, text) from public, anon;
revoke execute on function public.ai_prompt_set_active(text, boolean) from public, anon;
grant execute on function public.ai_prompt_save(text, text, text) to authenticated, service_role;
grant execute on function public.ai_prompt_set_active(text, boolean) to authenticated, service_role;

commit;
