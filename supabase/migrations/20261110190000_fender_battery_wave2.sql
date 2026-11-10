-- Fender AI battery, wave 2: 30 new shopping questions, p38 to p67. Add-only.
--
-- Changes:
--   command.fmic_ai_prompts           inserts p38 to p67: commercial, fixed, active. The battery asks
--                                     them from its next run. 64 prompts are then active (31 fixed,
--                                     3 rotating fact checks, 30 new).
--   command.fmic_ai_prompt_edits      inserts 30 'add' rows, source 'fender_battery_wave2'
--   command.fmic_ai_prompt_revisions  inserts draft revisions, then approves and publishes them:
--                                       p38 to p67   revision 1, the new questions
--                                       p35 to p37   revision 1, the rotating fact checks (added on
--                                                    4 Nov 2026 without a revision)
--                                       p18, p19, p34  revision 2, active = false (switched off on
--                                                    4 Nov 2026). Revision 1 stays as it is.
--   command.fmic_ai_prompt_sets       inserts Fender's second prompt set, published, max_active 64.
--                                     Members: the latest revision of p01 to p67.
--   command.fmic_ai_prompt_set_members  inserts 67 rows for that set
-- Existing rows are not changed. The first set (52212fcf) stays published and unchanged; the
-- newest published set is the current one.
--
-- Why: wave 2 of the battery. The questions vary one shopper detail at a time from a starting
-- question (budget, player level, genre and tone, upgrade moment, priority, question style), across
-- electrics, acoustics, amps and basses. The electric guitar choices follow Justin Hittell's
-- Recommendation Lab study (Oct 2026, Claude Sonnet, 966 answers). Brian Watson approved the list
-- on 10 Nov 2026. Brian Magazu approves before it is applied.
--
-- Tags. The dashboard reads a question's role from its wording (lib/ai-search/question-role.ts);
-- scripts/prompt-battery-wave2.test.ts checks every wave 2 question against it. On the dashboard,
-- 27 are unbranded discovery, p67 is branded consideration, and p63 and p64 are brand-associated
-- discovery because they name Squier and Yamaha. The revision tags below follow the table's check
-- constraint: p63 names Squier, so it is branded consideration there; p64 names no Fender brand, so
-- it is unbranded discovery there.
--
-- When: only while no battery run is in progress. The battery runs Sun, Tue and Thu at 06:00 UTC.
-- This refuses to apply while command.fmic_ai_prompt_lock() reports a running run, because the run
-- freezes its prompt list at start and command.fmic_ai_publish_run only publishes a run whose
-- prompt hash still matches.
--
-- Undo. Switch the new questions off. Rows stay, so their keys are never reused and history keeps
-- its labels. Revisions and sets cannot be deleted (guard triggers).
--   UPDATE command.fmic_ai_prompts SET active = false, updated_at = now()
--    WHERE prompt_key BETWEEN 'p38' AND 'p67';
--   INSERT INTO command.fmic_ai_prompt_edits (edited_at, action, prompt_key, before, after, source)
--   SELECT now(), 'remove', prompt_key, jsonb_build_object('active', true), jsonb_build_object('active', false),
--          'fender_battery_wave2_undo'
--     FROM command.fmic_ai_prompts WHERE prompt_key BETWEEN 'p38' AND 'p67';
--   Then publish a third set whose p38 to p67 revisions have active = false, the same way as below.
--
-- Applied: not yet.

DO $$
DECLARE
  v_org  uuid;
  v_user uuid := '324317ce-b6fc-4e85-bf4e-c6975e8e24ea';  -- brian.w@intofocus.ai
  v_set  uuid := gen_random_uuid();
  v_now  timestamptz := now();
  l      record;
  n      integer;
BEGIN
  SELECT * INTO l FROM command.fmic_ai_prompt_lock();
  IF l.locked THEN
    RAISE EXCEPTION 'AI run % is in progress (started %). Apply after it publishes.', l.run_id, l.run_started_at;
  END IF;

  SELECT id INTO v_org FROM command.organizations WHERE slug = 'fender';
  IF v_org IS NULL THEN RAISE EXCEPTION 'fender organization not found'; END IF;

  CREATE TEMP TABLE wave2 (prompt_key text, prompt_text text, category text, analytical_intent text,
                           headline_denominator text, names_client_brand boolean, induces_client_brand boolean)
    ON COMMIT DROP;
  INSERT INTO wave2 VALUES
    ('p38', 'What is the best electric guitar for an intermediate player under $1,000?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p39', 'What is the best electric guitar for a professional guitarist under $1,000?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p40', 'What is the best electric guitar for an intermediate player under $500?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p41', 'What is the best electric guitar for an intermediate player around $1,500?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p42', 'What is the best electric guitar for an intermediate player with no budget limit?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p43', 'What is the best electric guitar for an intermediate metal player under $1,000?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p44', 'What is the best electric guitar for an intermediate jazz player under $1,000?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p45', 'What is the best electric guitar for an intermediate country player under $1,000?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p46', 'What is the best acoustic guitar for an intermediate player under $1,000?', 'acoustics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p47', 'What is the best acoustic-electric guitar for playing live under $1,000?', 'acoustics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p48', 'What is the best acoustic guitar for fingerstyle playing under $1,000?', 'acoustics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p49', 'What is the best acoustic guitar for an intermediate player around $1,500?', 'acoustics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p50', 'What is the best acoustic guitar for singer-songwriters under $1,000?', 'acoustics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p51', 'What is the best guitar amp for an intermediate player under $500?', 'amps', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p52', 'What is the best tube amp for gigging under $1,000?', 'amps', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p53', 'What is the best amp for clean tones under $1,000?', 'amps', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p54', 'What is the best amp for high-gain metal under $1,000?', 'amps', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p55', 'What is the best modeling amp for home recording under $500?', 'amps', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p56', 'What is the best bass guitar for an intermediate player under $1,000?', 'basses', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p57', 'What is the best short-scale bass guitar under $500?', 'basses', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p58', 'What is the best bass guitar for metal under $1,000?', 'basses', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p59', 'What is the best bass guitar for a beginner under $500?', 'basses', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p60', 'Which brand makes the best electric guitars for intermediate players?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p61', 'Which brand makes the best bass guitars?', 'basses', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p62', 'Which brand makes the best guitar amps?', 'amps', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p63', 'I''m upgrading from a Squier. What is the best electric guitar to buy next under $1,500?', 'squier', 'branded_consideration', 'branded_consideration', true, true),
    ('p64', 'I''m upgrading from a Yamaha Pacifica. What is the best electric guitar to buy next under $1,500?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p65', 'Which electric guitars under $1,500 hold their resale value best?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p66', 'Which electric guitar brands have the best quality control?', 'electrics', 'unbranded_discovery', 'unbranded_discovery', false, false),
    ('p67', 'Fender American Professional II vs Player II: is the upgrade worth the extra money?', 'electrics', 'branded_consideration', 'branded_consideration', true, true);

  -- Never reuse a key or repeat a question.
  IF EXISTS (SELECT 1 FROM command.fmic_ai_prompts p JOIN wave2 w USING (prompt_key)) THEN
    RAISE EXCEPTION 'a key from p38 to p67 already exists in command.fmic_ai_prompts';
  END IF;
  IF EXISTS (SELECT 1 FROM command.fmic_ai_simulations s JOIN wave2 w USING (prompt_key)) THEN
    RAISE EXCEPTION 'a key from p38 to p67 already has stored answers';
  END IF;
  IF EXISTS (SELECT 1 FROM command.fmic_ai_prompts p JOIN wave2 w ON lower(p.prompt_text) = lower(w.prompt_text)) THEN
    RAISE EXCEPTION 'a wave 2 question repeats an existing question word for word';
  END IF;
  SELECT count(*) INTO n FROM command.fmic_ai_prompts WHERE active;
  IF n <> 34 THEN RAISE EXCEPTION 'expected 34 active prompts before wave 2, found %', n; END IF;

  -- 1. The questions the battery asks.
  INSERT INTO command.fmic_ai_prompts (prompt_key, prompt_text, category, prompt_kind, active, created_at, updated_at, probe_mode)
  SELECT prompt_key, prompt_text, category, 'commercial', true, v_now, v_now, 'fixed' FROM wave2;

  INSERT INTO command.fmic_ai_prompt_edits (edited_at, action, prompt_key, before, after, source)
  SELECT v_now, 'add', prompt_key, NULL,
         jsonb_build_object('prompt_text', prompt_text, 'category', category, 'prompt_kind', 'commercial', 'active', true),
         'fender_battery_wave2'
    FROM wave2;

  -- 2. Fender's second prompt set: draft set, draft revisions, members, approve, publish.
  INSERT INTO command.fmic_ai_prompt_sets (set_id, organization_id, status, max_active, created_by, created_at)
  VALUES (v_set, v_org, 'draft', 64, v_user, v_now);

  -- New questions.
  INSERT INTO command.fmic_ai_prompt_revisions
    (prompt_key, organization_id, revision_no, prompt_text, category, prompt_kind, analytical_intent,
     names_client_brand, induces_client_brand, headline_denominator, active, status, created_by, created_at)
  SELECT prompt_key, v_org, 1, prompt_text, category, 'commercial', analytical_intent,
         names_client_brand, induces_client_brand, headline_denominator, true, 'draft', v_user, v_now
    FROM wave2;

  -- Rotating fact checks, as stored in command.fmic_ai_prompts.
  INSERT INTO command.fmic_ai_prompt_revisions
    (prompt_key, organization_id, revision_no, prompt_text, category, prompt_kind, analytical_intent,
     names_client_brand, induces_client_brand, headline_denominator, active, status, created_by, created_at)
  SELECT p.prompt_key, v_org, 1, p.prompt_text, p.category, 'probe', 'product_fact_probe',
         true, true, 'excluded', true, 'draft', v_user, v_now
    FROM command.fmic_ai_prompts p
   WHERE p.prompt_key IN ('p35', 'p36', 'p37') AND p.active;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'expected active rotating fact checks p35 to p37, found %', n; END IF;

  -- Fact checks switched off on 4 Nov: a new revision with active = false.
  INSERT INTO command.fmic_ai_prompt_revisions
    (prompt_key, organization_id, revision_no, prompt_text, category, prompt_kind, analytical_intent,
     names_client_brand, induces_client_brand, headline_denominator, active, status, created_by, created_at)
  SELECT r.prompt_key, v_org, 2, r.prompt_text, r.category, r.prompt_kind, r.analytical_intent,
         r.names_client_brand, r.induces_client_brand, r.headline_denominator, false, 'draft', v_user, v_now
    FROM command.fmic_ai_prompt_revisions r
    JOIN command.fmic_ai_prompts p ON p.prompt_key = r.prompt_key AND NOT p.active
   WHERE r.organization_id = v_org AND r.revision_no = 1 AND r.prompt_key IN ('p18', 'p19', 'p34');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 3 THEN RAISE EXCEPTION 'expected switched-off p18, p19, p34 with a first revision, found %', n; END IF;

  -- Members: the latest revision of every key.
  INSERT INTO command.fmic_ai_prompt_set_members (set_id, revision_id, prompt_key)
  SELECT DISTINCT ON (r.prompt_key) v_set, r.revision_id, r.prompt_key
    FROM command.fmic_ai_prompt_revisions r
   WHERE r.organization_id = v_org
   ORDER BY r.prompt_key, r.revision_no DESC;

  UPDATE command.fmic_ai_prompt_revisions
     SET status = 'approved', reviewed_by = v_user, reviewed_at = v_now,
         review_note = 'Wave 2 battery (p38 to p67) and the 4 Nov fact-check rotation; approved by IntoFocus'
   WHERE organization_id = v_org AND status = 'draft' AND created_at = v_now;

  UPDATE command.fmic_ai_prompt_sets
     SET status = 'published',
         versioned_set_hash = command.fmic_ai_versioned_set_hash(v_set),
         legacy_prompt_set_hash = command.fmic_ai_prompt_set_hash(),
         published_by = v_user, published_at = v_now
   WHERE set_id = v_set;

  UPDATE command.fmic_ai_prompt_revisions
     SET status = 'published', published_set_id = v_set
   WHERE organization_id = v_org AND status = 'approved' AND created_at = v_now;
END $$;

-- Check: 64 prompts are active, the new set is current and valid, and it lists the same 64.
DO $$
DECLARE n integer; m integer; bad integer;
BEGIN
  SELECT count(*) INTO n FROM command.fmic_ai_prompts WHERE active;
  IF n <> 64 THEN RAISE EXCEPTION 'expected 64 active prompts, found %', n; END IF;
  SELECT count(*) INTO m FROM command.fmic_ai_published_prompts p
    JOIN command.organizations o ON o.id = p.organization_id WHERE o.slug = 'fender';
  IF m <> 64 THEN RAISE EXCEPTION 'expected 64 published Fender prompts, found %', m; END IF;
  SELECT count(*) INTO bad
    FROM command.fmic_ai_prompts a
    FULL JOIN (SELECT p.prompt_key, p.prompt_text FROM command.fmic_ai_published_prompts p
                 JOIN command.organizations o ON o.id = p.organization_id WHERE o.slug = 'fender') s
      ON s.prompt_key = a.prompt_key
   WHERE (a.active OR s.prompt_key IS NOT NULL)
     AND (a.prompt_key IS NULL OR s.prompt_key IS NULL OR NOT a.active OR a.prompt_text IS DISTINCT FROM s.prompt_text);
  IF bad <> 0 THEN RAISE EXCEPTION 'published set and active prompts differ on % keys', bad; END IF;
END $$;
