-- AI-Search prompt editor (2026-10-27).
-- The dashboard's Prompts editor lists, adds, edits, removes and restores rows in
-- command.fmic_ai_prompts through these public functions (callable with the public key; no login).
-- Remove switches a prompt off (active = false) so its key is never reused and its history stays intact.
-- Every change is refused while an AI battery run is in progress: the run re-reads the prompt list on
-- every batch and numbers answers by list position, and command.fmic_ai_publish_run only publishes a run
-- whose prompt hash still matches. Every change is logged in command.fmic_ai_prompt_edits.

ALTER TABLE command.fmic_ai_prompts ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS command.fmic_ai_prompt_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edited_at timestamptz NOT NULL,
  action text NOT NULL,
  prompt_key text NOT NULL,
  before jsonb,
  after jsonb,
  source text
);

ALTER TABLE command.fmic_ai_prompt_edits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command.fmic_ai_prompt_edits FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON command.fmic_ai_prompt_edits FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON command.fmic_ai_prompt_edits FROM authenticated; END IF;
END $$;
GRANT ALL ON command.fmic_ai_prompt_edits TO service_role;

-- Run lock: an unpublished, running collector v11 run started in the last 40 hours (the worker's window).
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_lock()
RETURNS TABLE (locked boolean, run_id uuid, run_started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT r.id IS NOT NULL, r.id, r.started_at
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT id, started_at FROM command.fmic_audit_runs
    WHERE run_kind = 'ai_simulation' AND collector_version = 'v11' AND NOT is_published
      AND run_state = 'running' AND started_at > now() - interval '40 hours'
    ORDER BY started_at DESC LIMIT 1
  ) r ON true;
$$;

CREATE OR REPLACE FUNCTION public.ai_prompts_list()
RETURNS TABLE (prompt_key text, prompt_text text, category text, prompt_kind text, active boolean, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT p.prompt_key, p.prompt_text, p.category::text, p.prompt_kind, p.active, p.created_at, p.updated_at
  FROM command.fmic_ai_prompts p
  ORDER BY p.prompt_key;
$$;

CREATE OR REPLACE FUNCTION public.ai_prompts_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT jsonb_build_object(
    'locked', l.locked,
    'run_id', l.run_id,
    'run_started_at', l.run_started_at,
    'active_count', (SELECT count(*) FROM command.fmic_ai_prompts WHERE active),
    'max_active', 99,
    'engines', 3,
    'repeats', coalesce((SELECT (metadata->>'repeats')::int FROM command.fmic_audit_runs
                         WHERE run_kind = 'ai_simulation' AND collector_version = 'v11'
                         ORDER BY started_at DESC LIMIT 1), 20),
    'categories', (SELECT coalesce(jsonb_agg(DISTINCT category ORDER BY category), '[]'::jsonb) FROM command.fmic_ai_prompts)
  )
  FROM command.fmic_ai_prompt_lock() l;
$$;

-- Add (p_prompt_key NULL) or edit (text and category). Returns the prompt key.
CREATE OR REPLACE FUNCTION public.ai_prompt_save(p_prompt_key text, p_prompt_text text, p_category text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  l record; old_row command.fmic_ai_prompts%ROWTYPE; new_key text; txt text; cat text; ts timestamptz := now(); n int;
BEGIN
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
END $$;

-- Remove (false) or restore (true) a prompt.
CREATE OR REPLACE FUNCTION public.ai_prompt_set_active(p_prompt_key text, p_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE l record; old_row command.fmic_ai_prompts%ROWTYPE; ts timestamptz := now(); n int;
BEGIN
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
END $$;

REVOKE ALL ON FUNCTION command.fmic_ai_prompt_lock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_prompts_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_prompts_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_prompt_save(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_prompt_set_active(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION command.fmic_ai_prompt_lock() TO service_role;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.ai_prompts_list() TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.ai_prompts_status() TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.ai_prompt_save(text, text, text) TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.ai_prompt_set_active(text, boolean) TO %I', r);
    END IF;
  END LOOP;
END $$;
