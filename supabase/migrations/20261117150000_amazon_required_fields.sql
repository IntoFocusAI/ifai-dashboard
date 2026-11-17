-- D-05: Amazon required field lists in the database (decision 100, Brian Magazu, 16 Nov 2026).
--
-- What it changes
--   Adds one table and seeds it. Nothing existing is altered or deleted; no table, view, column,
--   or grant on an existing object changes.
--
--   public.amazon_required_fields
--     One row per Amazon product type and required field. One list per product type, shared by
--     every client (a flashlight is FLASHLIGHT for every brand), so the table is in public and
--     has no client column.
--       product_type        Amazon's product type as Keepa reports it (product_type_name), upper
--                           case: GUITARS, FLASHLIGHT. Matches canvas_amazon_product_types.product_type.
--       product_type_label  Plain name for client copy, lower case ("guitars").
--       field_id            The Amazon product-page field id the spec check stores.
--       alt_field_ids       Other field ids that count as this same field: the field is filled when
--                           field_id or any of these is filled (decision 100: white_brightness or
--                           light_output_maximum). Default '{}'.
--       label               Plain field name for client copy.
--       sample_filled       Competitor listings in the sample that fill the field.
--       sample_size         Competitor listings sampled for the product type.
--       source_date         Day the competitor pages were read.
--       decision            The approval this row rests on ('decision 100').
--       approved_at         Day IntoFocus staff approved the list.
--     Primary key (product_type, field_id). Most-filled first is
--     ORDER BY sample_filled DESC, field_id.
--
--   Seed: the lists approved in decision 100, exactly as in lib/findability/amazon-field-lists.ts
--   on PR 212 (worker 28.3): GUITARS 17 fields (sample 15), FLASHLIGHT 22 fields (sample 17,
--   white_brightness with light_output_maximum as one field), 39 rows. Evidence:
--   docs/d05-field-lists.md on that branch. scripts/amazon-required-fields-migration.test.ts
--   checks the seed against that list field for field.
--   ELECTRIC_LIGHT and ELECTRIC_LANTERN deliberately have no rows (decision 100). A product type
--   with no rows has no approved list, and its listings read "Not available*" for required fields.
--
--   RLS is on. anon and authenticated may SELECT (one select policy, using true) and nothing
--   else: every default grant is revoked first and SELECT granted back, as
--   20261116200000_canvas_score_snapshots does. Fender reads it through the public schema and
--   Ledlenser through getPublicCanvasSupabase(). Staff change the lists with owner access, as a
--   new migration.
--
--   Nothing reads the table yet. The dashboard keeps the lists in amazon-field-lists.ts and the
--   spec views are unchanged until the Toolbelt spec-check wrenches store every listed field.
--
-- How to undo
--   DROP TABLE public.amazon_required_fields;
--   NOTIFY pgrst, 'reload schema';
--   Nothing reads it, so nothing on screen changes. Dropping it deletes the seeded lists (they
--   are also in this file and in amazon-field-lists.ts).
--
-- Production only: the copies (sandbox, mirror, claude) do not need it; the dashboard reads
-- production.
--
-- Status: NOT APPLIED. Additive; Brian Magazu approves, then an agent applies it, and the pull
-- request records when it is applied and by whom.

begin;

create table if not exists public.amazon_required_fields (
  product_type text not null check (product_type ~ '^[A-Z0-9_]{2,80}$'),
  product_type_label text not null check (char_length(product_type_label) between 1 and 80),
  field_id text not null check (field_id ~ '^[a-z0-9_]{1,80}$'),
  alt_field_ids text[] not null default '{}'
    check (cardinality(alt_field_ids) <= 10 and not (field_id = any (alt_field_ids))),
  label text not null check (char_length(label) between 1 and 80),
  sample_filled integer not null check (sample_filled >= 0),
  sample_size integer not null check (sample_size > 0),
  source_date date not null,
  decision text not null check (char_length(decision) between 1 and 80),
  approved_at date not null,
  primary key (product_type, field_id),
  check (sample_filled <= sample_size)
);

comment on table public.amazon_required_fields is
  'Amazon required spec fields per Amazon product type, shared by every client (D-05, decision 100). A product type with no rows has no approved list: its listings read Not available*.';

alter table public.amazon_required_fields enable row level security;

create policy amazon_required_fields_read
  on public.amazon_required_fields
  for select
  to anon, authenticated
  using (true);

revoke all on public.amazon_required_fields from anon, authenticated;
grant select on public.amazon_required_fields to anon, authenticated;

insert into public.amazon_required_fields (
  product_type, product_type_label, field_id, alt_field_ids, label,
  sample_filled, sample_size, source_date, decision, approved_at
)
select v.product_type, v.product_type_label, v.field_id, v.alt_field_ids::text[], v.label,
  v.sample_filled, v.sample_size, v.source_date, 'decision 100', date '2026-11-16'
from (values
  ('GUITARS', 'guitars', 'back_material_type', '{}', 'Back material', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'body_material_type', '{}', 'Body', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'color', '{}', 'Color', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'guitar_bridge_system', '{}', 'Bridge', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'guitar_pickup_configuration', '{}', 'Pickups', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'hand_orientation', '{}', 'Handedness', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'instrument', '{}', 'Instrument', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'neck_material_type', '{}', 'Neck', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'top_material_type', '{}', 'Top material', 15, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'fretboard_material_type', '{}', 'Fretboard', 14, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'number_of_strings', '{}', 'Strings', 14, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'string_material_type', '{}', 'String material', 13, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'included_components', '{}', 'Included components', 9, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'instrument_size', '{}', 'Instrument size', 8, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'scale_length', '{}', 'Scale length', 8, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'connector_type', '{}', 'Connector type', 6, 15, date '2026-11-11'),
  ('GUITARS', 'guitars', 'material_type', '{}', 'Material', 5, 15, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'additional_features', '{}', 'Additional features', 17, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'color', '{}', 'Color', 17, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'light_source_type', '{}', 'Light source', 17, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'number_of_light_sources', '{}', 'Number of light sources', 17, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'power_source', '{}', 'Power source', 17, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'light_source_special_features', '{}', 'Light special features', 16, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'water_resistance_level', '{}', 'Water resistance', 16, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'white_brightness', '{light_output_maximum}', 'Brightness', 16, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'battery_type', '{}', 'Battery type', 15, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'included_components', '{}', 'Included components', 15, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'material_type', '{}', 'Material', 15, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'mounting_type', '{}', 'Mounting type', 15, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'number_of_batteries', '{}', 'Number of batteries', 15, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'item_shape', '{}', 'Shape', 14, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'recommended_uses_for_product', '{}', 'Recommended uses', 14, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'runtime', '{}', 'Runtime', 13, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'battery_description', '{}', 'Battery description', 12, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'finish_types', '{}', 'Finish', 12, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'voltage', '{}', 'Voltage', 9, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'battery_life', '{}', 'Battery life', 7, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'light_source_wattage', '{}', 'Light wattage', 7, 17, date '2026-11-11'),
  ('FLASHLIGHT', 'flashlights', 'wattage', '{}', 'Wattage', 6, 17, date '2026-11-11')
) as v (product_type, product_type_label, field_id, alt_field_ids, label, sample_filled, sample_size, source_date)
on conflict (product_type, field_id) do nothing;

commit;

notify pgrst, 'reload schema';
