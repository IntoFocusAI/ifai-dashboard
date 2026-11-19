-- Tighten public grants on one read-only view and two staff-only prompt functions.
--
-- Changes:
--   1. public.canvas_amazon_product_types: the dashboard only reads this view, but anon and authenticated
--      hold every table privilege on it (the 20261111230000 file granted SELECT only; the extra privileges
--      came from the project's default privileges on new public objects). Leaves SELECT, revokes the rest.
--   2. public.ai_prompt_save and public.ai_prompt_set_active (the Build prompts editor): revoke EXECUTE
--      from PUBLIC and anon. authenticated keeps EXECUTE so the editor can work again once the dashboard
--      calls it with a signed-in session; a staff check inside the functions is a follow-up.
--
-- Effect on the dashboard: reads are unchanged. The Build prompts editor (add, edit, remove, restore a
-- prompt) stops working until the dashboard signs users in and calls these functions with that session
-- (lib/ai-search/prompt-editor.ts uses the anon client today). Staff can still change prompts through
-- the service role or SQL in the meantime. Prompt reads (ai_prompts_list, ai_prompts_status) are unchanged.
--
-- This changes permissions on existing objects: Brian Watson applies, Brian Magazu approves (AGENTS.md).
--
-- Check after applying (expect: anon SELECT only on the view; anon cannot execute either function):
--   SELECT p, has_table_privilege('anon', 'public.canvas_amazon_product_types', p)
--   FROM unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
--   SELECT has_function_privilege('anon', 'public.ai_prompt_save(text,text,text)', 'EXECUTE'),
--          has_function_privilege('anon', 'public.ai_prompt_set_active(text,boolean)', 'EXECUTE');
--
-- Undo:
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.canvas_amazon_product_types TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.ai_prompt_save(text, text, text) TO anon;
--   GRANT EXECUTE ON FUNCTION public.ai_prompt_set_active(text, boolean) TO anon;
--
-- Production only. Status: NOT APPLIED.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.canvas_amazon_product_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.canvas_amazon_product_types TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ai_prompt_save(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ai_prompt_set_active(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_prompt_save(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_prompt_set_active(text, boolean) TO authenticated;
