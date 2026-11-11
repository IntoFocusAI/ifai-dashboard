-- Prompt change history for the Prompts screen (FDD A-08, decision 14).
--
-- What it changes
--   Adds one function, public.ai_prompt_edits_list(text). It is SECURITY DEFINER and returns the
--   rows of command.fmic_ai_prompt_edits for one prompt key, newest first, and nothing else. It
--   reads that one table and writes nothing. anon, authenticated, and service_role may execute
--   it, the same grant style as public.ai_prompts_list() in 20261027183846_ai_prompts_editor.sql.
--
--   Returned columns: id, edited_at, action, prompt_key, before, after. The table's source
--   column stays on the table and is not returned.
--
--   Passing NULL returns the edits of every prompt, so the screen can tell an empty log from a
--   function that is not there.
--
--   Additive. No existing table, column, view, function, grant, or row is altered or deleted.
--   Fender only: Ledlenser's prompt list is read-only and has no edit log.
--
-- How to undo
--   REVOKE ALL ON FUNCTION public.ai_prompt_edits_list(text) FROM PUBLIC, anon, authenticated, service_role;
--   DROP FUNCTION public.ai_prompt_edits_list(text);
--   NOTIFY pgrst, 'reload schema';
--
-- Status: NOT APPLIED. Approved in principle by Brian Magazu on 9 Nov 2026 (decision 14). The
-- FenderTest agent applies it after that approval is recorded on the pull request. Until then
-- the Prompts screen says the change history is not available and shows no history rows.

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
  WHERE p_prompt_key IS NULL OR e.prompt_key = p_prompt_key
  ORDER BY e.edited_at DESC, e.id DESC;
$$;

COMMENT ON FUNCTION public.ai_prompt_edits_list(text) IS
  'Read-only change history of the AI Search prompt list (command.fmic_ai_prompt_edits) for one prompt key, or every prompt when the key is NULL.';

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

NOTIFY pgrst, 'reload schema';
