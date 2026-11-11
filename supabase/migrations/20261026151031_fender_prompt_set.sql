-- Publish Fender's first versioned prompt set on production.
-- Same 34 prompts as the sandbox's published set (revision ids kept), which match command.fmic_ai_prompts
-- word for word. The sandbox set belonged to the test org "Worker 20 prompt client", so here it is owned by
-- Fender. IntoFocus (brian.w@intofocus.ai) is recorded as creator, reviewer and publisher.
-- Follows the lifecycle the guard triggers require: draft set and draft revisions, members added while the
-- set is a draft, revisions approved, set published with both hashes, revisions marked published.
-- The weekly AI battery still reads command.fmic_ai_prompts; this set does not change what it asks.

DO $$
DECLARE
  v_org  uuid;
  v_user uuid := '324317ce-b6fc-4e85-bf4e-c6975e8e24ea';  -- brian.w@intofocus.ai
  v_set  uuid := gen_random_uuid();
  v_now  timestamptz := now();
BEGIN
  SELECT id INTO v_org FROM command.organizations WHERE slug = 'fender';
  IF v_org IS NULL THEN RAISE EXCEPTION 'fender organization not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM command.organization_memberships
                 WHERE user_id = v_user AND status = 'active') THEN
    RAISE EXCEPTION 'reviewer % has no active membership', v_user;
  END IF;
  IF EXISTS (SELECT 1 FROM command.fmic_ai_prompt_sets WHERE organization_id = v_org) THEN
    RAISE EXCEPTION 'fender already has a prompt set; not creating another';
  END IF;

  INSERT INTO command.fmic_ai_prompt_sets (set_id, organization_id, status, max_active, created_by, created_at)
  VALUES (v_set, v_org, 'draft', 34, v_user, v_now);

  INSERT INTO command.fmic_ai_prompt_revisions
    (revision_id, prompt_key, prompt_text, category, prompt_kind, analytical_intent, headline_denominator,
     names_client_brand, induces_client_brand, import_origin,
     organization_id, revision_no, active, status, created_by, created_at)
  SELECT v.*, v_org, 1, true, 'draft', v_user, v_now
  FROM (VALUES
    ('78a3d80a-4ff0-42c2-89df-656b9f21c911'::uuid, 'p01', 'Best electric guitar under $900 for versatile tones', 'electrics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('1e185922-8773-454c-b4fe-a4b5582a80d2'::uuid, 'p02', 'Fender American Professional II Stratocaster vs PRS Silver Sky SE', 'electrics', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('5bc98f25-3f82-4a0b-b51f-5c77e917efcc'::uuid, 'p03', 'Is the Fender Player II Stratocaster good for beginners?', 'electrics', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('cd0d6a50-0207-4c3d-b9e8-fe0f07095a5c'::uuid, 'p04', 'What are the pickup types on a Fender Player II Stratocaster?', 'electrics', 'commercial', 'product_fact', 'excluded', true, true, 'historical_battery_20261012'),
    ('217bf8be-c5d4-4008-9f07-d1c396594faa'::uuid, 'p05', 'Best guitar for indie rock under $1000', 'electrics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('6000f639-458a-48cf-a14e-627fd9121b24'::uuid, 'p06', 'Best travel acoustic guitar for intermediate players', 'acoustics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('3c7f46f8-95c2-4034-95a2-149914d40976'::uuid, 'p07', 'Best beginner acoustic guitar under $250 with solid top', 'acoustics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('a03f239c-02a4-456d-9d63-6511b3acc3c2'::uuid, 'p08', 'Fender Acoustasonic Player Telecaster pickup types and sounds', 'acoustics', 'commercial', 'product_fact', 'excluded', true, true, 'historical_battery_20261012'),
    ('3c884aa8-c50b-4833-9bb3-fed7e14f0d25'::uuid, 'p09', 'Best headphone guitar amp with bluetooth for quiet practice', 'amps', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('6ca13351-c5f2-4a5e-aff1-5e9437e1283d'::uuid, 'p10', 'Fender Tone Master Deluxe Reverb tube types and biasing instructions', 'amps', 'commercial', 'product_fact', 'excluded', true, true, 'historical_battery_20261012'),
    ('46b1238a-f4f8-41f8-ad47-b35cf6be889b'::uuid, 'p11', 'Best professional bass guitar for recording and gigging under $1000', 'basses', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('6c681c1a-2de2-492c-b8b2-1edf087d8fae'::uuid, 'p12', 'Fender Player Precision Bass vs Sire Marcus Miller P5', 'basses', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('a5dc8204-605b-4bd6-b476-1375ebb90741'::uuid, 'p13', 'Best budget Stratocaster alternative for upgrading mod platform', 'squier', 'commercial', 'brand_associated_discovery', 'brand_associated_discovery', false, true, 'historical_battery_20261012'),
    ('e49680fe-27cc-407b-a696-a9bd4de98269'::uuid, 'p14', 'Is Squier Classic Vibe 60s Stratocaster good quality?', 'squier', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('b2862012-d49a-4729-bff5-c4f0698f0f24'::uuid, 'p15', 'What is the best first electric guitar for a total beginner?', 'beginner', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('41d0e377-a1ee-4fa3-a7b0-cc0aaf6ec6f6'::uuid, 'p16', 'Fender vs Yamaha for a beginner guitarist', 'beginner', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('6d92de81-af1e-4d22-8be2-1f95c31ae93d'::uuid, 'p17', 'Fender Player II Stratocaster neck radius and fret size', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, true, 'historical_battery_20261012'),
    ('6e4c806a-00b6-406e-8878-fda4dda09d85'::uuid, 'p18', 'What body wood does the Fender American Professional II Telecaster use?', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, true, 'historical_battery_20261012'),
    ('72c37540-cf1a-4d79-b4cb-5e59a9440701'::uuid, 'p19', 'Does the Fender Mustang Micro amp have vacuum tubes?', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, true, 'historical_battery_20261012'),
    ('851e00ef-0030-405c-8d5f-cbaea68d273c'::uuid, 'p20', 'Fender Telecaster vs Gibson Les Paul for rock music', 'electrics', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('002c2c9b-b378-4475-b43c-4c4f4bab18db'::uuid, 'p21', 'Best semi-hollow electric guitar under $1500', 'electrics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('83528aff-07ab-4ced-afcd-4b0d1091f107'::uuid, 'p22', 'Fender CD-60S vs Yamaha FG800 for a beginner', 'acoustics', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('baade44e-8b7e-4eaa-ad98-9ab175697ec4'::uuid, 'p23', 'Boss Katana vs Fender Mustang for home practice', 'amps', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('90f9d4d3-77cc-45c9-b8f5-abed5749c082'::uuid, 'p24', 'Best 5-string bass guitar for gigging musicians', 'basses', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('57c421ea-a36a-4829-9fc1-7db411eef6e7'::uuid, 'p25', 'Squier Affinity vs Squier Bullet Stratocaster differences', 'squier', 'commercial', 'product_fact', 'excluded', true, true, 'historical_battery_20261012'),
    ('41387d52-9592-4fb2-ab2e-44654c9afb48'::uuid, 'p26', 'How much should a beginner spend on their first guitar', 'beginner', 'commercial', 'shopping_guidance', 'excluded', false, false, 'historical_battery_20261012'),
    ('cbd5346b-37d5-424b-9a22-77aa6f0b3052'::uuid, 'p27', 'What makes the Fender American Ultra II different from American Professional II', 'electrics', 'commercial', 'product_fact', 'excluded', true, true, 'historical_battery_20261012'),
    ('2296d5ec-f08d-46b5-b600-c8c7461fcbce'::uuid, 'p28', 'Best guitar for playing blues under $800', 'electrics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('be92acf7-1066-4818-9b8b-a239654773a1'::uuid, 'p29', 'Best parlor acoustic guitar for small hands', 'acoustics', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, false, 'historical_battery_20261012'),
    ('1d779839-29b1-4689-852f-6f916ea44529'::uuid, 'p30', 'Positive Grid Spark vs Fender Mustang Micro comparison', 'amps', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('920a7486-fc43-4775-8841-55f3261cddf0'::uuid, 'p31', 'Fender Jazz Bass vs Precision Bass tonal differences', 'basses', 'commercial', 'product_fact', 'excluded', true, true, 'historical_battery_20261012'),
    ('65b941ba-c6c4-46c3-b2a2-702a3fa95ffb'::uuid, 'p32', 'Is Squier a good brand or just a cheap knockoff', 'squier', 'commercial', 'branded_consideration', 'branded_consideration', true, true, 'historical_battery_20261012'),
    ('35a31508-7679-487f-83d8-24a1b0a2a273'::uuid, 'p33', 'What is the scale length of a Fender Jaguar', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, true, 'historical_battery_20261012'),
    ('74ee5838-0089-48e6-9684-4442b7520541'::uuid, 'p34', 'Does the Fender Player Plus Stratocaster have noiseless pickups', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, true, 'historical_battery_20261012')

  ) AS v(revision_id, prompt_key, prompt_text, category, prompt_kind, analytical_intent, headline_denominator,
         names_client_brand, induces_client_brand, import_origin);

  INSERT INTO command.fmic_ai_prompt_set_members (set_id, revision_id, prompt_key)
  SELECT v_set, revision_id, prompt_key FROM command.fmic_ai_prompt_revisions WHERE organization_id = v_org;

  UPDATE command.fmic_ai_prompt_revisions
     SET status = 'approved', reviewed_by = v_user, reviewed_at = v_now,
         review_note = 'Imported from the sandbox set; approved by IntoFocus'
   WHERE organization_id = v_org;

  UPDATE command.fmic_ai_prompt_sets
     SET status = 'published',
         versioned_set_hash = command.fmic_ai_versioned_set_hash(v_set),
         legacy_prompt_set_hash = command.fmic_ai_prompt_set_hash(),
         published_by = v_user, published_at = v_now
   WHERE set_id = v_set;

  UPDATE command.fmic_ai_prompt_revisions
     SET status = 'published', published_set_id = v_set
   WHERE organization_id = v_org;
END $$;

-- Check: the published set is valid and has 34 active prompts.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM command.fmic_ai_published_prompts p
  JOIN command.organizations o ON o.id = p.organization_id WHERE o.slug = 'fender';
  IF n <> 34 THEN RAISE EXCEPTION 'expected 34 published Fender prompts, found %', n; END IF;
END $$;
