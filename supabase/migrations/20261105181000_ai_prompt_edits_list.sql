-- Prompt change history for the Prompts screen (A-08).
--
-- Changes: adds public.ai_prompt_edits_list(text). The function is SECURITY DEFINER
-- and returns rows from command.fmic_ai_prompt_edits for one prompt key, and nothing else.
-- It does not read or write any other table. anon, authenticated, and service_role may
-- execute it, the same grant style as public.ai_prompts_list() in
-- 20261027183846_ai_prompts_editor.sql.
--
-- The returned columns are id, edited_at, action, prompt_key, before, and after.
-- source stays on the table and is not returned.
--
-- Existing tables, columns, and grants are unchanged. This file grants execute only
-- on the new function.
--
-- Undo:
--   REVOKE ALL ON FUNCTION public.ai_prompt_edits_list(text) FROM PUBLIC, anon, authenticated, service_role;
--   DROP FUNCTION public.ai_prompt_edits_list(text);
--
-- Status: additive. Not applied. Waits for Brian Magazu to approve applying it.
-- Brian Watson applies anything that alters or deletes. Do not run this file against
-- production until that approval is recorded.

CREATE OR REPLACE FUNCTION public.ai_prompt_edits_list(p_prompt_key text)
RETURNS TABLE (
  id uuid,
  edited_at timestamptz,
  action text,
  prompt_key text,
  before jsonb,
  after jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT e.id, e.edited_at, e.action, e.prompt_key, e.before, e.after
  FROM command.fmic_ai_prompt_edits e
  WHERE e.prompt_key = p_prompt_key
  ORDER BY e.edited_at DESC, e.id DESC;
$$;

REVOKE ALL ON FUNCTION public.ai_prompt_edits_list(text) FROM PUBLIC;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.ai_prompt_edits_list(text) TO %I', r);
    END IF;
  END LOOP;
END $$;
