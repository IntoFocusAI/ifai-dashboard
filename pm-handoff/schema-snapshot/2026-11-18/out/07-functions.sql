-- command.enforce_intofocus_admin_platform_org()  kind=f  security_definer=f  config={"search_path=command, public"}  owner=postgres
CREATE OR REPLACE FUNCTION command.enforce_intofocus_admin_platform_org()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'command', 'public'
AS $function$
DECLARE
  platform boolean;
BEGIN
  IF NEW.role = 'intofocus_admin' THEN
    SELECT is_platform_org INTO platform
    FROM command.organizations
    WHERE id = NEW.organization_id;

    IF NOT COALESCE(platform, false) THEN
      RAISE EXCEPTION 'intofocus_admin is only allowed on the platform organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$


-- command.fmic_ai_block_published_edit()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_block_published_edit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE rid uuid;
BEGIN
  rid := CASE WHEN TG_OP = 'DELETE' THEN OLD.audit_run_id ELSE NEW.audit_run_id END;
  IF rid IS NOT NULL AND EXISTS (SELECT 1 FROM command.fmic_audit_runs WHERE id = rid AND is_published) THEN
    RAISE EXCEPTION 'run % is published and immutable', rid;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$


-- command.fmic_ai_current_published_prompts(p_organization_id uuid)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_current_published_prompts(p_organization_id uuid)
 RETURNS TABLE(organization_id uuid, set_id uuid, revision_id uuid, revision_no integer, prompt_key text, prompt_text text, category character varying, prompt_kind text, analytical_intent text, names_client_brand boolean, induces_client_brand boolean, headline_denominator text, active boolean, versioned_set_hash text, legacy_prompt_set_hash text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE st record;
BEGIN
  SELECT * INTO st FROM command.fmic_ai_published_set_status(p_organization_id);
  IF NOT st.set_found OR NOT st.hash_valid THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.organization_id, s.set_id, r.revision_id, r.revision_no, r.prompt_key, r.prompt_text,
         r.category, r.prompt_kind, r.analytical_intent, r.names_client_brand, r.induces_client_brand,
         r.headline_denominator, r.active, s.versioned_set_hash, s.legacy_prompt_set_hash
  FROM command.fmic_ai_prompt_sets s
  JOIN command.fmic_ai_prompt_set_members m ON m.set_id = s.set_id
  JOIN command.fmic_ai_prompt_revisions r ON r.revision_id = m.revision_id
  WHERE s.set_id = st.set_id AND r.active
  ORDER BY r.prompt_key;
END
$function$


-- command.fmic_ai_legacy_hash_for_set(p_set_id uuid)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_legacy_hash_for_set(p_set_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT md5(string_agg(r.prompt_key || ':' || r.prompt_text, E'\n' ORDER BY r.prompt_key))
  FROM command.fmic_ai_prompt_set_members m
  JOIN command.fmic_ai_prompt_revisions r ON r.revision_id = m.revision_id
  WHERE m.set_id = p_set_id AND r.active
$function$


-- command.fmic_ai_prompt_actor_ok(p_organization_id uuid, p_min_role command.organization_role)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_actor_ok(p_organization_id uuid, p_min_role command.organization_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ SELECT command.user_has_org_role(p_organization_id, p_min_role) $function$


-- command.fmic_ai_prompt_approve_revision(p_revision_id uuid, p_decision text, p_review_note text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_approve_revision(p_revision_id uuid, p_decision text, p_review_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE rec command.fmic_ai_prompt_revisions%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'prompt validation: decision must be approved or rejected'; END IF;
  SELECT * INTO rec FROM command.fmic_ai_prompt_revisions WHERE revision_id = p_revision_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prompt validation: revision not found'; END IF;
  PERFORM command.fmic_ai_prompt_require(rec.organization_id, 'intofocus_admin', 'approve or reject a revision');
  IF rec.status <> 'draft' THEN RAISE EXCEPTION 'prompt validation: only a draft revision can be decided'; END IF;
  UPDATE command.fmic_ai_prompt_revisions SET status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_review_note WHERE revision_id = p_revision_id;
END $function$


-- command.fmic_ai_prompt_fact_guard()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_fact_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.analytical_intent = 'product_fact' AND NEW.prompt_kind = 'probe' THEN
    IF NOT EXISTS (SELECT 1 FROM command.fmic_ai_probe_facts f WHERE f.prompt_key = NEW.prompt_key) THEN
      RAISE EXCEPTION 'prompt validation: product_fact stays commercial unless % has a verified fact contract', NEW.prompt_key;
    END IF;
  END IF;
  IF NEW.analytical_intent = 'product_fact_probe' AND NEW.prompt_kind <> 'probe' THEN
    RAISE EXCEPTION 'prompt validation: product_fact_probe stays probe';
  END IF;
  RETURN NEW;
END
$function$


-- command.fmic_ai_prompt_list_sets(p_organization_id uuid)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_list_sets(p_organization_id uuid)
 RETURNS TABLE(set_id uuid, status text, max_active integer, legacy_prompt_set_hash text, versioned_set_hash text, published_at timestamp with time zone, member_count integer, active_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
BEGIN
  PERFORM command.fmic_ai_prompt_require(p_organization_id, 'org_viewer', 'list prompt sets');
  RETURN QUERY
  SELECT s.set_id, s.status, s.max_active, s.legacy_prompt_set_hash, s.versioned_set_hash, s.published_at,
         (SELECT count(*)::integer FROM command.fmic_ai_prompt_set_members m WHERE m.set_id = s.set_id),
         (SELECT count(*)::integer FROM command.fmic_ai_prompt_set_members m JOIN command.fmic_ai_prompt_revisions r ON r.revision_id = m.revision_id WHERE m.set_id = s.set_id AND r.active)
  FROM command.fmic_ai_prompt_sets s WHERE s.organization_id = p_organization_id
  ORDER BY s.status, s.published_at NULLS FIRST, s.created_at;
END $function$


-- command.fmic_ai_prompt_lock()  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_lock()
 RETURNS TABLE(locked boolean, run_id uuid, run_started_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT r.id IS NOT NULL, r.id, r.started_at
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT id, started_at FROM command.fmic_audit_runs
    WHERE run_kind = 'ai_simulation' AND collector_version = 'v11' AND NOT is_published
      AND run_state = 'running' AND started_at > now() - interval '40 hours'
    ORDER BY started_at DESC LIMIT 1
  ) r ON true;
$function$


-- command.fmic_ai_prompt_member_guard()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_member_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE parent_status text; parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.set_id ELSE NEW.set_id END;
  SELECT status INTO parent_status FROM command.fmic_ai_prompt_sets WHERE set_id = parent_id;
  IF parent_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'prompt immutable: members of set % cannot change', parent_id; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$


-- command.fmic_ai_prompt_preview(p_organization_id uuid, p_revision_ids uuid[])  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_preview(p_organization_id uuid, p_revision_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE failures text[]; published_ids uuid[]; active_count integer := 0;
BEGIN
  PERFORM command.fmic_ai_prompt_require(p_organization_id, 'org_viewer', 'preview a prompt set');
  failures := command.fmic_ai_prompt_validation_failures(p_organization_id, p_revision_ids, 34);
  SELECT coalesce(array_agg(m.revision_id), ARRAY[]::uuid[]) INTO published_ids
  FROM command.fmic_ai_prompt_set_members m
  JOIN command.fmic_ai_prompt_sets s ON s.set_id = m.set_id
  WHERE s.organization_id = p_organization_id AND s.status = 'published'
    AND s.published_at = (SELECT max(published_at) FROM command.fmic_ai_prompt_sets WHERE organization_id = p_organization_id AND status = 'published');
  SELECT count(*) INTO active_count FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (p_revision_ids) AND r.active;
  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'engines', '["chatgpt","perplexity","gemini"]'::jsonb,
    'active_prompt_count', active_count,
    'active_prompts_by_engine', jsonb_build_object('chatgpt', active_count, 'perplexity', active_count, 'gemini', active_count),
    'expected_calls', active_count * 3,
    'by_intent', (SELECT coalesce(jsonb_object_agg(g.intent, g.rows), '{}'::jsonb) FROM (SELECT r.analytical_intent AS intent, jsonb_agg(jsonb_build_object('prompt_key', r.prompt_key, 'revision_no', r.revision_no, 'prompt_text', r.prompt_text, 'category', r.category, 'prompt_kind', r.prompt_kind, 'names_client_brand', r.names_client_brand, 'induces_client_brand', r.induces_client_brand, 'headline_denominator', r.headline_denominator, 'active', r.active, 'status', r.status) ORDER BY r.prompt_key) AS rows FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (p_revision_ids) GROUP BY r.analytical_intent) g),
    'names_or_induces', (SELECT coalesce(jsonb_agg(r.prompt_key ORDER BY r.prompt_key), '[]'::jsonb) FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (p_revision_ids) AND (r.names_client_brand OR r.induces_client_brand)),
    'headline_denominators', (SELECT coalesce(jsonb_object_agg(d.den, d.keys), '{}'::jsonb) FROM (SELECT r.headline_denominator AS den, jsonb_agg(r.prompt_key ORDER BY r.prompt_key) AS keys FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (p_revision_ids) GROUP BY r.headline_denominator) d),
    'differences_from_published', jsonb_build_object(
      'added', (SELECT coalesce(jsonb_agg(c.prompt_key ORDER BY c.prompt_key), '[]'::jsonb) FROM command.fmic_ai_prompt_revisions c WHERE c.revision_id = ANY (p_revision_ids) AND NOT EXISTS (SELECT 1 FROM command.fmic_ai_prompt_revisions p WHERE p.revision_id = ANY (published_ids) AND p.prompt_key = c.prompt_key)),
      'removed', (SELECT coalesce(jsonb_agg(p.prompt_key ORDER BY p.prompt_key), '[]'::jsonb) FROM command.fmic_ai_prompt_revisions p WHERE p.revision_id = ANY (published_ids) AND NOT EXISTS (SELECT 1 FROM command.fmic_ai_prompt_revisions c WHERE c.revision_id = ANY (p_revision_ids) AND c.prompt_key = p.prompt_key)),
      'reworded', (SELECT coalesce(jsonb_agg(c.prompt_key ORDER BY c.prompt_key), '[]'::jsonb) FROM command.fmic_ai_prompt_revisions c JOIN command.fmic_ai_prompt_revisions p ON p.revision_id = ANY (published_ids) AND p.prompt_key = c.prompt_key WHERE c.revision_id = ANY (p_revision_ids) AND c.prompt_text IS DISTINCT FROM p.prompt_text),
      'intent_changed', (SELECT coalesce(jsonb_agg(c.prompt_key ORDER BY c.prompt_key), '[]'::jsonb) FROM command.fmic_ai_prompt_revisions c JOIN command.fmic_ai_prompt_revisions p ON p.revision_id = ANY (published_ids) AND p.prompt_key = c.prompt_key WHERE c.revision_id = ANY (p_revision_ids) AND c.analytical_intent IS DISTINCT FROM p.analytical_intent),
      'activation_changed', (SELECT coalesce(jsonb_agg(c.prompt_key ORDER BY c.prompt_key), '[]'::jsonb) FROM command.fmic_ai_prompt_revisions c JOIN command.fmic_ai_prompt_revisions p ON p.revision_id = ANY (published_ids) AND p.prompt_key = c.prompt_key WHERE c.revision_id = ANY (p_revision_ids) AND c.active IS DISTINCT FROM p.active)
    ),
    'validation_failures', to_jsonb(failures)
  );
END $function$


-- command.fmic_ai_prompt_publish_set(p_organization_id uuid, p_revision_ids uuid[], p_max_active integer)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_publish_set(p_organization_id uuid, p_revision_ids uuid[], p_max_active integer DEFAULT 34)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE draft_set uuid; failures text[]; legacy_hash text; versioned_hash text; ids uuid[];
BEGIN
  PERFORM command.fmic_ai_prompt_require(p_organization_id, 'intofocus_admin', 'publish a prompt set');
  SELECT set_id INTO draft_set FROM command.fmic_ai_prompt_sets WHERE organization_id = p_organization_id AND status = 'draft' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prompt validation: no open draft set'; END IF;
  IF p_revision_ids IS NULL THEN
    SELECT coalesce(array_agg(revision_id), ARRAY[]::uuid[]) INTO ids FROM command.fmic_ai_prompt_set_members WHERE set_id = draft_set;
  ELSE ids := p_revision_ids; END IF;
  failures := command.fmic_ai_prompt_validation_failures(p_organization_id, ids, p_max_active);
  IF cardinality(failures) > 0 THEN RAISE EXCEPTION 'prompt validation: %', array_to_string(failures, '; '); END IF;
  IF p_revision_ids IS NOT NULL THEN
    DELETE FROM command.fmic_ai_prompt_set_members WHERE set_id = draft_set;
    INSERT INTO command.fmic_ai_prompt_set_members (set_id, revision_id, prompt_key)
    SELECT draft_set, r.revision_id, r.prompt_key FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (ids);
  END IF;
  legacy_hash := command.fmic_ai_legacy_hash_for_set(draft_set);
  versioned_hash := command.fmic_ai_versioned_set_hash(draft_set);
  IF legacy_hash IS NULL OR versioned_hash IS NULL THEN RAISE EXCEPTION 'prompt validation: set hash could not be calculated'; END IF;
  IF versioned_hash = legacy_hash THEN RAISE EXCEPTION 'prompt validation: versioned hash collided with the legacy hash'; END IF;
  UPDATE command.fmic_ai_prompt_revisions SET status = 'published', published_set_id = draft_set WHERE revision_id = ANY (ids);
  UPDATE command.fmic_ai_prompt_sets SET status = 'published', max_active = p_max_active, legacy_prompt_set_hash = legacy_hash, versioned_set_hash = versioned_hash, published_by = auth.uid(), published_at = now() WHERE set_id = draft_set;
  RETURN draft_set;
END $function$


-- command.fmic_ai_prompt_require(p_organization_id uuid, p_min_role command.organization_role, p_action text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_require(p_organization_id uuid, p_min_role command.organization_role, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'prompt auth: anonymous users cannot %', p_action; END IF;
  IF p_min_role = 'intofocus_admin' THEN
    IF NOT command.is_intofocus_admin() THEN RAISE EXCEPTION 'prompt auth: IntoFocus platform admin required to %', p_action; END IF;
    RETURN;
  END IF;
  IF NOT command.user_has_org_role(p_organization_id, p_min_role) THEN RAISE EXCEPTION 'prompt auth: % required to %', p_min_role, p_action; END IF;
END $function$


-- command.fmic_ai_prompt_revision_guard()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_revision_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'prompt immutable: revisions cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'prompt validation: new revisions start as drafts';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IN ('published', 'rejected') THEN
    RAISE EXCEPTION 'prompt immutable: % revision % cannot change', OLD.status, OLD.revision_id;
  END IF;
  IF NEW.prompt_key IS DISTINCT FROM OLD.prompt_key
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.revision_no IS DISTINCT FROM OLD.revision_no
     OR NEW.prompt_text IS DISTINCT FROM OLD.prompt_text
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.prompt_kind IS DISTINCT FROM OLD.prompt_kind
     OR NEW.analytical_intent IS DISTINCT FROM OLD.analytical_intent
     OR NEW.names_client_brand IS DISTINCT FROM OLD.names_client_brand
     OR NEW.induces_client_brand IS DISTINCT FROM OLD.induces_client_brand
     OR NEW.headline_denominator IS DISTINCT FROM OLD.headline_denominator
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.import_origin IS DISTINCT FROM OLD.import_origin
  THEN
    RAISE EXCEPTION 'prompt immutable: revision content cannot change; save a new revision';
  END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'prompt validation: draft can only be approved or rejected';
  END IF;
  IF OLD.status = 'approved' AND NEW.status <> 'published' THEN
    RAISE EXCEPTION 'prompt validation: approved revision can only be published';
  END IF;
  IF NEW.status IN ('approved', 'rejected', 'published')
     AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN
    RAISE EXCEPTION 'prompt validation: reviewer is required';
  END IF;
  IF NEW.status = 'published' AND NEW.published_set_id IS NULL THEN
    RAISE EXCEPTION 'prompt validation: published revision needs a set id';
  END IF;
  IF NEW.status <> 'published' AND NEW.published_set_id IS NOT NULL THEN
    RAISE EXCEPTION 'prompt validation: only a published revision carries a set id';
  END IF;
  RETURN NEW;
END
$function$


-- command.fmic_ai_prompt_save_draft(p_organization_id uuid, p_prompt_key text, p_prompt_text text, p_category text, p_prompt_kind text, p_analytical_intent text, p_names_client_brand boolean, p_induces_client_brand boolean, p_headline_denominator text, p_active boolean)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_save_draft(p_organization_id uuid, p_prompt_key text, p_prompt_text text, p_category text, p_prompt_kind text, p_analytical_intent text, p_names_client_brand boolean, p_induces_client_brand boolean, p_headline_denominator text, p_active boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE new_id uuid; next_no integer; draft_set uuid;
BEGIN
  PERFORM command.fmic_ai_prompt_require(p_organization_id, 'org_admin', 'save a draft');
  IF p_analytical_intent IS NULL OR length(btrim(p_analytical_intent)) = 0 THEN RAISE EXCEPTION 'prompt validation: analytical intent is required'; END IF;
  SELECT coalesce(max(revision_no), 0) + 1 INTO next_no FROM command.fmic_ai_prompt_revisions WHERE organization_id = p_organization_id AND prompt_key = p_prompt_key;
  INSERT INTO command.fmic_ai_prompt_revisions (prompt_key, organization_id, revision_no, prompt_text, category, prompt_kind, analytical_intent, names_client_brand, induces_client_brand, headline_denominator, active, status, created_by)
  VALUES (p_prompt_key, p_organization_id, next_no, p_prompt_text, p_category, p_prompt_kind, p_analytical_intent, p_names_client_brand, p_induces_client_brand, p_headline_denominator, p_active, 'draft', auth.uid())
  RETURNING revision_id INTO new_id;
  INSERT INTO command.fmic_ai_prompt_sets (organization_id, status, max_active, created_by)
  SELECT p_organization_id, 'draft', 34, auth.uid()
  WHERE NOT EXISTS (SELECT 1 FROM command.fmic_ai_prompt_sets WHERE organization_id = p_organization_id AND status = 'draft');
  SELECT set_id INTO draft_set FROM command.fmic_ai_prompt_sets WHERE organization_id = p_organization_id AND status = 'draft';
  DELETE FROM command.fmic_ai_prompt_set_members WHERE set_id = draft_set AND prompt_key = p_prompt_key;
  INSERT INTO command.fmic_ai_prompt_set_members (set_id, revision_id, prompt_key) VALUES (draft_set, new_id, p_prompt_key);
  RETURN new_id;
END $function$


-- command.fmic_ai_prompt_set_guard()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_set_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'prompt immutable: prompt sets cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'prompt validation: new prompt sets start as drafts'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'published' THEN RAISE EXCEPTION 'prompt immutable: published set % cannot change', OLD.set_id; END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'prompt immutable: prompt set identity cannot change';
  END IF;
  IF OLD.status = 'draft' AND NEW.status = 'draft' THEN RETURN NEW; END IF;
  IF OLD.status = 'draft' AND NEW.status = 'published' THEN
    IF NEW.versioned_set_hash IS NULL OR NEW.legacy_prompt_set_hash IS NULL THEN RAISE EXCEPTION 'prompt validation: published set needs both hashes'; END IF;
    IF NEW.published_by IS NULL OR NEW.published_at IS NULL THEN RAISE EXCEPTION 'prompt validation: published set needs a publisher'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'prompt validation: unsupported prompt set transition';
END
$function$


-- command.fmic_ai_prompt_set_hash()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_set_hash()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT md5(string_agg(prompt_key || ':' || prompt_text, E'\n' ORDER BY prompt_key)) FROM command.fmic_ai_prompts WHERE active $function$


-- command.fmic_ai_prompt_validation_failures(p_organization_id uuid, p_revision_ids uuid[], p_max_active integer)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_prompt_validation_failures(p_organization_id uuid, p_revision_ids uuid[], p_max_active integer)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE failures text[] := ARRAY[]::text[]; active_count integer; dup_key text; rec record;
BEGIN
  IF p_max_active IS NULL OR p_max_active < 1 THEN failures := failures || 'max_active must be a positive number'; END IF;
  IF p_revision_ids IS NULL OR cardinality(p_revision_ids) = 0 THEN RETURN failures || 'candidate set has no revisions'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_revision_ids) AS x(revision_id) WHERE NOT EXISTS (SELECT 1 FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = x.revision_id AND r.organization_id = p_organization_id)) THEN
    failures := failures || 'candidate contains a revision outside this organization';
  END IF;
  SELECT m.prompt_key INTO dup_key FROM command.fmic_ai_prompt_revisions m WHERE m.revision_id = ANY (p_revision_ids) GROUP BY m.prompt_key HAVING count(*) > 1 LIMIT 1;
  IF dup_key IS NOT NULL THEN failures := failures || ('duplicate prompt key ' || dup_key); END IF;
  SELECT count(*) INTO active_count FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (p_revision_ids) AND r.active;
  IF p_max_active IS NOT NULL AND active_count > p_max_active THEN failures := failures || format('active count %s exceeds max_active %s', active_count, p_max_active); END IF;
  FOR rec IN SELECT r.prompt_key, r.status, r.analytical_intent, r.prompt_kind FROM command.fmic_ai_prompt_revisions r WHERE r.revision_id = ANY (p_revision_ids) ORDER BY r.prompt_key LOOP
    IF rec.analytical_intent IS NULL OR length(btrim(rec.analytical_intent)) = 0 THEN failures := failures || (rec.prompt_key || ' has no analytical intent'); END IF;
    IF rec.status IS DISTINCT FROM 'approved' THEN failures := failures || (rec.prompt_key || ' is ' || rec.status || ', not approved'); END IF;
    IF rec.analytical_intent = 'product_fact' AND rec.prompt_kind = 'probe' AND NOT EXISTS (SELECT 1 FROM command.fmic_ai_probe_facts f WHERE f.prompt_key = rec.prompt_key) THEN
      failures := failures || (rec.prompt_key || ' product_fact cannot become a probe without a verified fact');
    END IF;
  END LOOP;
  RETURN failures;
END $function$


-- command.fmic_ai_publish_run(p_run_id uuid)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_publish_run(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
END $function$


-- command.fmic_ai_published_set_status(p_organization_id uuid)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_published_set_status(p_organization_id uuid)
 RETURNS TABLE(set_found boolean, hash_valid boolean, set_id uuid, versioned_set_hash text, legacy_prompt_set_hash text, active_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE rec command.fmic_ai_prompt_sets%ROWTYPE;
  recomputed text;
  active_n integer;
  row_found boolean;
BEGIN
  SELECT * INTO rec
  FROM command.fmic_ai_prompt_sets s
  WHERE s.organization_id = p_organization_id AND s.status = 'published'
  ORDER BY s.published_at DESC
  LIMIT 1;
  row_found := FOUND;
  IF NOT row_found THEN
    set_found := false;
    hash_valid := false;
    set_id := NULL;
    versioned_set_hash := NULL;
    legacy_prompt_set_hash := NULL;
    active_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;
  recomputed := command.fmic_ai_versioned_set_hash(rec.set_id);
  SELECT count(*)::integer INTO active_n
  FROM command.fmic_ai_prompt_set_members m
  JOIN command.fmic_ai_prompt_revisions r ON r.revision_id = m.revision_id
  WHERE m.set_id = rec.set_id AND r.active;
  set_found := true;
  hash_valid := rec.versioned_set_hash IS NOT NULL AND rec.versioned_set_hash = recomputed;
  set_id := rec.set_id;
  versioned_set_hash := rec.versioned_set_hash;
  legacy_prompt_set_hash := rec.legacy_prompt_set_hash;
  active_count := active_n;
  RETURN NEXT;
END
$function$


-- command.fmic_ai_versioned_set_hash(p_set_id uuid)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_ai_versioned_set_hash(p_set_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT md5(string_agg(
    r.prompt_key || '|' || r.revision_no::text || '|' || r.prompt_kind || '|'
      || r.analytical_intent || '|' || r.headline_denominator || '|'
      || CASE WHEN r.active THEN 'true' ELSE 'false' END || '|' || r.prompt_text,
    E'\n' ORDER BY r.prompt_key))
  FROM command.fmic_ai_prompt_set_members m
  JOIN command.fmic_ai_prompt_revisions r ON r.revision_id = m.revision_id
  WHERE m.set_id = p_set_id
$function$


-- command.fmic_capture_history()  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_capture_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  ignore_cols text[] := CASE WHEN TG_NARGS > 1 THEN TG_ARGV[1:TG_NARGS - 1] ELSE '{}'::text[] END;
  new_j jsonb := to_jsonb(NEW) - ignore_cols;
BEGIN
  IF TG_OP = 'UPDATE' AND new_j = (to_jsonb(OLD) - ignore_cols) THEN
    RETURN NEW;
  END IF;
  EXECUTE format('INSERT INTO command.%I (entity_key, row_hash, op, row_data) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', TG_TABLE_NAME || '_history')
    USING new_j ->> TG_ARGV[0], md5(new_j::text), TG_OP, new_j;
  RETURN NEW;
END $function$


-- command.fmic_enforce_channel_leakage()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.fmic_enforce_channel_leakage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.wmt_leakage := CASE WHEN NEW.map_price IS NOT NULL AND NEW.wmt_price IS NOT NULL THEN round(NEW.wmt_price - NEW.map_price, 2) END;
  NEW.mf_leakage  := CASE WHEN NEW.map_price IS NOT NULL AND NEW.mf_price  IS NOT NULL THEN round(NEW.mf_price  - NEW.map_price, 2) END;
  RETURN NEW;
END $function$


-- command.is_intofocus_admin()  kind=f  security_definer=t  config={"search_path=command, auth, public"}  owner=postgres
CREATE OR REPLACE FUNCTION command.is_intofocus_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'command', 'auth', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM command.organization_memberships m
    JOIN command.organizations o ON o.id = m.organization_id
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role = 'intofocus_admin'
      AND o.is_platform_org = true
  );
$function$


-- command.record_spec_findability_attempt(payload jsonb)  kind=f  security_definer=t  config={"search_path=command, public"}  owner=postgres
CREATE OR REPLACE FUNCTION command.record_spec_findability_attempt(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'command', 'public'
AS $function$
DECLARE
  v_state text := payload->>'findability_state';
  v_key text := payload->>'attempt_key';
  v_asin text := payload->>'asin';
  v_url text := NULLIF(payload->>'canonical_url', '');
  v_confidence text := COALESCE(NULLIF(payload->>'match_confidence', ''), 'none');
  v_kind text := NULLIF(payload->>'product_kind', '');
  v_source text := NULLIF(payload->>'source_method', '');
  v_at timestamptz := COALESCE((payload->>'attempt_at')::timestamptz, now());
  v_success boolean;
  v_jsonld text := COALESCE(NULLIF(payload->>'jsonld_status', ''), 'not_checked');
  v_schema_profile text;
  v_fields_present jsonb;
  v_fields_missing jsonb;
  v_title text := NULLIF(payload->>'title', '');
  v_category text := NULLIF(payload->>'category', '');
  v_resolved text := NULLIF(payload->>'resolved_url', '');
  v_explanation text := payload->>'match_explanation';
  v_page_title text := payload->>'page_title';
  v_canonical_tag text := payload->>'canonical_tag';
  v_structured jsonb := payload->'structured_identifiers';
  v_http integer := NULLIF(payload->>'http_status', '')::integer;
  v_browser text := payload->>'browser_outcome';
  v_version text := payload->>'collector_version';
  v_error text := payload->>'last_error';
  v_hash text := payload->>'catalog_identity_hash';
  v_variant_sku text := NULLIF(payload->>'variant_sku', '');
  v_matched jsonb := COALESCE(payload->'matched_identifiers', '[]'::jsonb);
  v_conflicts jsonb := COALESCE(payload->'conflicting_identifiers', '[]'::jsonb);
  cur command.fmic_spec_findability_current%ROWTYPE;
  v_latest boolean;
  v_success_newer boolean;
  v_changed boolean := false;
BEGIN
  IF v_key IS NULL OR v_asin IS NULL OR v_state IS NULL OR COALESCE(v_version, '') = '' THEN
    RAISE EXCEPTION 'attempt_key, asin, findability_state, and collector_version are required';
  END IF;

  v_success := v_state IN ('exact_official_product', 'official_family_page');
  IF v_jsonld = 'not_checked' THEN
    v_schema_profile := NULL;
    v_fields_present := NULL;
    v_fields_missing := NULL;
  ELSE
    v_schema_profile := NULLIF(payload->>'schema_profile', '');
    v_fields_present := payload->'schema_fields_present';
    v_fields_missing := payload->'schema_fields_missing';
  END IF;

  INSERT INTO command.fmic_spec_findability_attempt (
    attempt_key, asin, findability_state, canonical_url, resolved_url, source_method,
    matched_identifiers, conflicting_identifiers, match_confidence, match_explanation,
    page_title, canonical_tag, structured_identifiers, http_status, browser_outcome,
    collector_version, last_error, attempt_at, product_kind, schema_profile,
    schema_fields_present, schema_fields_missing, catalog_identity_hash, variant_sku,
    jsonld_status
  ) VALUES (
    v_key, v_asin, v_state, v_url, v_resolved, v_source,
    v_matched, v_conflicts, v_confidence, v_explanation,
    v_page_title, v_canonical_tag, v_structured, v_http, v_browser,
    v_version, v_error, v_at, v_kind, v_schema_profile,
    v_fields_present, v_fields_missing, v_hash, v_variant_sku,
    v_jsonld
  )
  ON CONFLICT (attempt_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'applied', false,
      'current_changed', false,
      'attempt_key', v_key,
      'asin', v_asin,
      'findability_state', v_state
    );
  END IF;

  SELECT * INTO cur
  FROM command.fmic_spec_findability_current
  WHERE asin = v_asin
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO command.fmic_spec_findability_current (
      asin, title, category, findability_state, canonical_url, resolved_url, source_method,
      matched_identifiers, conflicting_identifiers, match_confidence, match_explanation,
      page_title, canonical_tag, structured_identifiers, http_status, browser_outcome,
      collector_version, last_error, attempt_at, product_kind, schema_profile,
      schema_fields_present, schema_fields_missing, catalog_identity_hash, variant_sku,
      attempt_key, jsonld_status,
      last_success_state, last_success_url, last_success_variant_sku, last_success_at,
      last_success_identity_hash, last_success_explanation, last_success_schema_profile,
      last_success_fields_present, last_success_fields_missing
    ) VALUES (
      v_asin, v_title, v_category, v_state,
      CASE WHEN v_success THEN v_url ELSE NULL END,
      v_resolved, v_source, v_matched, v_conflicts, v_confidence, v_explanation,
      v_page_title, v_canonical_tag, v_structured, v_http, v_browser,
      v_version, v_error, v_at, v_kind, v_schema_profile,
      v_fields_present, v_fields_missing, v_hash,
      CASE WHEN v_success THEN v_variant_sku ELSE NULL END,
      v_key, v_jsonld,
      CASE WHEN v_success THEN v_state ELSE NULL END,
      CASE WHEN v_success THEN v_url ELSE NULL END,
      CASE WHEN v_success THEN v_variant_sku ELSE NULL END,
      CASE WHEN v_success THEN v_at ELSE NULL END,
      CASE WHEN v_success THEN v_hash ELSE NULL END,
      CASE WHEN v_success THEN v_explanation ELSE NULL END,
      CASE WHEN v_success THEN v_schema_profile ELSE NULL END,
      CASE WHEN v_success THEN v_fields_present ELSE NULL END,
      CASE WHEN v_success THEN v_fields_missing ELSE NULL END
    );
    v_changed := true;
  ELSE
    v_latest := v_at > cur.attempt_at;
    v_success_newer := v_success AND (cur.last_success_at IS NULL OR v_at > cur.last_success_at);
    IF v_latest OR v_success_newer THEN
      UPDATE command.fmic_spec_findability_current SET
        title = CASE WHEN v_latest THEN COALESCE(v_title, title) ELSE title END,
        category = CASE WHEN v_latest THEN COALESCE(v_category, category) ELSE category END,
        findability_state = CASE WHEN v_latest THEN v_state ELSE findability_state END,
        canonical_url = CASE WHEN v_latest THEN CASE WHEN v_success THEN v_url ELSE NULL END ELSE canonical_url END,
        resolved_url = CASE WHEN v_latest THEN v_resolved ELSE resolved_url END,
        source_method = CASE WHEN v_latest THEN v_source ELSE source_method END,
        matched_identifiers = CASE WHEN v_latest THEN v_matched ELSE matched_identifiers END,
        conflicting_identifiers = CASE WHEN v_latest THEN v_conflicts ELSE conflicting_identifiers END,
        match_confidence = CASE WHEN v_latest THEN v_confidence ELSE match_confidence END,
        match_explanation = CASE WHEN v_latest THEN v_explanation ELSE match_explanation END,
        page_title = CASE WHEN v_latest THEN v_page_title ELSE page_title END,
        canonical_tag = CASE WHEN v_latest THEN v_canonical_tag ELSE canonical_tag END,
        structured_identifiers = CASE WHEN v_latest THEN v_structured ELSE structured_identifiers END,
        http_status = CASE WHEN v_latest THEN v_http ELSE http_status END,
        browser_outcome = CASE WHEN v_latest THEN v_browser ELSE browser_outcome END,
        collector_version = CASE WHEN v_latest THEN v_version ELSE collector_version END,
        last_error = CASE WHEN v_latest THEN v_error ELSE last_error END,
        attempt_at = CASE WHEN v_latest THEN v_at ELSE attempt_at END,
        product_kind = CASE WHEN v_latest THEN v_kind ELSE product_kind END,
        schema_profile = CASE WHEN v_latest THEN v_schema_profile ELSE schema_profile END,
        schema_fields_present = CASE WHEN v_latest THEN v_fields_present ELSE schema_fields_present END,
        schema_fields_missing = CASE WHEN v_latest THEN v_fields_missing ELSE schema_fields_missing END,
        catalog_identity_hash = CASE WHEN v_latest THEN v_hash ELSE catalog_identity_hash END,
        variant_sku = CASE WHEN v_latest THEN CASE WHEN v_success THEN v_variant_sku ELSE NULL END ELSE variant_sku END,
        attempt_key = CASE WHEN v_latest THEN v_key ELSE attempt_key END,
        jsonld_status = CASE WHEN v_latest THEN v_jsonld ELSE jsonld_status END,
        last_success_state = CASE WHEN v_success_newer THEN v_state ELSE last_success_state END,
        last_success_url = CASE WHEN v_success_newer THEN v_url ELSE last_success_url END,
        last_success_variant_sku = CASE WHEN v_success_newer THEN v_variant_sku ELSE last_success_variant_sku END,
        last_success_at = CASE WHEN v_success_newer THEN v_at ELSE last_success_at END,
        last_success_identity_hash = CASE WHEN v_success_newer THEN v_hash ELSE last_success_identity_hash END,
        last_success_explanation = CASE WHEN v_success_newer THEN v_explanation ELSE last_success_explanation END,
        last_success_schema_profile = CASE WHEN v_success_newer THEN v_schema_profile ELSE last_success_schema_profile END,
        last_success_fields_present = CASE WHEN v_success_newer THEN v_fields_present ELSE last_success_fields_present END,
        last_success_fields_missing = CASE WHEN v_success_newer THEN v_fields_missing ELSE last_success_fields_missing END
      WHERE asin = v_asin;
      v_changed := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'applied', true,
    'current_changed', v_changed,
    'attempt_key', v_key,
    'asin', v_asin,
    'findability_state', v_state
  );
END;
$function$


-- command.role_rank(r command.organization_role)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.role_rank(r command.organization_role)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE r
    WHEN 'org_viewer' THEN 1
    WHEN 'org_admin' THEN 2
    WHEN 'intofocus_admin' THEN 3
  END;
$function$


-- command.set_updated_at()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


-- command.update_fmic_timestamp()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.update_fmic_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$


-- command.user_has_org_role(p_organization_id uuid, p_min_role command.organization_role)  kind=f  security_definer=t  config={"search_path=command, auth, public"}  owner=postgres
CREATE OR REPLACE FUNCTION command.user_has_org_role(p_organization_id uuid, p_min_role command.organization_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'command', 'auth', 'public'
AS $function$
  SELECT command.is_intofocus_admin()
    OR EXISTS (
      SELECT 1
      FROM command.organization_memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = p_organization_id
        AND m.status = 'active'
        AND command.role_rank(m.role) >= command.role_rank(p_min_role)
    );
$function$


-- command.worker20_check(p_name text, p_passed boolean, p_detail text)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION command.worker20_check(p_name text, p_passed boolean, p_detail text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO command.worker20_prompt_versioning_checks (check_name, passed, detail)
  VALUES (p_name, coalesce(p_passed, false), left(coalesce(p_detail, ''), 500))
  ON CONFLICT (check_name) DO UPDATE SET passed = EXCLUDED.passed, detail = EXCLUDED.detail;
END
$function$


-- ledlenser.ai_prompt_set_hash()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION ledlenser.ai_prompt_set_hash()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT md5(string_agg(prompt_key || ':' || prompt_text, E'\n' ORDER BY prompt_key)) FROM ledlenser.ai_prompts WHERE active
$function$


-- ledlenser.ai_publish_run(p_run_id uuid)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION ledlenser.ai_publish_run(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE r ledlenser.audit_runs%ROWTYPE; n integer;
BEGIN
  SELECT * INTO r FROM ledlenser.audit_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'run % not found', p_run_id; END IF;
  IF r.is_published THEN RETURN; END IF;
  IF r.run_state IS NULL OR r.run_state NOT IN ('completed', 'partial') THEN
    RAISE EXCEPTION 'run % has run_state %, only completed or partial runs can be published', p_run_id, r.run_state;
  END IF;
  IF r.prompt_set_hash IS DISTINCT FROM ledlenser.ai_prompt_set_hash() THEN
    RAISE EXCEPTION 'run % prompt_set_hash does not match the active prompt set', p_run_id;
  END IF;
  SELECT count(*) INTO n FROM ledlenser.ai_simulations WHERE audit_run_id = p_run_id;
  IF r.expected_calls IS NULL OR r.attempted_calls IS DISTINCT FROM n OR n = 0 THEN
    RAISE EXCEPTION 'run % call counts do not reconcile (attempted %, rows %)', p_run_id, r.attempted_calls, n;
  END IF;
  UPDATE ledlenser.audit_runs SET is_published = true, published_at = now() WHERE id = p_run_id;
END $function$


-- ledlenser.block_published_edit()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION ledlenser.block_published_edit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE rid uuid;
BEGIN
  rid := CASE WHEN TG_OP = 'DELETE' THEN OLD.audit_run_id ELSE NEW.audit_run_id END;
  IF rid IS NOT NULL AND EXISTS (SELECT 1 FROM ledlenser.audit_runs WHERE id = rid AND is_published) THEN
    RAISE EXCEPTION 'run % is published and immutable', rid;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $function$


-- ledlenser.capture_history()  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION ledlenser.capture_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  ignore_cols text[] := CASE WHEN TG_NARGS > 1 THEN TG_ARGV[1:TG_NARGS - 1] ELSE '{}'::text[] END;
  new_j jsonb := to_jsonb(NEW) - ignore_cols;
BEGIN
  IF TG_OP = 'UPDATE' AND new_j = (to_jsonb(OLD) - ignore_cols) THEN
    RETURN NEW;
  END IF;
  EXECUTE format('INSERT INTO ledlenser.%I (entity_key, row_hash, op, row_data) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', TG_TABLE_NAME || '_history')
    USING new_j ->> TG_ARGV[0], md5(new_j::text), TG_OP, new_j;
  RETURN NEW;
END $function$


-- ledlenser.enforce_channel_leakage()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION ledlenser.enforce_channel_leakage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.wmt_leakage := CASE WHEN NEW.map_price IS NOT NULL AND NEW.wmt_price IS NOT NULL THEN round(NEW.wmt_price - NEW.map_price, 2) END;
  RETURN NEW;
END $function$


-- ledlenser.touch_updated_at()  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION ledlenser.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $function$


-- private.check_issue_input(p_client_key text, p_check_key text, p_entity_key text, p_name text, p_note text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION private.check_issue_input(p_client_key text, p_check_key text, p_entity_key text, p_name text, p_note text)
 RETURNS set_aside_checks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_check public.set_aside_checks;
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not exists (select 1 from public.set_aside_clients where client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  select * into v_check from public.set_aside_checks where check_key = p_check_key;
  if not found then
    raise exception 'Unknown check.' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;
  if (v_check.entity_type = 'asin' and v_key !~ '^[A-Z0-9]{10}$')
     or (v_check.entity_type = 'queue_item' and v_key !~ '^[a-z0-9-]{2,60}$')
     or (v_check.entity_type = 'url' and (v_key !~ '^https?://' or char_length(v_key) > 500)) then
    raise exception 'That item id does not fit this check.' using errcode = '22023';
  end if;
  return v_check;
end;
$function$


-- private.has_org_role(target_organization_id uuid, allowed_roles organization_role[])  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION private.has_org_role(target_organization_id uuid, allowed_roles organization_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from public.organization_memberships m where m.organization_id=target_organization_id and m.user_id=auth.uid() and m.status='active' and m.role=any(allowed_roles)); $function$


-- private.is_active_org_member(target_organization_id uuid)  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION private.is_active_org_member(target_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from public.organization_memberships m where m.organization_id=target_organization_id and m.user_id=auth.uid() and m.status='active'); $function$


-- private.write_set_aside_audit()  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION private.write_set_aside_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  org_id uuid;
  why text;
begin
  select c.organization_id into org_id
  from public.set_aside_clients c
  where c.client_key = new.client_key;

  if new.status = 'reopened' then
    why := 'reopened' || coalesce(': ' || new.reopen_note, '');
  elsif new.outcome = 'done' then
    why := 'done' || coalesce(': ' || new.note, '');
  else
    why := 'set aside: ' || new.reason_code || coalesce(' · ' || new.note, '');
  end if;

  insert into public.audit_log
    (organization_id, actor_user_id, entity_table, entity_id, action, previous_value, new_value, reason)
  values
    (org_id, auth.uid(), 'issue_set_asides', new.id, tg_op,
     case when tg_op = 'UPDATE' then to_jsonb(old) end,
     to_jsonb(new),
     why);
  return new;
end;
$function$


-- public.actuation_basis(p_client_key text)  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_basis(p_client_key text)
 RETURNS TABLE(factor text, in_place boolean, verified_on date, expires_on date, target_domain_count integer, cadence_per_30_days integer, target_count integer, items_in_window integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with known as (
    select s.client_key from public.set_aside_clients s where s.client_key = p_client_key
  ),
  programs as (
    select p.factor,
      (nullif(btrim(p.owner_name), '') is not null
        and nullif(btrim(p.evidence_url), '') is not null
        and p.verified_on is not null
        and p.expires_on > current_date) as ok,
      p.verified_on, p.expires_on, cardinality(p.target_domains) as domains,
      p.cadence_per_30_days, p.target_count
    from public.actuation_programs p
    where p.client_key = p_client_key
  ),
  items as (
    select i.factor, count(*)::integer as n
    from public.actuation_items i
    where i.client_key = p_client_key
      and i.posted_on > current_date - 90
      and i.posted_on <= current_date
    group by i.factor
  )
  select f.factor,
    case when f.factor in ('E2', 'E3') then coalesce(i.n, 0) > 0 else coalesce(p.ok, false) end,
    case when p.ok then p.verified_on end,
    case when p.ok then p.expires_on end,
    case when p.ok then p.domains end,
    case when p.ok then p.cadence_per_30_days end,
    case when p.ok then p.target_count end,
    case when f.factor in ('E2', 'E3') then coalesce(i.n, 0) end
  from known
  cross join (values (1, 'P1'), (2, 'P2'), (3, 'E2'), (4, 'E3')) as f(ord, factor)
  left join programs p on p.factor = f.factor
  left join items i on i.factor = f.factor
  order by f.ord;
$function$


-- public.actuation_expiry_reminder_candidates()  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_expiry_reminder_candidates()
 RETURNS TABLE(client_key text, factor text, owner_name text, expires_on date, sent_thresholds integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.client_key, p.factor, btrim(p.owner_name), p.expires_on,
    coalesce((select array_agg(s.threshold_days order by s.threshold_days)
       from public.actuation_expiry_reminders_sent s
       where s.client_key = p.client_key and s.factor = p.factor and s.expires_on = p.expires_on), '{}'::integer[])
  from public.actuation_programs p
  where nullif(btrim(p.owner_name), '') is not null
    and nullif(btrim(p.evidence_url), '') is not null
    and p.verified_on is not null
    and p.expires_on > current_date
  order by p.expires_on, p.client_key, p.factor;
$function$


-- public.actuation_expiry_reminder_claim(p_client_key text, p_factor text, p_expires_on date, p_threshold_days integer, p_days_left integer)  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_expiry_reminder_claim(p_client_key text, p_factor text, p_expires_on date, p_threshold_days integer, p_days_left integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.actuation_expiry_reminders_sent (client_key, factor, expires_on, threshold_days, days_left)
  values (p_client_key, p_factor, p_expires_on, p_threshold_days, p_days_left)
  on conflict do nothing;
  return found;
end;
$function$


-- public.actuation_expiry_reminder_release(p_client_key text, p_factor text, p_expires_on date, p_threshold_days integer)  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_expiry_reminder_release(p_client_key text, p_factor text, p_expires_on date, p_threshold_days integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.actuation_expiry_reminders_sent s
  where s.client_key = p_client_key and s.factor = p_factor and s.expires_on = p_expires_on
    and s.threshold_days = p_threshold_days and s.sent_at > now() - interval '1 hour';
$function$


-- public.actuation_item_remove(p_id uuid)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_item_remove(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can remove Actuation items.' using errcode = '42501';
  end if;
  delete from public.actuation_items where id = p_id;
end;
$function$


-- public.actuation_item_save(p_client_key text, p_factor text, p_url text, p_posted_on date, p_verified_on date, p_note text)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_item_save(p_client_key text, p_factor text, p_url text, p_posted_on date, p_verified_on date, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
declare
  v_name text;
  v_url text := btrim(p_url);
  v_domain text;
  v_id uuid;
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can log Actuation items.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.set_aside_clients s where s.client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  if p_posted_on is null or p_verified_on is null
     or p_posted_on > current_date or p_verified_on > current_date then
    raise exception 'Posted and verified dates are required and cannot be in the future.' using errcode = '22023';
  end if;
  v_domain := lower(regexp_replace(substring(v_url from '^[A-Za-z]+://([^/:?#]+)'), '^www\.', ''));
  select left(coalesce(nullif(btrim(p.display_name), ''), u.email, 'IntoFocus staff'), 80)
    into v_name
  from auth.users u
  left join command.user_profiles p on p.id = u.id
  where u.id = auth.uid();
  v_name := coalesce(v_name, 'IntoFocus staff');
  insert into public.actuation_items (
    client_key, factor, url, domain, posted_on, verified_on, verified_by_name, verified_by_user_id, note
  )
  values (
    p_client_key, p_factor, v_url, v_domain, p_posted_on, p_verified_on, v_name, auth.uid(),
    nullif(btrim(p_note), '')
  )
  on conflict (client_key, factor, url) do update
    set posted_on = excluded.posted_on,
        verified_on = excluded.verified_on,
        verified_by_name = excluded.verified_by_name,
        verified_by_user_id = excluded.verified_by_user_id,
        note = excluded.note,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$function$


-- public.actuation_items_for_staff(p_client_key text)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_items_for_staff(p_client_key text)
 RETURNS TABLE(id uuid, factor text, url text, domain text, posted_on date, verified_on date, verified_by_name text, note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
  select i.id, i.factor, i.url, i.domain, i.posted_on, i.verified_on, i.verified_by_name, i.note
  from public.actuation_items i
  where command.is_intofocus_admin()
    and i.client_key = p_client_key
  order by i.posted_on desc, i.domain;
$function$


-- public.actuation_lapse_reminder_candidates()  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_lapse_reminder_candidates()
 RETURNS TABLE(client_key text, factor text, posted_on date, lapses_on date, sent_thresholds integer[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select n.client_key, n.factor, n.posted_on, n.posted_on + 90,
    coalesce((select array_agg(s.threshold_days order by s.threshold_days)
       from public.actuation_expiry_reminders_sent s
       where s.client_key = n.client_key and s.factor = n.factor and s.expires_on = n.posted_on + 90), '{}'::integer[])
  from (select i.client_key, i.factor, max(i.posted_on) as posted_on
    from public.actuation_items i
    where i.factor in ('E2', 'E3') and i.verified_on is not null
      and i.posted_on > current_date - 90 and i.posted_on <= current_date
    group by i.client_key, i.factor) n
  order by n.posted_on, n.client_key, n.factor;
$function$


-- public.actuation_program_save(p_client_key text, p_factor text, p_owner_name text, p_target_domains text[], p_cadence_per_30_days integer, p_target_count integer, p_evidence_url text, p_verified_on date, p_note text)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_program_save(p_client_key text, p_factor text, p_owner_name text, p_target_domains text[], p_cadence_per_30_days integer, p_target_count integer, p_evidence_url text, p_verified_on date, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
declare
  v_name text;
  v_domains text[];
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can save Actuation records.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.set_aside_clients s where s.client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  if p_verified_on is not null and p_verified_on > current_date then
    raise exception 'The verification date cannot be in the future.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}')
    into v_domains
  from (
    select lower(regexp_replace(btrim(x), '^(https?://)?(www\.)?([^/]+).*$', '\3', 'i')) as d
    from unnest(coalesce(p_target_domains, '{}')) as x
  ) t
  where d ~ '^[a-z0-9.-]{1,253}$';
  select left(coalesce(nullif(btrim(p.display_name), ''), u.email, 'IntoFocus staff'), 80)
    into v_name
  from auth.users u
  left join command.user_profiles p on p.id = u.id
  where u.id = auth.uid();
  v_name := coalesce(v_name, 'IntoFocus staff');
  insert into public.actuation_programs (
    client_key, factor, owner_name, target_domains, cadence_per_30_days, target_count,
    evidence_url, verified_on, verified_by_name, verified_by_user_id, note,
    updated_by_name, updated_by_user_id
  )
  values (
    p_client_key,
    p_factor,
    nullif(btrim(p_owner_name), ''),
    v_domains,
    case when p_factor = 'P1' then p_cadence_per_30_days end,
    case when p_factor = 'P2' then p_target_count end,
    nullif(btrim(p_evidence_url), ''),
    p_verified_on,
    case when p_verified_on is not null then v_name end,
    case when p_verified_on is not null then auth.uid() end,
    nullif(btrim(p_note), ''),
    v_name,
    auth.uid()
  )
  on conflict (client_key, factor) do update
    set owner_name = excluded.owner_name,
        target_domains = excluded.target_domains,
        cadence_per_30_days = excluded.cadence_per_30_days,
        target_count = excluded.target_count,
        evidence_url = excluded.evidence_url,
        verified_on = excluded.verified_on,
        verified_by_name = case
          when excluded.verified_on is distinct from public.actuation_programs.verified_on
            then excluded.verified_by_name
          else public.actuation_programs.verified_by_name end,
        verified_by_user_id = case
          when excluded.verified_on is distinct from public.actuation_programs.verified_on
            then excluded.verified_by_user_id
          else public.actuation_programs.verified_by_user_id end,
        note = excluded.note,
        updated_by_name = excluded.updated_by_name,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now();
end;
$function$


-- public.actuation_programs_for_staff(p_client_key text)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.actuation_programs_for_staff(p_client_key text)
 RETURNS TABLE(factor text, owner_name text, target_domains text[], cadence_per_30_days integer, target_count integer, evidence_url text, verified_on date, expires_on date, verified_by_name text, note text, updated_by_name text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
  select p.factor, p.owner_name, p.target_domains, p.cadence_per_30_days, p.target_count,
    p.evidence_url, p.verified_on, p.expires_on, p.verified_by_name, p.note, p.updated_by_name,
    p.updated_at
  from public.actuation_programs p
  where command.is_intofocus_admin()
    and p.client_key = p_client_key
  order by p.factor;
$function$


-- public.ai_prompt_edits_list(p_prompt_key text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.ai_prompt_edits_list(p_prompt_key text)
 RETURNS TABLE(id uuid, edited_at timestamp with time zone, action text, prompt_key text, before jsonb, after jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT e.id, e.edited_at, e.action, e.prompt_key, e.before, e.after
  FROM command.fmic_ai_prompt_edits e
  WHERE p_prompt_key IS NULL OR e.prompt_key = p_prompt_key
  ORDER BY e.edited_at DESC, e.id DESC;
$function$


-- public.ai_prompt_save(p_prompt_key text, p_prompt_text text, p_category text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
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
END $function$


-- public.ai_prompt_set_active(p_prompt_key text, p_active boolean)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
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
END $function$


-- public.ai_prompts_list()  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.ai_prompts_list()
 RETURNS TABLE(prompt_key text, prompt_text text, category text, prompt_kind text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.prompt_key, p.prompt_text, p.category::text, p.prompt_kind, p.active, p.created_at, p.updated_at
  FROM command.fmic_ai_prompts p
  ORDER BY p.prompt_key;
$function$


-- public.ai_prompts_status()  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.ai_prompts_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$


-- public.canvas_ai_history_run_rows(p_run_id uuid)  kind=f  security_definer=f  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.canvas_ai_history_run_rows(p_run_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT json_build_object(
    'runs', COALESCE((SELECT json_agg(r) FROM (SELECT audit_run_id, run_kind, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls, answered_calls, error_calls, is_published, published_at, started_at, completed_at, missing_calls FROM public.canvas_ai_history_runs WHERE audit_run_id = p_run_id) r), '[]'::json),
    'calls', COALESCE((SELECT json_agg(c ORDER BY c.sim_id, c.id) FROM (SELECT id, audit_run_id, sim_id, engine, model, category, prompt, prompt_key, prompt_kind, call_status, outcome, primary_brand, material_hallucination, hallucination_evidence, root_cause, remediation_patch, error_message, attempt_no, repeat_no, created_at FROM public.canvas_ai_history_calls WHERE audit_run_id = p_run_id) c), '[]'::json),
    'probes', COALESCE((SELECT json_agg(p ORDER BY p.sim_id) FROM (SELECT audit_run_id, sim_id, prompt_key, prompt, engine, model, call_status, material_hallucination, hallucination_evidence, verified_claim, verified_source_url, verified_at, created_at, probe_asin, probe_asins, probe_fender_sku, probe_category, probe_series, probe_spec_field, probe_expected_value, probe_source_url, probe_amazon_value, probe_is_anchor FROM public.canvas_ai_history_probes WHERE audit_run_id = p_run_id) p), '[]'::json),
    'citations', COALESCE((SELECT json_agg(ci ORDER BY ci.sim_id, ci."position") FROM (SELECT audit_run_id, sim_id, simulation_id, prompt_key, prompt_kind, category, engine, "position", url, domain, title FROM public.canvas_ai_history_citations_by_run WHERE audit_run_id = p_run_id) ci), '[]'::json));
$function$


-- public.canvas_score_snapshot_save(p_client_key text, p_week_start date, p_consensus numeric, p_foundation numeric, p_commerce numeric, p_actuation numeric, p_inputs jsonb)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.canvas_score_snapshot_save(p_client_key text, p_week_start date, p_consensus numeric, p_foundation numeric, p_commerce numeric, p_actuation numeric, p_inputs jsonb)
 RETURNS canvas_score_snapshots
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved public.canvas_score_snapshots;
begin
  insert into public.canvas_score_snapshots as s (client_key, week_start, saved_at, consensus_score, foundation_score, commerce_score, actuation_score, inputs)
  values (p_client_key, p_week_start, now(), p_consensus, p_foundation, p_commerce, p_actuation, coalesce(p_inputs, '{}'::jsonb))
  on conflict (client_key, week_start) do update set saved_at = excluded.saved_at, consensus_score = excluded.consensus_score, foundation_score = excluded.foundation_score, commerce_score = excluded.commerce_score, actuation_score = excluded.actuation_score, inputs = excluded.inputs
  returning s.* into saved;
  return saved;
end; $function$


-- public.mark_issue_done(p_client_key text, p_check_key text, p_entity_key text, p_name text, p_note text, p_entity_label text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.mark_issue_done(p_client_key text, p_check_key text, p_entity_key text, p_name text, p_note text DEFAULT NULL::text, p_entity_label text DEFAULT NULL::text)
 RETURNS issue_set_asides
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_check public.set_aside_checks;
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_label text := nullif(left(btrim(coalesce(p_entity_label, '')), 300), '');
  v_row public.issue_set_asides;
begin
  v_check := private.check_issue_input(p_client_key, p_check_key, v_key, v_name, v_note);

  insert into public.issue_set_asides as s
    (client_key, check_key, entity_type, entity_key, entity_label, status, outcome,
     reason_code, note, set_by_name, set_by_user_id, set_at)
  values
    (p_client_key, p_check_key, v_check.entity_type, v_key, v_label, 'active', 'done',
     null, v_note, v_name, auth.uid(), now())
  on conflict (client_key, check_key, entity_key) do update
    set status = 'active',
        outcome = 'done',
        entity_label = coalesce(excluded.entity_label, s.entity_label),
        reason_code = null,
        note = excluded.note,
        set_by_name = excluded.set_by_name,
        set_by_user_id = excluded.set_by_user_id,
        set_at = excluded.set_at,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$


-- public.reopen_set_aside(p_id uuid, p_name text, p_note text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.reopen_set_aside(p_id uuid, p_name text, p_note text DEFAULT NULL::text)
 RETURNS issue_set_asides
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_row public.issue_set_asides;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;

  update public.issue_set_asides
     set status = 'reopened',
         reopened_by_name = v_name,
         reopened_by_user_id = auth.uid(),
         reopened_at = now(),
         reopen_note = v_note,
         updated_at = now()
   where id = p_id and status = 'active'
  returning * into v_row;

  if not found then
    raise exception 'That item is not done or set aside.' using errcode = '22023';
  end if;
  return v_row;
end;
$function$


-- public.set_aside_issue(p_client_key text, p_check_key text, p_entity_key text, p_reason_code text, p_name text, p_note text, p_entity_label text)  kind=f  security_definer=t  config={"search_path=\"\""}  owner=postgres
CREATE OR REPLACE FUNCTION public.set_aside_issue(p_client_key text, p_check_key text, p_entity_key text, p_reason_code text, p_name text, p_note text DEFAULT NULL::text, p_entity_label text DEFAULT NULL::text)
 RETURNS issue_set_asides
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_check public.set_aside_checks;
  v_reason public.set_aside_reasons;
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_label text := nullif(left(btrim(coalesce(p_entity_label, '')), 300), '');
  v_row public.issue_set_asides;
begin
  v_check := private.check_issue_input(p_client_key, p_check_key, v_key, v_name, v_note);

  select * into v_reason from public.set_aside_reasons
  where reason_code = p_reason_code and is_active;
  if not found or (v_reason.check_keys is not null and not (p_check_key = any (v_reason.check_keys))) then
    raise exception 'Pick a reason from the list.' using errcode = '22023';
  end if;
  if v_reason.requires_note and v_note is null then
    raise exception 'This reason needs a note.' using errcode = '22023';
  end if;

  insert into public.issue_set_asides as s
    (client_key, check_key, entity_type, entity_key, entity_label, status, outcome,
     reason_code, note, set_by_name, set_by_user_id, set_at)
  values
    (p_client_key, p_check_key, v_check.entity_type, v_key, v_label, 'active', 'set_aside',
     p_reason_code, v_note, v_name, auth.uid(), now())
  on conflict (client_key, check_key, entity_key) do update
    set status = 'active',
        outcome = 'set_aside',
        entity_label = coalesce(excluded.entity_label, s.entity_label),
        reason_code = excluded.reason_code,
        note = excluded.note,
        set_by_name = excluded.set_by_name,
        set_by_user_id = excluded.set_by_user_id,
        set_at = excluded.set_at,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$


-- public.set_module_key()  kind=f  security_definer=f  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.set_module_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.module_key is null or trim(new.module_key) = '' then
    new.module_key := 'MOD-' || lpad(nextval('public.module_key_seq')::text, 3, '0');
  end if;
  return new;
end;
$function$


-- public.set_updated_at()  kind=f  security_definer=f  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ begin new.updated_at=now(); return new; end; $function$


-- public.set_work_key()  kind=f  security_definer=f  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.set_work_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.work_key is null or trim(new.work_key) = '' then
    new.work_key := 'WORK-' || lpad(nextval('public.work_item_key_seq')::text, 3, '0');
  end if;
  return new;
end;
$function$


-- public.site_type_override(p_domain text, p_client_key text, p_site_type text, p_note text)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.site_type_override(p_domain text, p_client_key text, p_site_type text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
declare
  v_name text;
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can set a site type.' using errcode = '42501';
  end if;
  if p_client_key is not null
     and not exists (select 1 from public.set_aside_clients s where s.client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  select coalesce(nullif(btrim(p.display_name), ''), u.email) into v_name
  from auth.users u left join command.user_profiles p on p.id = u.id
  where u.id = auth.uid();
  insert into public.site_type_overrides (domain, client_key, site_type, set_by_name, set_by_user_id, note)
  values (lower(btrim(p_domain)), p_client_key, p_site_type, left(coalesce(v_name, 'IntoFocus staff'), 80), auth.uid(), nullif(btrim(p_note), ''))
  on conflict (domain, (coalesce(client_key, ''))) do update
    set site_type = excluded.site_type, set_by_name = excluded.set_by_name, set_by_user_id = excluded.set_by_user_id, set_at = now(), note = excluded.note;
end;
$function$


-- public.site_types_to_review(p_client_key text)  kind=f  security_definer=t  config={"search_path=public, command, auth"}  owner=postgres
CREATE OR REPLACE FUNCTION public.site_types_to_review(p_client_key text)
 RETURNS TABLE(domain text, site_type text, confidence numeric, reason text, model text, classified_at timestamp with time zone, is_global boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'command', 'auth'
AS $function$
  select v.domain, v.site_type, v.confidence, k.reason, v.model, v.classified_at, k.client_key is null
  from public.canvas_site_types v
  join lateral (
    select c.reason, c.client_key
    from public.site_type_classifications c
    where c.domain = v.domain and c.origin = 'ai' and (c.client_key = v.client_key or c.client_key is null)
    order by c.client_key nulls last
    limit 1
  ) k on true
  where command.is_intofocus_admin() and v.client_key = p_client_key and v.needs_review
  order by v.confidence, v.domain;
$function$


-- public.write_audit_log()  kind=f  security_definer=t  config={search_path=public}  owner=postgres
CREATE OR REPLACE FUNCTION public.write_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  row_org_id uuid;
  row_entity_id uuid;
begin
  if tg_table_name = 'organizations' then
    row_org_id := coalesce(new.id, old.id);
  else
    row_org_id := coalesce(new.organization_id, old.organization_id);
  end if;
  row_entity_id := coalesce(new.id, old.id);
  insert into public.audit_log (organization_id, actor_user_id, entity_table, entity_id, action, previous_value, new_value)
  values (row_org_id, auth.uid(), tg_table_name, row_entity_id, tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  return coalesce(new, old);
end;
$function$


-- sandbox.refresh_metric_values(p_client_id text)  kind=f  security_definer=f  config={search_path=pg_catalog}  owner=postgres
CREATE OR REPLACE FUNCTION sandbox.refresh_metric_values(p_client_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_r1 uuid;   -- latest catalog harvest run (offer status, bundles, categories)
  v_r2 uuid;   -- latest seller read run
  v_r3 uuid;   -- latest Featured Offer and benchmark run
  v_spec uuid; -- latest spec check run
  v_ai uuid;   -- latest AI battery run
  v_inserted integer := 0;
  v_n integer;
begin
  select reading_run_id into v_r1 from sandbox.reading_run
   where client_id = p_client_id and source = 'keepa_product' and workflow_name = 'fender_catalog_harvester'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_r2 from sandbox.reading_run
   where client_id = p_client_id and source = 'keepa_seller'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_r3 from sandbox.reading_run
   where client_id = p_client_id and source = 'keepa_product' and workflow_name = 'fender_omnichannel_audit_sync'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_spec from sandbox.reading_run
   where client_id = p_client_id and source = 'spec_check'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_ai from sandbox.reading_run
   where client_id = p_client_id and source = 'ai_battery'
   order by finished_at desc nulls last, started_at desc limit 1;

  delete from sandbox.metric_value where client_id = p_client_id;

  -- catalog_monitored: all listings, plus the active count as dimension offer_status = active
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':catalog_monitored', p_client_id, p_client_id || ':catalog_monitored', v_r1, v_now, null::text, null::text, count(*), null::integer, null::integer
    from sandbox.v_listing_current where client_id = p_client_id
  union all
  select p_client_id || ':catalog_monitored:offer_status=active', p_client_id, p_client_id || ':catalog_monitored', v_r1, v_now, 'offer_status', 'active', count(*) filter (where offer_status = 'active'), null::integer, null::integer
    from sandbox.v_listing_current where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- amazon_offer_share: Amazon Retail holds the Featured Offer / active listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':amazon_offer_share', p_client_id, p_client_id || ':amazon_offer_share', v_r2, v_now, null, null,
         round(100.0 * count(*) filter (where seller_class = 'amazon_retail') / nullif(count(*), 0), 2),
         count(*) filter (where seller_class = 'amazon_retail'), count(*)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- seller_mix: active listings per seller class (no seller row at all counts as not_read)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':seller_mix:seller_class=' || coalesce(seller_class, 'not_read'), p_client_id, p_client_id || ':seller_mix', v_r2, v_now, 'seller_class', coalesce(seller_class, 'not_read'), count(*), null, null
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active'
   group by coalesce(seller_class, 'not_read');
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- seller_read_coverage: active listings with a seller class other than not_read / active listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':seller_read_coverage', p_client_id, p_client_id || ':seller_read_coverage', v_r2, v_now, null, null,
         round(100.0 * count(*) filter (where seller_class in ('amazon_retail', 'third_party', 'no_offer')) / nullif(count(*), 0), 2),
         count(*) filter (where seller_class in ('amazon_retail', 'third_party', 'no_offer')), count(*)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- featured_offer_present: withheld = false over listings whose latest benchmark row read the flag
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':featured_offer_present', p_client_id, p_client_id || ':featured_offer_present', v_r3, v_now, null, null,
         count(*) filter (where featured_offer_withheld = false),
         count(*) filter (where featured_offer_withheld = false), count(*) filter (where featured_offer_withheld is not null)
    from sandbox.v_listing_current where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- featured_offer_suppressed: withheld and offer cents above benchmark cents; denominator = active listings with a benchmark
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':featured_offer_suppressed', p_client_id, p_client_id || ':featured_offer_suppressed', v_r3, v_now, null, null,
         count(*) filter (where suppressed),
         count(*) filter (where suppressed), count(*) filter (where competitive_external_price_cents is not null)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- price_gap_above_benchmark: dollars above the benchmark summed over the suppressed listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':price_gap_above_benchmark', p_client_id, p_client_id || ':price_gap_above_benchmark', v_r3, v_now, null, null,
         coalesce(sum((offer_price_cents - competitive_external_price_cents) / 100.0), 0), count(*), null
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active' and suppressed;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- channel_price_coverage: per channel, priced over checked, from the latest channel row per listing
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  with latest as (
    select distinct on (p.listing_id, p.channel) p.listing_id, p.channel, p.match_status, p.reading_run_id, p.read_at
      from sandbox.listing_channel_price p
     where p.client_id = p_client_id
     order by p.listing_id, p.channel, p.read_at desc, p.reading_run_id desc
  )
  select p_client_id || ':channel_price_coverage:channel=' || channel, p_client_id, p_client_id || ':channel_price_coverage',
         (array_agg(reading_run_id order by read_at desc))[1], v_now, 'channel', channel,
         count(*) filter (where match_status = 'priced'),
         count(*) filter (where match_status = 'priced'), count(*)
    from latest group by channel;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- bundle_share: bundles among active listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':bundle_share', p_client_id, p_client_id || ':bundle_share', v_r1, v_now, null, null,
         round(100.0 * count(*) filter (where is_bundle) / nullif(count(*), 0), 2),
         count(*) filter (where is_bundle), count(*)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- spec_fender_page_found: brand page found over listings checked (latest spec row per listing)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':spec_fender_page_found', p_client_id, p_client_id || ':spec_fender_page_found', v_spec, v_now, null, null,
         round(100.0 * count(*) filter (where brand_site_page_found) / nullif(count(*), 0), 2),
         count(*) filter (where brand_site_page_found), count(*)
    from sandbox.v_spec_current where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- spec_additional_property_missing: found pages without additionalProperty over found pages
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':spec_additional_property_missing', p_client_id, p_client_id || ':spec_additional_property_missing', v_spec, v_now, null, null,
         count(*) filter (where additional_property_present = false),
         count(*) filter (where additional_property_present = false), count(*)
    from sandbox.v_spec_current where client_id = p_client_id and brand_site_page_found;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- spec_amazon_completeness: average of found / expected over Amazon-checked listings (numerator and denominator are field totals)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':spec_amazon_completeness', p_client_id, p_client_id || ':spec_amazon_completeness', v_spec, v_now, null, null,
         round(avg(amazon_fields_found * 100.0 / amazon_fields_expected), 2),
         sum(amazon_fields_found), sum(amazon_fields_expected)
    from sandbox.v_spec_current where client_id = p_client_id and amazon_checked and amazon_fields_expected > 0;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_answer_share: client brand wins over resolved answers, all runs
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_answer_share', p_client_id, p_client_id || ':ai_answer_share', v_ai, v_now, null, null,
         round(100.0 * count(*) filter (where client_brand_won) / nullif(count(*), 0), 2),
         count(*) filter (where client_brand_won), count(*)
    from sandbox.v_ai_answer_detail where client_id = p_client_id and outcome = 'resolved';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_answer_share_by_category: per category (prompts naming a client product excluded; fewer than 10 resolved excluded),
  -- plus the top rival per category as dimension category_top_rival = '<category>:<brand>'
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  with r as (
    select category, winner_brand_name, client_brand_won
      from sandbox.v_ai_answer_detail
     where client_id = p_client_id and outcome = 'resolved' and not names_client_product
  ), c as (
    select category, count(*) as resolved, count(*) filter (where client_brand_won) as wins
      from r group by category having count(*) >= 10
  ), rival as (
    select distinct on (r.category) r.category, r.winner_brand_name, count(*) as rival_wins
      from r join c using (category)
     where not r.client_brand_won
     group by r.category, r.winner_brand_name
     order by r.category, count(*) desc, r.winner_brand_name
  )
  select p_client_id || ':ai_answer_share_by_category:category=' || c.category, p_client_id, p_client_id || ':ai_answer_share_by_category', v_ai, v_now, 'category', c.category,
         round(100.0 * c.wins / c.resolved, 2), c.wins, c.resolved
    from c
  union all
  select p_client_id || ':ai_answer_share_by_category:category_top_rival=' || rival.category || ':' || rival.winner_brand_name, p_client_id, p_client_id || ':ai_answer_share_by_category', v_ai, v_now, 'category_top_rival', rival.category || ':' || rival.winner_brand_name,
         round(100.0 * rival.rival_wins / c.resolved, 2), rival.rival_wins, c.resolved
    from rival join c using (category);
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_wrong_spec_flags: flagged answers (numerator) over all answers (denominator)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_wrong_spec_flags', p_client_id, p_client_id || ':ai_wrong_spec_flags', v_ai, v_now, null, null,
         count(*) filter (where wrong_spec_flag), count(*) filter (where wrong_spec_flag), count(*)
    from sandbox.v_ai_answer_detail where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_answer_share_by_engine: per stored engine (unknown excluded)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_answer_share_by_engine:engine=' || engine, p_client_id, p_client_id || ':ai_answer_share_by_engine', v_ai, v_now, 'engine', engine,
         round(100.0 * count(*) filter (where client_brand_won) / nullif(count(*), 0), 2),
         count(*) filter (where client_brand_won), count(*)
    from sandbox.v_ai_answer_detail where client_id = p_client_id and outcome = 'resolved' and engine <> 'unknown'
   group by engine;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_battery_freshness and reading_freshness: epoch seconds of the latest finished_at per source
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_battery_freshness:source=' || f.source, p_client_id, p_client_id || ':ai_battery_freshness', f.reading_run_id, v_now, 'source', f.source,
         extract(epoch from f.finished_at), null::integer, null::integer
    from sandbox.v_reading_freshness f where f.client_id = p_client_id and f.source = 'ai_battery' and f.finished_at is not null
  union all
  select p_client_id || ':reading_freshness:source=' || f.source, p_client_id, p_client_id || ':reading_freshness', f.reading_run_id, v_now, 'source', f.source,
         extract(epoch from f.finished_at), null::integer, null::integer
    from sandbox.v_reading_freshness f where f.client_id = p_client_id and f.finished_at is not null;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- action_items_open: stored actions not done (no reading run behind it)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':action_items_open', p_client_id, p_client_id || ':action_items_open', null, v_now, null, null,
         count(*) filter (where status <> 'done'), count(*) filter (where status <> 'done'), count(*)
    from sandbox.action_item where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- catalog_by_category: listings per retailer category
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':catalog_by_category:category=' || coalesce(category, 'uncategorized'), p_client_id, p_client_id || ':catalog_by_category', v_r1, v_now, 'category', coalesce(category, 'uncategorized'), count(*), null, null
    from sandbox.v_listing_current where client_id = p_client_id
   group by coalesce(category, 'uncategorized');
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  return v_inserted;
end;
$function$


-- sandbox.reload_readings(p_client_id text)  kind=f  security_definer=f  config={"search_path=pg_catalog, public"}  owner=postgres
CREATE OR REPLACE FUNCTION sandbox.reload_readings(p_client_id text DEFAULT 'cl_fender'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_as_of timestamptz := now();
  v_stamp text := to_char(now() at time zone 'UTC', 'YYYYMMDD"T"HH24MI');
  v_metrics integer;
begin
  if p_client_id <> 'cl_fender' then
    raise exception 'reload_readings maps the Fender command.fmic_* tables only; got client %', p_client_id;
  end if;

  -- 1. clear derived rows (children first)
  delete from sandbox.metric_value where client_id = p_client_id;
  delete from sandbox.ai_answer where client_id = p_client_id;
  delete from sandbox.ai_prompt where client_id = p_client_id;
  delete from sandbox.spec_reading where client_id = p_client_id;
  delete from sandbox.listing_channel_price where client_id = p_client_id;
  delete from sandbox.listing_offer_reading where client_id = p_client_id;
  delete from sandbox.reading_run where client_id = p_client_id;

  -- 2. seller (upsert)
  insert into sandbox.seller (seller_id, marketplace, seller_name, is_amazon_retail, ships_with_amazon, rating_pct, rating_count, first_seen_at, updated_at)
  select s.seller_id, 'amazon', s.seller_name, coalesce(s.is_amazon, false), s.is_fba, s.rating_pct, s.rating_count, s.first_seen, s.updated_at
  from command.fmic_sellers s
  union all
  select distinct c.buybox_seller, 'amazon', null::text, (c.buybox_seller = 'ATVPDKIKX0DER'), null::boolean, null::integer, null::integer, null::timestamptz, null::timestamptz
  from command.fmic_electric_catalog c
  where c.buybox_seller is not null
    and not exists (select 1 from command.fmic_sellers s where s.seller_id = c.buybox_seller)
  on conflict (seller_id) do update set
    seller_name = coalesce(excluded.seller_name, sandbox.seller.seller_name),
    is_amazon_retail = excluded.is_amazon_retail,
    ships_with_amazon = coalesce(excluded.ships_with_amazon, sandbox.seller.ships_with_amazon),
    rating_pct = coalesce(excluded.rating_pct, sandbox.seller.rating_pct),
    rating_count = coalesce(excluded.rating_count, sandbox.seller.rating_count),
    updated_at = coalesce(excluded.updated_at, sandbox.seller.updated_at);

  -- 3. listing (upsert; parent link set in a second pass so a new parent row exists first)
  insert into sandbox.listing (listing_id, client_id, retailer, asin, parent_listing_id, parent_asin, title, brand, manufacturer, model_number, upc, ean, color, category, is_bundle, bundle_name, url, amazon_list_price, first_seen_at, last_harvested_at, updated_at)
  select 'lst_' || c.asin, p_client_id, 'amazon', c.asin, null, c.parent_asin, c.title, c.brand, c.manufacturer, c.model_number, c.upc, c.ean, c.color, c.category,
         coalesce(c.is_bundle, false), m.bundle_name, c.product_url, c.list_price, c.created_at, c.extracted_at, c.updated_at
  from command.fmic_electric_catalog c
  left join command.fmic_retail_buybox_map m on m.asin = c.asin
  on conflict (listing_id) do update set
    parent_asin = excluded.parent_asin, title = excluded.title, brand = excluded.brand, manufacturer = excluded.manufacturer,
    model_number = excluded.model_number, upc = excluded.upc, ean = excluded.ean, color = excluded.color, category = excluded.category,
    is_bundle = excluded.is_bundle, bundle_name = excluded.bundle_name, url = excluded.url, amazon_list_price = excluded.amazon_list_price,
    last_harvested_at = excluded.last_harvested_at, updated_at = excluded.updated_at;

  update sandbox.listing l
     set parent_listing_id = case when exists (select 1 from sandbox.listing p where p.listing_id = 'lst_' || l.parent_asin) then 'lst_' || l.parent_asin end
   where l.client_id = p_client_id
     and l.parent_listing_id is distinct from case when exists (select 1 from sandbox.listing p where p.listing_id = 'lst_' || l.parent_asin) then 'lst_' || l.parent_asin end;

  -- 4. reading runs (fixed ids R1 to R6 as in 0003; workflow_execution_id carries the reload stamp; trigger scheduled)
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000001', p_client_id, 'keepa_product', 'fender_catalog_harvester', 'reload_keepa_product_' || v_stamp, 'backfill',
         min(c.created_at), max(c.updated_at), 'complete', count(*), count(*), 'catalog_harvester',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_electric_catalog',
                            'population', count(*), 'rows_read', count(*),
                            'active_listings', count(*) filter (where c.current_price is not null),
                            'source_max_write', max(c.updated_at))
  from command.fmic_electric_catalog c;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000002', p_client_id, 'keepa_seller', 'fender_buybox_seller_harvester', 'reload_keepa_seller_' || v_stamp, 'backfill',
         coalesce(min(c.buybox_checked_at) filter (where c.current_price is not null), min(c.created_at)), max(c.buybox_checked_at),
         case when count(*) filter (where c.current_price is not null and c.buybox_seller is null) = 0 then 'complete' else 'partial' end,
         count(*) filter (where c.current_price is not null),
         count(*) filter (where c.current_price is not null and c.buybox_seller is not null),
         'buybox_seller_harvester',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_electric_catalog',
                            'population', count(*) filter (where c.current_price is not null),
                            'rows_read', count(*) filter (where c.current_price is not null and c.buybox_seller is not null),
                            'not_read', count(*) filter (where c.current_price is not null and c.buybox_seller is null),
                            'source_max_write', max(c.buybox_checked_at))
  from command.fmic_electric_catalog c;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, findings_count, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000003', p_client_id, 'keepa_product', 'fender_omnichannel_audit_sync', 'reload_keepa_product_benchmark_' || v_stamp, 'backfill',
         (select min(created_at) from command.fmic_retail_buybox_map),
         k.finished_at, 'partial',
         (select count(*) from command.fmic_electric_catalog where current_price is not null),
         (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price is not null and m.competitive_price_threshold_cents > 0),
         (select count(*) from command.fmic_retail_buybox_map m where m.featured_offer_withheld and m.competitive_price_threshold_cents > 0 and round(m.offer_price * 100) > m.competitive_price_threshold_cents),
         k.audit_run_id::text,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_retail_buybox_map',
                            'population', (select count(*) from command.fmic_electric_catalog where current_price is not null),
                            'rows_read', (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price is not null and m.competitive_price_threshold_cents > 0),
                            'map_rows', (select count(*) from command.fmic_retail_buybox_map),
                            'withheld_read', (select count(*) from command.fmic_retail_buybox_map where featured_offer_withheld is not null),
                            'benchmark_rows', (select count(*) from command.fmic_retail_buybox_map where competitive_price_threshold_cents > 0),
                            'latest_audit_run_id', k.audit_run_id,
                            'source_max_write', (select max(updated_at) from command.fmic_retail_buybox_map))
  from (select audit_run_id, created_at as finished_at from command.fmic_brand_kpi_summary order by created_at desc limit 1) k;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, cursor_end, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000004', p_client_id, 'walmart_price', 'fender_retail_buybox_map_audit', 'reload_walmart_price_' || v_stamp, 'backfill',
         coalesce(min(m.wmt_checked_at), min(m.created_at)), j.last_run_at,
         case when count(*) filter (where m.wmt_checked_at is null) = 0 then 'complete' else 'partial' end,
         count(*), count(*) filter (where m.wmt_checked_at is not null), j.cursor_offset, 'map_leakage_walmart',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_retail_buybox_map',
                            'population', count(*), 'rows_read', count(*) filter (where m.wmt_checked_at is not null),
                            'priced', count(*) filter (where m.wmt_price > 0),
                            'job_state_extra', j.extra, 'source_max_write', max(m.wmt_checked_at))
  from command.fmic_retail_buybox_map m
  cross join (select last_run_at, cursor_offset, extra from command.fmic_job_state where job_key = 'map_leakage_walmart') j
  group by j.last_run_at, j.cursor_offset, j.extra;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, cursor_end, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000005', p_client_id, 'musiciansfriend_price', 'fender_map_checker_musiciansfriend', 'reload_musiciansfriend_price_' || v_stamp, 'backfill',
         coalesce((select min(mf_checked_at) from command.fmic_retail_buybox_map), (select min(created_at) from command.fmic_retail_buybox_map)),
         j.last_run_at, 'partial',
         (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price >= 100 and not coalesce(c.is_bundle, false)),
         (select count(*) from command.fmic_retail_buybox_map where mf_checked_at is not null),
         j.cursor_offset, 'map_parity_musiciansfriend',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_retail_buybox_map',
                            'population', (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price >= 100 and not coalesce(c.is_bundle, false)),
                            'population_rule', 'map rows joined to catalog with current_price >= 100 and not bundle',
                            'rows_read', (select count(*) from command.fmic_retail_buybox_map where mf_checked_at is not null),
                            'priced', (select count(*) from command.fmic_retail_buybox_map where mf_price > 0),
                            'job_state_extra', j.extra, 'source_max_write', (select max(mf_checked_at) from command.fmic_retail_buybox_map))
  from (select last_run_at, cursor_offset, extra from command.fmic_job_state where job_key = 'map_parity_musiciansfriend') j;

  -- R6: population rule from the 2026-10-13 refresh (distinct SKUs the audit has checked); the 0003 rule
  -- (catalog rows with a seller) understated it once the audit checked more SKUs than that.
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, cursor_end, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000006', p_client_id, 'spec_check', 'fender_spec_readiness_audit', 'reload_spec_check_' || v_stamp, 'backfill',
         (select min(coalesce(checked_at, created_at)) from command.fmic_spec_readiness),
         (select max(checked_at) from command.fmic_spec_readiness), 'complete',
         x.n, x.n, j.cursor_offset,
         (select batch_run_id from command.fmic_spec_readiness order by checked_at desc nulls last limit 1),
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_spec_readiness',
                            'population', x.n,
                            'population_rule', 'distinct catalog SKUs the spec audit has checked',
                            'rows_read', x.n,
                            'source_rows', (select count(*) from command.fmic_spec_readiness),
                            'source_rows_skipped_not_in_catalog', (select count(*) from command.fmic_spec_readiness s where not exists (select 1 from command.fmic_electric_catalog c where c.asin = s.asin)),
                            'job_state_extra', j.extra, 'source_max_write', (select max(checked_at) from command.fmic_spec_readiness))
  from (select count(distinct s.asin) as n from command.fmic_spec_readiness s where exists (select 1 from command.fmic_electric_catalog c where c.asin = s.asin)) x
  cross join (select cursor_offset, extra from command.fmic_job_state where job_key = 'spec_readiness') j;

  -- AI battery runs: original audit run uuids
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, findings_count, legacy_run_key, detail)
  select r.id, p_client_id, 'ai_battery', coalesce(r.metadata->>'source', 'fender_ai_simulation_battery_real'),
         coalesce(r.workflow_execution_id, 'legacy_audit_run_' || r.id::text), 'manual',
         r.started_at, r.completed_at, 'complete', coalesce(s.n, 0), coalesce(s.n, 0), s.flags, r.id::text,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_audit_runs',
                            'legacy_trigger_type', r.trigger_type, 'legacy_status', r.status,
                            'asins_audited', r.asins_audited, 'violations_detected', r.violations_detected,
                            'answers', coalesce(s.n, 0), 'workflow_execution_id_was_null', (r.workflow_execution_id is null),
                            'metadata', r.metadata)
  from command.fmic_audit_runs r
  left join (select audit_run_id, count(*) as n, count(*) filter (where hallucination_flag) as flags from canvas_private.sims_all group by audit_run_id) s on s.audit_run_id = r.id
  where r.metadata->>'source' = 'fender_ai_simulation_battery_real' or s.n is not null;

  -- R7: answers whose audit_run_id has no fmic_audit_runs row (only when such rows exist)
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000007', p_client_id, 'ai_battery', 'fender_ai_simulation_battery_real', 'reload_ai_battery_' || v_stamp, 'backfill',
         min(s.created_at), max(s.created_at), 'partial', count(*), count(*), null,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'canvas_private.sims_all',
                            'population', count(*), 'rows_read', count(*), 'note', 'answers whose audit_run_id has no fmic_audit_runs row')
  from canvas_private.sims_all s
  where not exists (select 1 from command.fmic_audit_runs r where r.id = s.audit_run_id)
  having count(*) > 0;

  -- R8 / R9: legacy command.listing_channel_price rows (only when rows exist)
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select case l.channel when 'sweetwater' then 'a0000000-0000-4000-8000-000000000008'::uuid else 'a0000000-0000-4000-8000-000000000009'::uuid end,
         p_client_id, l.channel || '_price', 'legacy_listing_channel_price', 'reload_' || l.channel || '_price_' || v_stamp, 'backfill',
         min(l.checked_at), max(l.checked_at), 'partial', count(*), count(*), null,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.listing_channel_price', 'population', count(*), 'rows_read', count(*))
  from command.listing_channel_price l
  where l.channel in ('sweetwater', 'reverb')
  group by l.channel
  having count(*) > 0;

  -- 5. listing_offer_reading (R1, R2, R3)
  insert into sandbox.listing_offer_reading (listing_offer_reading_id, client_id, listing_id, reading_run_id, read_at, offer_status, listed_price, sales_rank, monthly_sold, offer_count_new, amazon_stock)
  select 'lor_' || c.asin || '_r1', p_client_id, 'lst_' || c.asin, 'a0000000-0000-4000-8000-000000000001',
         coalesce(c.extracted_at, c.updated_at),
         case when c.current_price is not null then 'active' else 'no_active_offer' end,
         c.current_price, c.sales_rank, c.monthly_sold, c.offer_count_new, c.amazon_stock
  from command.fmic_electric_catalog c;

  insert into sandbox.listing_offer_reading (listing_offer_reading_id, client_id, listing_id, reading_run_id, read_at, offer_status, featured_offer_seller_id, seller_class, seller_ships_with_amazon)
  select 'lor_' || c.asin || '_r2', p_client_id, 'lst_' || c.asin, 'a0000000-0000-4000-8000-000000000002',
         coalesce(c.buybox_checked_at, r.finished_at, v_as_of), 'active',
         c.buybox_seller,
         case when c.buybox_seller = 'ATVPDKIKX0DER' then 'amazon_retail'
              when c.buybox_seller is not null then 'third_party'
              else 'not_read' end,
         c.buybox_is_fba
  from command.fmic_electric_catalog c
  cross join (select finished_at from sandbox.reading_run where reading_run_id = 'a0000000-0000-4000-8000-000000000002') r
  where c.current_price is not null;

  -- R3 rows: only map rows whose listing exists (a map row for an ASIN outside the catalog is skipped)
  insert into sandbox.listing_offer_reading (listing_offer_reading_id, client_id, listing_id, reading_run_id, read_at, offer_status, featured_offer_withheld, offer_price, competitive_external_price_cents, legacy_status)
  select 'lor_' || m.asin || '_r3', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000003',
         m.updated_at,
         case when m.buybox_status = 'No Active Offer' then 'no_active_offer' else 'active' end,
         m.featured_offer_withheld, m.offer_price,
         case when m.competitive_price_threshold_cents > 0 then m.competitive_price_threshold_cents end,
         m.buybox_status
  from command.fmic_retail_buybox_map m
  where exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || m.asin);

  -- 6. listing_channel_price
  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at, store_title, store_seller_name, match_confidence)
  select 'lcp_' || m.asin || '_walmart', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000004',
         m.wmt_checked_at, 'walmart',
         case when m.wmt_price > 0 then 'priced' else 'no_match' end,
         case when m.wmt_price > 0 then m.wmt_price end,
         m.wmt_url, m.wmt_checked_at, m.wmt_title, m.wmt_seller, m.wmt_match_conf
  from command.fmic_retail_buybox_map m
  where m.wmt_checked_at is not null
    and exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || m.asin);

  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at, store_title, store_msrp)
  select 'lcp_' || m.asin || '_musiciansfriend', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000005',
         m.mf_checked_at, 'musiciansfriend',
         case when m.mf_price > 0 then 'priced' else 'no_match' end,
         case when m.mf_price > 0 then m.mf_price end,
         null, m.mf_checked_at, m.mf_title, m.mf_msrp
  from command.fmic_retail_buybox_map m
  where m.mf_checked_at is not null
    and exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || m.asin);

  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at, store_title, store_seller_name)
  select 'lcp_' || m.asin || '_amazon', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000003',
         m.updated_at, 'amazon', 'priced', m.offer_price, c.product_url, m.updated_at, c.title, s.seller_name
  from command.fmic_retail_buybox_map m
  join command.fmic_electric_catalog c on c.asin = m.asin
  left join command.fmic_sellers s on s.seller_id = c.buybox_seller
  where m.offer_price is not null;

  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at)
  select 'lcp_' || l.asin || '_' || l.channel || '_legacy', p_client_id, 'lst_' || l.asin, r.reading_run_id,
         l.checked_at, l.channel,
         case when l.price > 0 then 'priced' else 'no_match' end,
         case when l.price > 0 then l.price end,
         l.url, l.checked_at
  from command.listing_channel_price l
  join sandbox.listing li on li.listing_id = 'lst_' || l.asin
  join sandbox.reading_run r on r.client_id = p_client_id and r.reading_run_id = case l.channel
         when 'amazon' then 'a0000000-0000-4000-8000-000000000003'::uuid
         when 'walmart' then 'a0000000-0000-4000-8000-000000000004'::uuid
         when 'musiciansfriend' then 'a0000000-0000-4000-8000-000000000005'::uuid
         when 'sweetwater' then 'a0000000-0000-4000-8000-000000000008'::uuid
         when 'reverb' then 'a0000000-0000-4000-8000-000000000009'::uuid end
  where l.channel in ('amazon', 'walmart', 'musiciansfriend', 'sweetwater', 'reverb')
  on conflict on constraint listing_channel_price_listing_id_channel_reading_run_id_key do nothing;

  -- 7. spec_reading: every check whose asin is in the catalog (history kept under R6)
  insert into sandbox.spec_reading (spec_reading_id, client_id, listing_id, reading_run_id, read_at, amazon_checked, amazon_fields_found, amazon_fields_expected, amazon_missing_fields, brand_site_page_found, brand_site_url, brand_site_fields_found, brand_site_fields_expected, brand_site_missing_fields, additional_property_present)
  select 'spr_' || s.id, p_client_id, 'lst_' || s.asin, 'a0000000-0000-4000-8000-000000000006',
         coalesce(s.checked_at, s.created_at),
         coalesce(s.amazon_checked, false), s.amazon_fields_found, s.amazon_fields_expected,
         string_to_array(nullif(s.amazon_missing_fields, ''), ';'),
         coalesce(s.fender_found, false), s.fender_url, s.fender_fields_found, s.fender_fields_expected,
         string_to_array(nullif(s.fender_missing_fields, ''), ';'),
         case when s.fender_found then not (coalesce(s.fender_missing_fields, '') ilike '%additionalProperty%') else null end
  from command.fmic_spec_readiness s
  where exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || s.asin)
  on conflict on constraint spec_reading_listing_id_reading_run_id_read_at_key do nothing;

  -- 8. ai_prompt and ai_answer
  insert into sandbox.ai_prompt (ai_prompt_id, client_id, category, prompt_text, names_client_product, is_active, legacy_sim_id)
  select distinct on (d.ptext) 'pr_' || lpad(d.pidx::text, 2, '0'), p_client_id, d.category, d.ptext, (d.category = 'hallucinations'), true, d.pidx::text
  from (select distinct ((sim_id % 1000) - 1) / 10 as pidx, category,
               regexp_replace(prompt, '\s*\[(chatgpt|perplexity|gemini)\]$', '') as ptext
        from canvas_private.sims_all) d
  order by d.ptext, d.pidx
  on conflict do nothing;

  insert into sandbox.ai_answer (ai_answer_id, client_id, ai_prompt_id, reading_run_id, read_at, answered_at, engine, repeat_no, outcome, winner_brand_id, wrong_spec_flag, wrong_spec_reason, answer_text, citations, citation_urls, remediation_note, legacy_source)
  select s.id::text, p_client_id,
         'pr_' || lpad((((s.sim_id % 1000) - 1) / 10)::text, 2, '0'),
         case when exists (select 1 from command.fmic_audit_runs r where r.id = s.audit_run_id) then s.audit_run_id
              else 'a0000000-0000-4000-8000-000000000007'::uuid end,
         s.created_at, s.created_at,
         coalesce(s.engine,
                  substring(s.prompt from '\[(chatgpt|perplexity|gemini)\]$'),
                  (array['chatgpt', 'perplexity', 'gemini'])[((s.sim_id % 1000) - 1) % 10 + 1],
                  'unknown'),
         coalesce(s.repeat_no, s.sim_id / 1000),
         case when s.winner is null or s.winner = 'Error' then 'error'
              when s.winner = 'Unclear' then 'unclear'
              else 'resolved' end,
         b.competitor_brand_id,
         coalesce(s.hallucination_flag, false), nullif(s.root_cause, ''),
         s.answer_text, l.citations,
         string_to_array(nullif(s.citation_urls, ''), ' | '),
         s.remediation_patch, s.source_table
  from canvas_private.sims_all s
  left join command.fmic_ai_simulations l on l.id = s.id and s.source_table = 'live'
  left join sandbox.competitor_brand b
         on b.client_id = p_client_id
        and s.winner is not null and s.winner not in ('Error', 'Unclear')
        and b.name = case when s.winner = 'Fender/Squier' then 'Fender' else s.winner end
  where exists (select 1 from sandbox.ai_prompt p where p.ai_prompt_id = 'pr_' || lpad((((s.sim_id % 1000) - 1) / 10)::text, 2, '0'));

  -- 9. action items (same generation rules as 0006)
  create temp table if not exists _reload_actions (like sandbox.action_item) on commit drop;
  truncate _reload_actions;
  insert into _reload_actions (action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at)
  select 'act_suppressed_' || v.asin, p_client_id, p_client_id || ':featured_offer_suppressed', v.benchmark_reading_id, v.listing_id,
         'Match the outside price or correct the outside listing for ' || v.asin, 'client', 'open', 'high', now(), now()
    from sandbox.v_listing_current v
   where v.client_id = p_client_id and v.offer_status = 'active' and v.suppressed
  union all
  select 'act_authorized_seller_list', p_client_id, p_client_id || ':retail_control_partner_led', null, null,
         'Supply the authorized-seller list', 'client', 'open', 'high', now(), now()
   where not exists (select 1 from sandbox.seller_authorization a where a.client_id = p_client_id)
  union all
  select 'act_map_sheet', p_client_id, p_client_id || ':map_below', null, null,
         'Supply the MAP sheet', 'client', 'open', 'medium', now(), now()
   where not exists (select 1 from sandbox.listing_map_price m where m.client_id = p_client_id)
  union all
  select 'act_additional_property', p_client_id, p_client_id || ':spec_additional_property_missing', null, null,
         'Add additionalProperty to ' || x.n || ' found fender.com pages', 'intofocus', 'open', 'medium', now(), now()
    from (select count(*) as n from sandbox.v_spec_current
           where client_id = p_client_id and brand_site_page_found and additional_property_present = false) x
   where x.n > 0
  union all
  select 'act_seller_read', p_client_id, p_client_id || ':seller_read_coverage', null, null,
         'Finish the seller read for ' || x.n || ' active offers', 'intofocus', 'open', 'medium', now(), now()
    from (select count(*) as n from sandbox.v_listing_current
           where client_id = p_client_id and offer_status = 'active' and coalesce(seller_class, 'not_read') = 'not_read') x
   where x.n > 0
  union all
  select 'act_phase1_inputs', p_client_id, p_client_id || ':estimate_phase1_uplift', null, null,
         'Supply the Phase 1 uplift inputs (COO)', 'intofocus', 'open', 'medium', now(), now()
   where not exists (select 1 from sandbox.estimate_input i where i.estimate_id = 'est_phase1')
  union all
  select 'act_enterprise_inputs', p_client_id, p_client_id || ':estimate_enterprise_range', null, null,
         'Supply the enterprise range inputs (COO)', 'intofocus', 'open', 'medium', now(), now()
   where not exists (select 1 from sandbox.estimate_input i where i.estimate_id = 'est_enterprise');

  -- generated rows whose finding is gone are closed (status done), as the 2026-10-13 refresh did; in_progress is left alone
  update sandbox.action_item a
     set status = 'done', updated_at = now()
   where a.client_id = p_client_id and a.status = 'open'
     and (a.action_item_id like 'act\_suppressed\_%' or a.action_item_id in
          ('act_authorized_seller_list', 'act_map_sheet', 'act_additional_property', 'act_seller_read', 'act_phase1_inputs', 'act_enterprise_inputs'))
     and not exists (select 1 from _reload_actions n where n.action_item_id = a.action_item_id);

  -- a finding that is back reopens its closed row (v2 has no write path for status, so every done row was closed here)
  insert into sandbox.action_item (action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at)
  select action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at
  from _reload_actions
  on conflict (action_item_id) do update set
    finding_ref = excluded.finding_ref, title = excluded.title,
    status = case when sandbox.action_item.status = 'done' then 'open' else sandbox.action_item.status end,
    updated_at = case when sandbox.action_item.title is distinct from excluded.title
                        or sandbox.action_item.finding_ref is distinct from excluded.finding_ref
                        or sandbox.action_item.status = 'done'
                      then now() else sandbox.action_item.updated_at end;

  -- 10. metric values (the action_item trigger already ran it; the explicit call is the documented entry point)
  v_metrics := sandbox.refresh_metric_values(p_client_id);

  return jsonb_build_object(
    'as_of', v_as_of,
    'listings', (select count(*) from sandbox.listing where client_id = p_client_id),
    'reading_runs', (select count(*) from sandbox.reading_run where client_id = p_client_id),
    'offer_readings', (select count(*) from sandbox.listing_offer_reading where client_id = p_client_id),
    'channel_prices', (select count(*) from sandbox.listing_channel_price where client_id = p_client_id),
    'spec_readings', (select count(*) from sandbox.spec_reading where client_id = p_client_id),
    'ai_answers', (select count(*) from sandbox.ai_answer where client_id = p_client_id),
    'open_actions', (select count(*) from sandbox.action_item where client_id = p_client_id and status <> 'done'),
    'metric_values', v_metrics);
end;
$function$


-- sandbox.tg_action_item_refresh()  kind=f  security_definer=f  config={search_path=pg_catalog}  owner=postgres
CREATE OR REPLACE FUNCTION sandbox.tg_action_item_refresh()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare c text;
begin
  for c in select client_id from sandbox.client loop
    perform sandbox.refresh_metric_values(c);
  end loop;
  return null;
end;
$function$

