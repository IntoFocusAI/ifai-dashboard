-- Publish a finished AI Search run with the answers that were collected.
-- Idempotent. Does not publish a run by itself.
--
-- The live function had grown a per-engine floor: any engine under 70%
-- answered raised "engine below 70% answered" and the run stayed unpublished.
-- That floor is removed. Provider errors remain on the run and stay visible.
-- A run still has to be completed or partial, match the active prompt set,
-- and store one row for every expected call.
--
-- Applied: production, 26 Oct 2026, recorded as version 20261026155847
-- (replace_fmic_ai_publish_run); this file was 20261026160000 in the pull request.
-- Checked 11 Nov 2026: the live command.fmic_ai_publish_run matches this definition.

CREATE OR REPLACE FUNCTION command.fmic_ai_publish_run(p_run_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = ''
AS $f$
DECLARE r command.fmic_audit_runs%ROWTYPE; n integer;
BEGIN
  SELECT * INTO r FROM command.fmic_audit_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'run % not found', p_run_id; END IF;
  IF r.is_published THEN RETURN; END IF;
  IF r.run_state IS NULL OR r.run_state NOT IN ('completed', 'partial') THEN
    RAISE EXCEPTION 'run % has run_state %, only completed or partial runs can be published', p_run_id, r.run_state;
  END IF;
  IF r.prompt_set_hash IS DISTINCT FROM command.fmic_ai_prompt_set_hash() THEN
    RAISE EXCEPTION 'run % prompt_set_hash does not match the active prompt set', p_run_id;
  END IF;
  SELECT count(*) INTO n FROM command.fmic_ai_simulations WHERE audit_run_id = p_run_id;
  IF r.expected_calls IS NULL OR r.attempted_calls IS DISTINCT FROM n OR n = 0 THEN
    RAISE EXCEPTION 'run % call counts do not reconcile (attempted %, rows %)', p_run_id, r.attempted_calls, n;
  END IF;
  UPDATE command.fmic_audit_runs SET is_published = true, published_at = now() WHERE id = p_run_id;
END $f$;

REVOKE ALL ON FUNCTION command.fmic_ai_publish_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION command.fmic_ai_publish_run(uuid) TO service_role;
