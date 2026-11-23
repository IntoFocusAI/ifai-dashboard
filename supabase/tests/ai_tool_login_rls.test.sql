-- cursor_map_writer (the cloud AI agents' login, SUPABASE_DB_URL) follows RLS and keeps its work:
-- reads the two Fender catalog tables, updates only the MAP columns, and sees nothing else.
\set ON_ERROR_STOP 1

do $$
begin
  if (select rolbypassrls from pg_roles where rolname = 'cursor_map_writer') then
    raise exception 'cursor_map_writer still bypasses RLS';
  end if;
end $$;

begin;
-- One made-up row as owner, rolled back at the end.
insert into command.fmic_retail_buybox_map (id, asin, model_name, offer_price, reviews_count,
  buybox_status, created_at, updated_at, map_price)
values ('00000000-0000-0000-0000-0000000000aa', 'BTESTRLS01', 'Test', 100, 0, 'won', now(), now(), 90);

set local role cursor_map_writer;
do $$
declare n int;
begin
  select count(*) into n from command.fmic_retail_buybox_map where asin = 'BTESTRLS01';
  if n <> 1 then raise exception 'cursor_map_writer cannot read fmic_retail_buybox_map (saw % rows)', n; end if;

  perform count(*) from command.fmic_electric_catalog;

  update command.fmic_retail_buybox_map set map_price = 95 where asin = 'BTESTRLS01';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'cursor_map_writer MAP update touched % rows, expected 1', n; end if;

  begin
    update command.fmic_retail_buybox_map set offer_price = 1 where asin = 'BTESTRLS01';
    raise exception 'cursor_map_writer could update offer_price';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from command.organizations limit 1;
    raise exception 'cursor_map_writer can read command.organizations';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
