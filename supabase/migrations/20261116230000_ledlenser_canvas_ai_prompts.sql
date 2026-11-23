-- Ledlenser prompt list for the dashboard's Prompts screen (decision 89, Worker 27.10).
--
-- What it changes
--   Adds one read-only view, ledlenser.canvas_ai_prompts: every row of ledlenser.ai_prompts (the
--   Ledlenser AI Search battery, l01 to l32), with the columns the Prompts screen shows for Fender
--   through public.ai_prompts_list(): prompt_key, prompt_text, category, prompt_kind, active,
--   created_at, updated_at. It also returns analytical_intent, the role the battery stores for each
--   question, so the dashboard can later read the role instead of mirroring it in
--   lib/ai-search/stored-question-roles.ts.
--
--   Why: Fender's Prompts button reads command.fmic_ai_prompts through public.ai_prompts_list().
--   ledlenser.ai_prompts has no grant to anon or authenticated and no public function or canvas view
--   over it, so the dashboard cannot read Ledlenser's question list with the public key, and the
--   Prompts button is hidden for Ledlenser.
--
--   Additive. CREATE VIEW, not CREATE OR REPLACE, so it stops on a name that is already taken. No
--   existing table, column, view, function, grant, or row is altered or deleted, and no row is
--   written. Same grant style as the other ledlenser.canvas_* views: REVOKE ALL from PUBLIC, anon,
--   and authenticated, then GRANT SELECT to anon and authenticated only. Owner-rights view
--   (security_invoker = false), like ledlenser.canvas_ai_api_runs.
--
--   Read only. Ledlenser prompt edits (add, edit, remove, restore), the run lock, and an edit log
--   are not part of this file: they would need write functions and a ledlenser.ai_prompt_edits
--   table, which Brian Watson owns with the Ledlenser battery job.
--
-- How to undo
--   DROP VIEW IF EXISTS ledlenser.canvas_ai_prompts;
--   NOTIFY pgrst, 'reload schema';
--
-- Status: APPLIED to production 16 Nov 2026 by PM27 (Brian Magazu approved).

CREATE VIEW ledlenser.canvas_ai_prompts WITH (security_invoker = false) AS
SELECT
  p.prompt_key,
  p.prompt_text,
  p.category::text AS category,
  p.prompt_kind,
  p.active,
  p.created_at,
  p.updated_at,
  p.analytical_intent
FROM ledlenser.ai_prompts p;

COMMENT ON VIEW ledlenser.canvas_ai_prompts IS
  'Read-only Ledlenser AI Search prompt list (ledlenser.ai_prompts) for the dashboard Prompts screen.';

REVOKE ALL ON TABLE ledlenser.canvas_ai_prompts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE ledlenser.canvas_ai_prompts TO anon, authenticated;
GRANT ALL ON TABLE ledlenser.canvas_ai_prompts TO service_role;

NOTIFY pgrst, 'reload schema';
