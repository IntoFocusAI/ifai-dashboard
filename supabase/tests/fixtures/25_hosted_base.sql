-- Test-only stand-ins for hosted tables that predate the repo's migrations. Not a migration.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  organization_id uuid,
  actor_user_id uuid,
  entity_table text not null,
  entity_id uuid,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text
);
alter table public.audit_log enable row level security;
