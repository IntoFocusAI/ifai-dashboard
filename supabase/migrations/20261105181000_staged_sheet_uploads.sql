-- Worker 22.6: stage a catalog or MAP upload until an administrator approves it.
--
-- What this changes (additive only):
--   * public.staged_sheet_uploads   one new table for a staged file and its rows
--
-- A file stays pending until someone records approval on this table. Approval
-- stores who approved it and when. It does not copy rows into the live catalog,
-- the MAP price columns, or command.fmic_retail_buybox_map. This file does not
-- alter an existing table, column, view, or grant.
--
-- The dashboard has no administrator login yet, so the public key can read,
-- insert a pending file, and set the approval columns on this table only.
-- The payload cannot be updated. Inserts must stay pending. An update can only
-- move a pending row to approved, and it must name who approved it and when.
--
-- Apply only after Brian Magazu approves. Do not apply this file from the
-- upload page or from a cloud agent. Brian Watson applies anything that
-- alters or deletes existing data.
--
-- Undo:
--   drop table public.staged_sheet_uploads;

create table public.staged_sheet_uploads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('catalog', 'map')),
  file_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  payload jsonb not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  approved_by_name text,
  approved_at timestamptz,
  constraint staged_sheet_uploads_file_name
    check (char_length(btrim(file_name)) between 1 and 300),
  constraint staged_sheet_uploads_created_by
    check (created_by_name is null or char_length(btrim(created_by_name)) between 2 and 80),
  constraint staged_sheet_uploads_payload_object
    check (jsonb_typeof(payload) = 'object'),
  constraint staged_sheet_uploads_payload_size
    check (octet_length(payload::text) <= 1500000),
  constraint staged_sheet_uploads_approval_pair check (
    (
      status = 'pending'
      and approved_by_name is null
      and approved_at is null
    )
    or (
      status = 'approved'
      and approved_by_name is not null
      and char_length(btrim(approved_by_name)) between 2 and 80
      and approved_at is not null
    )
  )
);

comment on table public.staged_sheet_uploads is
  'Staged catalog or MAP uploads. Status moves from pending to approved on this table only. Approval does not copy rows into the live catalog or MAP tables.';

comment on column public.staged_sheet_uploads.payload is
  'Pending rows that would be loaded, plus duplicates kept out of that set.';

comment on column public.staged_sheet_uploads.status is
  'pending until an administrator approves the file. approved means the file is accepted here. It does not publish the live catalog.';

create index staged_sheet_uploads_kind_created
  on public.staged_sheet_uploads (kind, created_at desc);

alter table public.staged_sheet_uploads enable row level security;

do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select, insert on table public.staged_sheet_uploads to anon;
    grant update (status, approved_by_name, approved_at) on table public.staged_sheet_uploads to anon;
    create policy staged_sheet_uploads_anon_select
      on public.staged_sheet_uploads for select to anon
      using (true);
    create policy staged_sheet_uploads_anon_insert
      on public.staged_sheet_uploads for insert to anon
      with check (status = 'pending' and approved_by_name is null and approved_at is null);
    create policy staged_sheet_uploads_anon_approve
      on public.staged_sheet_uploads for update to anon
      using (status = 'pending')
      with check (
        status = 'approved'
        and approved_by_name is not null
        and char_length(btrim(approved_by_name)) between 2 and 80
        and approved_at is not null
      );
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert on table public.staged_sheet_uploads to authenticated;
    grant update (status, approved_by_name, approved_at) on table public.staged_sheet_uploads to authenticated;
    create policy staged_sheet_uploads_authenticated_select
      on public.staged_sheet_uploads for select to authenticated
      using (true);
    create policy staged_sheet_uploads_authenticated_insert
      on public.staged_sheet_uploads for insert to authenticated
      with check (status = 'pending' and approved_by_name is null and approved_at is null);
    create policy staged_sheet_uploads_authenticated_approve
      on public.staged_sheet_uploads for update to authenticated
      using (status = 'pending')
      with check (
        status = 'approved'
        and approved_by_name is not null
        and char_length(btrim(approved_by_name)) between 2 and 80
        and approved_at is not null
      );
  end if;
end
$grant$;

notify pgrst, 'reload schema';
