-- Retailer lists are per client (Brian Magazu, 23 Nov 2026): Amazon (the home channel, not a row)
-- and Walmart, plus each client's own retailers; no client inherits another's. Guitar Center is on
-- Fender's list only, display only (map_channel false, active false), like Sweetwater and Reverb.
-- Migration: 20261123220000_fender_guitar_center_retailer.sql.

do $$ begin
  if not exists (select 1 from command.retailers
                 where slug = 'guitar-center' and display_name = 'Guitar Center'
                   and domains = array['guitarcenter.com'] and not map_channel and not active) then
    raise exception 'command.retailers: Guitar Center display only';
  end if;
  -- MAP channels unchanged: Walmart and Musician's Friend only.
  if (select string_agg(slug, ',' order by sort_order) from command.retailers where map_channel)
     <> 'walmart,musicians-friend' then
    raise exception 'command.retailers: MAP channels changed';
  end if;
  -- Ledlenser: the starting set (Walmart, a MAP channel) and nothing of Fender's. (Other tests in
  -- this run add throwaway rows to every table, so the check names Fender's slugs rather than
  -- counting rows.)
  if not exists (select 1 from ledlenser.retailers where slug = 'walmart' and map_channel and active) then
    raise exception 'ledlenser.retailers: Walmart missing';
  end if;
  if exists (select 1 from ledlenser.retailers
             where slug in ('guitar-center', 'musicians-friend', 'sweetwater', 'reverb')) then
    raise exception 'ledlenser.retailers inherits a Fender retailer';
  end if;
  -- R-15 names a Guitar Center result through the list.
  if (select display_name from public.canvas_retailers where slug = 'guitar-center') <> 'Guitar Center' then
    raise exception 'canvas_retailers: Guitar Center';
  end if;
end $$;
