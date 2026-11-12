-- Worker 25.10: site types as data (decision 21a).
--
-- What it changes
--   Adds three tables and one read view. Nothing existing is altered or deleted.
--
--   public.site_type_classifications  What the AI job (or the seed) says a cited site is.
--     One row per (domain, client). client_key NULL is the global answer for the domain;
--     a client_key row is that client's answer (fender.com is brand-owned for fmic and means
--     nothing for ledlenser). Columns: site_type, confidence (0 to 1, NULL for seed rows),
--     model, classified_at, reason, origin ('seed' or 'ai').
--   public.site_type_overrides        IntoFocus staff overrides. Same (domain, client) key,
--     plus set_by_name, set_by_user_id, set_at, note. An override always wins over any
--     classification, and a client row wins over a global row of the same kind.
--   public.site_type_settings         One row. review_below (0.7): an AI classification under
--     this confidence reads needs_review = true for staff. A column, not a constant in code.
--   public.canvas_site_types          The read view. One row per (client_key, domain) with the
--     winning type, source ('staff', 'ai', 'seed'), confidence, needs_review, model,
--     classified_at. Global rows are expanded to every client in public.set_aside_clients.
--     Precedence: client override, global override, client classification, global classification.
--
--   client_key uses public.set_aside_clients.client_key ('fmic', 'ledlenser'), the key every
--   shared public table already uses (set-asides, 20261102190000) and the one the dashboard
--   exposes as activeClient().setAsideKey. No second client list.
--
--   Seed: 193 rows in site_type_classifications, origin 'seed', copied from the lists in
--   lib/ai-search/citations.ts (classifySource), so nothing changes on screen on day one.
--     fmic       7 brand_owned, 18 retailer, 12 publication, 6 community, 4 video,
--                4 reference, 11 competitor_brand (62)
--     ledlenser  2 brand_owned, 41 retailer, 41 publication, 6 community, 4 video,
--                5 reference, 32 competitor_brand (131)
--   The in-code pattern rules (ledlenser regional sites, forum.* hosts) stay in code as the
--   fallback for domains with no stored row.
--
--   Security: RLS is on for all three tables with no policies, so the publishable key cannot
--   read or write them. The view runs as its owner (security_invoker = false) and is granted
--   SELECT to anon and authenticated, read only. Staff overrides and the AI job write with the
--   service role (see docs/site-types-classifier.md); no function or write grant is added here.
--
-- How to undo
--   DROP VIEW public.canvas_site_types;
--   DROP TABLE public.site_type_overrides, public.site_type_classifications, public.site_type_settings;
--   NOTIFY pgrst, 'reload schema';
--   The dashboard falls back to its in-code lists when the view is absent.
--
-- Status: NOT APPLIED. Additive, so it needs Brian Magazu's approval before it is applied, and
-- the pull request records when and by whom. Until then the dashboard reads the in-code lists.

create table if not exists public.site_type_settings (
  id boolean primary key default true check (id),
  review_below numeric not null default 0.7 check (review_below between 0 and 1),
  updated_at timestamptz not null default now()
);

insert into public.site_type_settings (id, review_below) values (true, 0.7)
on conflict (id) do nothing;

create table if not exists public.site_type_classifications (
  id bigint generated always as identity primary key,
  domain text not null check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$' and domain !~ '^www\.'),
  client_key text references public.set_aside_clients(client_key),
  site_type text not null check (site_type in
    ('brand_owned', 'retailer', 'publication', 'community', 'video', 'competitor_brand', 'reference', 'other')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  model text,
  classified_at timestamptz not null default now(),
  reason text check (reason is null or char_length(reason) <= 500),
  origin text not null check (origin in ('seed', 'ai')),
  -- An AI row always says how sure it was and which model said so.
  check (origin = 'seed' or (confidence is not null and model is not null))
);

create unique index if not exists site_type_classifications_key_idx
  on public.site_type_classifications (domain, coalesce(client_key, ''));

create table if not exists public.site_type_overrides (
  id bigint generated always as identity primary key,
  domain text not null check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$' and domain !~ '^www\.'),
  client_key text references public.set_aside_clients(client_key),
  site_type text not null check (site_type in
    ('brand_owned', 'retailer', 'publication', 'community', 'video', 'competitor_brand', 'reference', 'other')),
  set_by_name text not null check (char_length(set_by_name) between 2 and 80),
  set_by_user_id uuid references auth.users(id) on delete set null,
  set_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500)
);

create unique index if not exists site_type_overrides_key_idx
  on public.site_type_overrides (domain, coalesce(client_key, ''));

alter table public.site_type_settings enable row level security;
alter table public.site_type_classifications enable row level security;
alter table public.site_type_overrides enable row level security;

-- Seed: the current classifySource lists ---------------------------------------

insert into public.site_type_classifications (client_key, domain, site_type, origin, model, reason)
select v.client_key, v.domain, v.site_type, 'seed', 'seed:classifySource',
  'Copied from the source lists in lib/ai-search/citations.ts.'
from (values
  ('fmic', 'fender.com', 'brand_owned'),
  ('fmic', 'fmicassets.com', 'brand_owned'),
  ('fmic', 'squier.com', 'brand_owned'),
  ('fmic', 'gretschguitars.com', 'brand_owned'),
  ('fmic', 'jacksonguitars.com', 'brand_owned'),
  ('fmic', 'charvel.com', 'brand_owned'),
  ('fmic', 'evhgear.com', 'brand_owned'),
  ('fmic', 'amazon.com', 'retailer'),
  ('fmic', 'amazon.co.uk', 'retailer'),
  ('fmic', 'amazon.ca', 'retailer'),
  ('fmic', 'sweetwater.com', 'retailer'),
  ('fmic', 'guitarcenter.com', 'retailer'),
  ('fmic', 'musiciansfriend.com', 'retailer'),
  ('fmic', 'zzounds.com', 'retailer'),
  ('fmic', 'thomann.de', 'retailer'),
  ('fmic', 'thomannmusic.com', 'retailer'),
  ('fmic', 'andertons.co.uk', 'retailer'),
  ('fmic', 'guitarguitar.co.uk', 'retailer'),
  ('fmic', 'reverb.com', 'retailer'),
  ('fmic', 'walmart.com', 'retailer'),
  ('fmic', 'bestbuy.com', 'retailer'),
  ('fmic', 'samash.com', 'retailer'),
  ('fmic', 'gear4music.com', 'retailer'),
  ('fmic', 'americanmusical.com', 'retailer'),
  ('fmic', 'pmtonline.co.uk', 'retailer'),
  ('fmic', 'guitarworld.com', 'publication'),
  ('fmic', 'musicradar.com', 'publication'),
  ('fmic', 'premierguitar.com', 'publication'),
  ('fmic', 'guitarplayer.com', 'publication'),
  ('fmic', 'guitar.com', 'publication'),
  ('fmic', 'guitarinteractivemagazine.com', 'publication'),
  ('fmic', 'acousticguitar.com', 'publication'),
  ('fmic', 'bassplayer.com', 'publication'),
  ('fmic', 'bassmagazine.com', 'publication'),
  ('fmic', 'nytimes.com', 'publication'),
  ('fmic', 'wirecutter.com', 'publication'),
  ('fmic', 'rollingstone.com', 'publication'),
  ('fmic', 'reddit.com', 'community'),
  ('fmic', 'talkbass.com', 'community'),
  ('fmic', 'thegearpage.net', 'community'),
  ('fmic', 'tdpri.com', 'community'),
  ('fmic', 'quora.com', 'community'),
  ('fmic', 'ultimate-guitar.com', 'community'),
  ('fmic', 'youtube.com', 'video'),
  ('fmic', 'youtu.be', 'video'),
  ('fmic', 'vimeo.com', 'video'),
  ('fmic', 'tiktok.com', 'video'),
  ('fmic', 'wikipedia.org', 'reference'),
  ('fmic', 'manualslib.com', 'reference'),
  ('fmic', 'manuals.plus', 'reference'),
  ('fmic', 'equipboard.com', 'reference'),
  ('fmic', 'yamaha.com', 'competitor_brand'),
  ('fmic', 'gibson.com', 'competitor_brand'),
  ('fmic', 'epiphone.com', 'competitor_brand'),
  ('fmic', 'taylorguitars.com', 'competitor_brand'),
  ('fmic', 'prsguitars.com', 'competitor_brand'),
  ('fmic', 'ibanez.com', 'competitor_brand'),
  ('fmic', 'sire-usa.com', 'competitor_brand'),
  ('fmic', 'boss.info', 'competitor_brand'),
  ('fmic', 'positivegrid.com', 'competitor_brand'),
  ('fmic', 'martinguitar.com', 'competitor_brand'),
  ('fmic', 'schecterguitars.com', 'competitor_brand'),
  ('ledlenser', 'ledlenser.com', 'brand_owned'),
  ('ledlenser', 'ledlenserusa.com', 'brand_owned'),
  ('ledlenser', 'amazon.com', 'retailer'),
  ('ledlenser', 'amazon.co.uk', 'retailer'),
  ('ledlenser', 'amazon.ca', 'retailer'),
  ('ledlenser', 'amazon.de', 'retailer'),
  ('ledlenser', 'amazon.com.au', 'retailer'),
  ('ledlenser', 'amazon.com.be', 'retailer'),
  ('ledlenser', 'walmart.com', 'retailer'),
  ('ledlenser', 'homedepot.com', 'retailer'),
  ('ledlenser', 'lowes.com', 'retailer'),
  ('ledlenser', 'acehardware.com', 'retailer'),
  ('ledlenser', 'target.com', 'retailer'),
  ('ledlenser', 'bestbuy.com', 'retailer'),
  ('ledlenser', 'rei.com', 'retailer'),
  ('ledlenser', 'basspro.com', 'retailer'),
  ('ledlenser', 'cabelas.com', 'retailer'),
  ('ledlenser', 'dickssportinggoods.com', 'retailer'),
  ('ledlenser', 'backcountry.com', 'retailer'),
  ('ledlenser', 'moosejaw.com', 'retailer'),
  ('ledlenser', 'zappos.com', 'retailer'),
  ('ledlenser', 'govx.com', 'retailer'),
  ('ledlenser', 'screwfix.com', 'retailer'),
  ('ledlenser', 'toolstation.com', 'retailer'),
  ('ledlenser', 'knivesandtools.com', 'retailer'),
  ('ledlenser', 'flashlightworld.com', 'retailer'),
  ('ledlenser', 'batteryjunction.com', 'retailer'),
  ('ledlenser', 'torchdirect.co.uk', 'retailer'),
  ('ledlenser', 'klium.com', 'retailer'),
  ('ledlenser', 'misterworker.com', 'retailer'),
  ('ledlenser', 'rs-online.com', 'retailer'),
  ('ledlenser', 'distrelec.com', 'retailer'),
  ('ledlenser', 'tendsupplies.com', 'retailer'),
  ('ledlenser', 'valostore.com', 'retailer'),
  ('ledlenser', 'brightlightled.shop', 'retailer'),
  ('ledlenser', 'adventurekit.com.au', 'retailer'),
  ('ledlenser', 'eliteoutdoorgear.com.au', 'retailer'),
  ('ledlenser', 'lightertorch.com', 'retailer'),
  ('ledlenser', 'campcrewlight.store', 'retailer'),
  ('ledlenser', 'clipandcarry.us', 'retailer'),
  ('ledlenser', 'ultralightoutdoorgear.co.uk', 'retailer'),
  ('ledlenser', 'zweibruder.co.uk', 'retailer'),
  ('ledlenser', 'ebay.com', 'retailer'),
  ('ledlenser', '1lumen.com', 'publication'),
  ('ledlenser', 'zeroair.org', 'publication'),
  ('ledlenser', 'zakreviews.com', 'publication'),
  ('ledlenser', 'flashlightratings.com', 'publication'),
  ('ledlenser', 'cleverhiker.com', 'publication'),
  ('ledlenser', 'switchbacktravel.com', 'publication'),
  ('ledlenser', 'treelinereview.com', 'publication'),
  ('ledlenser', 'outdoorgearlab.com', 'publication'),
  ('ledlenser', 'gearjunkie.com', 'publication'),
  ('ledlenser', 'backpacker.com', 'publication'),
  ('ledlenser', 'outdoorlife.com', 'publication'),
  ('ledlenser', 'fieldandstream.com', 'publication'),
  ('ledlenser', 'mensjournal.com', 'publication'),
  ('ledlenser', 't3.com', 'publication'),
  ('ledlenser', 'techradar.com', 'publication'),
  ('ledlenser', 'popularmechanics.com', 'publication'),
  ('ledlenser', 'bobvila.com', 'publication'),
  ('ledlenser', 'nytimes.com', 'publication'),
  ('ledlenser', 'wirecutter.com', 'publication'),
  ('ledlenser', 'cnn.com', 'publication'),
  ('ledlenser', 'livescience.com', 'publication'),
  ('ledlenser', 'runnersworld.com', 'publication'),
  ('ledlenser', 'trailrunmag.com', 'publication'),
  ('ledlenser', 'irunfar.com', 'publication'),
  ('ledlenser', 'trailruntemple.com', 'publication'),
  ('ledlenser', 'edc4me.com', 'publication'),
  ('ledlenser', 'beamandbezel.com', 'publication'),
  ('ledlenser', 'dailycarrylab.com', 'publication'),
  ('ledlenser', 'lumenandledger.com', 'publication'),
  ('ledlenser', 'thegreatoutdoorsmag.com', 'publication'),
  ('ledlenser', 'terraintechgear.com', 'publication'),
  ('ledlenser', 'pewpewtactical.com', 'publication'),
  ('ledlenser', 'the-gadgeteer.com', 'publication'),
  ('ledlenser', 'momgoescamping.com', 'publication'),
  ('ledlenser', 'campingguidance.com', 'publication'),
  ('ledlenser', 'outdoortechlab.com', 'publication'),
  ('ledlenser', 'kitauthority.com', 'publication'),
  ('ledlenser', 'ovrmag.com', 'publication'),
  ('ledlenser', 'findswetrust.com', 'publication'),
  ('ledlenser', 'itechguides.com', 'publication'),
  ('ledlenser', 'nurserypicks.com', 'publication'),
  ('ledlenser', 'reddit.com', 'community'),
  ('ledlenser', 'budgetlightforum.com', 'community'),
  ('ledlenser', 'candlepowerforums.com', 'community'),
  ('ledlenser', 'quora.com', 'community'),
  ('ledlenser', 'trustpilot.com', 'community'),
  ('ledlenser', 'productreview.com.au', 'community'),
  ('ledlenser', 'youtube.com', 'video'),
  ('ledlenser', 'youtu.be', 'video'),
  ('ledlenser', 'vimeo.com', 'video'),
  ('ledlenser', 'tiktok.com', 'video'),
  ('ledlenser', 'wikipedia.org', 'reference'),
  ('ledlenser', 'manualslib.com', 'reference'),
  ('ledlenser', 'manuals.plus', 'reference'),
  ('ledlenser', 'device.report', 'reference'),
  ('ledlenser', 'productsafety.gov.au', 'reference'),
  ('ledlenser', 'petzl.com', 'competitor_brand'),
  ('ledlenser', 'blackdiamondequipment.com', 'competitor_brand'),
  ('ledlenser', 'fenixlighting.com', 'competitor_brand'),
  ('ledlenser', 'fenixlight.com', 'competitor_brand'),
  ('ledlenser', 'fenix-store.com', 'competitor_brand'),
  ('ledlenser', 'nitecore.com', 'competitor_brand'),
  ('ledlenser', 'nitecorestore.com', 'competitor_brand'),
  ('ledlenser', 'olight.com', 'competitor_brand'),
  ('ledlenser', 'olightstore.com', 'competitor_brand'),
  ('ledlenser', 'streamlight.com', 'competitor_brand'),
  ('ledlenser', 'coastportland.com', 'competitor_brand'),
  ('ledlenser', 'kleintools.com', 'competitor_brand'),
  ('ledlenser', 'milwaukeetool.com', 'competitor_brand'),
  ('ledlenser', 'acgbrands.com', 'competitor_brand'),
  ('ledlenser', 'nebotools.com', 'competitor_brand'),
  ('ledlenser', 'wubenlight.com', 'competitor_brand'),
  ('ledlenser', 'luxpro.com', 'competitor_brand'),
  ('ledlenser', 'lupinelights.com', 'competitor_brand'),
  ('ledlenser', 'silvasweden.com', 'competitor_brand'),
  ('ledlenser', 'varta-ag.com', 'competitor_brand'),
  ('ledlenser', 'princetontec.com', 'competitor_brand'),
  ('ledlenser', 'bioliteenergy.com', 'competitor_brand'),
  ('ledlenser', 'goalzero.com', 'competitor_brand'),
  ('ledlenser', 'energizer.com', 'competitor_brand'),
  ('ledlenser', 'maglite.com', 'competitor_brand'),
  ('ledlenser', 'surefire.com', 'competitor_brand'),
  ('ledlenser', 'acebeam.com', 'competitor_brand'),
  ('ledlenser', 'armytek.com', 'competitor_brand'),
  ('ledlenser', 'thrunite.com', 'competitor_brand'),
  ('ledlenser', 'sofirnlight.com', 'competitor_brand'),
  ('ledlenser', 'zebralight.com', 'competitor_brand'),
  ('ledlenser', 'dewalt.com', 'competitor_brand')
) as v(client_key, domain, site_type)
on conflict do nothing;

-- Read view -----------------------------------------------------------------------

create or replace view public.canvas_site_types
with (security_invoker = false) as
with candidates as (
  select c.client_key, o.domain, o.site_type, null::numeric as confidence, 'staff'::text as source,
         null::text as model, o.set_at as classified_at,
         case when o.client_key is null then 2 else 1 end as rank
  from public.site_type_overrides o
  join public.set_aside_clients c on o.client_key is null or o.client_key = c.client_key
  union all
  select c.client_key, k.domain, k.site_type, k.confidence, k.origin, k.model, k.classified_at,
         case when k.client_key is null then 4 else 3 end as rank
  from public.site_type_classifications k
  join public.set_aside_clients c on k.client_key is null or k.client_key = c.client_key
)
select distinct on (x.client_key, x.domain)
  x.client_key, x.domain, x.site_type, x.source, x.confidence, x.model, x.classified_at,
  (x.source = 'ai' and x.confidence < (select s.review_below from public.site_type_settings s where s.id))
    as needs_review
from candidates x
order by x.client_key, x.domain, x.rank;

revoke all on public.canvas_site_types from public;
grant select on public.canvas_site_types to anon, authenticated;

notify pgrst, 'reload schema';
