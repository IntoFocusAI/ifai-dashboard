-- public.canvas_set_aside_reasons (view) — live definition snapshot, do not apply
--   reason_code: text
--   label: text
--   description: text
--   check_keys: text[]
--   requires_note: boolean
--   sort_order: integer
CREATE OR REPLACE VIEW public.canvas_set_aside_reasons AS
 SELECT reason_code,
    label,
    description,
    check_keys,
    requires_note,
    sort_order
   FROM set_aside_reasons
  WHERE is_active;
