# R-10 plan: retailer prices as rows, and a retailer list per client

Written 12 Nov 2026 by Brian Watson (with Claude) for Brian Magazu's review. Nothing here is built or applied yet.

FDD row: **R-10 TARGET** · Launch ([catalog-health.md](fdd/catalog-health.md)). Acceptance: no new `wmt_*` / `mf_*` prefixes. New retailers do not need schema changes.

This plan also covers **MAP history**, which R-09 (violation duration) is blocked on. Rows keep every check instead of only the latest one, so the history comes with them.

## Today

- **Retailer prices are columns.**
  - Fender's `command.fmic_retail_buybox_map` has 13 of them: `wmt_price, wmt_title, wmt_url, wmt_seller, wmt_leakage, wmt_match_conf, wmt_checked_at, mf_price, mf_msrp, mf_title, mf_leakage, mf_checked_at, mf_url`.
  - Ledlenser's `ledlenser.retail_buybox_map` has the 7 Walmart ones.
  - Each check overwrites the last, so there is no history.
- **The columns are also baked into the read layer.**
  - Both `canvas_retail_listings` views carry the retailer columns. Fender's also computes `worst_leakage` and `is_map_violation` with Walmart and Musician's Friend written in.
  - `canvas_metrics` has `wmt_checked/priced/leaks` and `mf_checked/priced/leaks`.
  - Ledlenser's trigger `enforce_channel_leakage()` hard-codes Walmart.
  - `mf_url` is stored but is not in the view.
- **14 app files read them,** with 80 uses in total. The biggest are `lib/fender-canvas/map-channels.ts`, `portfolio-retail.ts` and `types.ts`. About 21 test files have fixtures.
  - `lib/client/column-aliases.ts` strips the `mf_*` columns for Ledlenser.
- **Writers:**
  - The Walmart MAP audit (`map_leakage_walmart`).
  - The Musician's Friend checker wrench (`map_parity_musiciansfriend`).
  - Both write prod and then the sandbox, mirror and claude copies.
- **A first step toward rows already exists but holds nothing.** `command.listing_channel_price` and `ledlenser.listing_channel_price` keep one row per (asin, channel), latest price only. Both have **0 rows** on prod, and the dashboard already shows any rows in them as extra channels.
- **There is no retailer list anywhere.** The retailers are fixed in code.

## Design

### 1. Retailer list: `retailers` in each client schema

`command.retailers` (Fender) and `ledlenser.retailers`:

| Column | Meaning |
| --- | --- |
| `slug` (PK) | `walmart`, `musicians-friend`, `sweetwater`, … Lowercase with hyphens, same rule as today's channel check. |
| `display_name` | "Walmart", "Musician's Friend" |
| `domains` | `text[]` of hosts that belong to this retailer, used to place search results (R-15) |
| `map_channel` | true when MAP is checked here and its prices count toward MAP violations |
| `active` | false hides it without deleting history |
| `sort_order` | column order on screen |

Starting rows:
- **Fender:** Walmart and Musician's Friend active and MAP channels; Sweetwater and Reverb inactive.
- **Ledlenser:** Walmart only.

Adding a retailer means inserting one row. Only staff edit this table, by migration or a staff tool. Clients don't.

### 2. Price checks: `retail_price_observations`, append-only

`command.retail_price_observations` and `ledlenser_private.retail_price_observations`. Each row is one check of one listing at one retailer:

| Column | Meaning |
| --- | --- |
| `id` | identity |
| `asin` | listing |
| `retailer` | FK to `retailers.slug` |
| `observed_at` | when it was checked |
| `run_id` / `collector` | which job and which version wrote it |
| `status` | `priced`, `no_match`, `check_failed` |
| `item_cents`, `shipping_cents` | shelf price and shipping, in cents (shipping null when unknown) |
| `msrp_cents` | retailer's struck-through price, when shown |
| `url`, `title`, `seller`, `condition` | the page we matched |
| `match_confidence` | 0–1, from the checker's match |
| `source` | `retailer_checker` (today's Walmart and Musician's Friend jobs) or `price_search` (R-15) |

There is no update and no delete. An unchanged price still gets a row, so "checked, and still $X" is visible. That is the MAP history R-09 needs: a violation's duration is the run of consecutive checks below MAP.

**Index:** (asin, retailer, observed_at desc).

**Size:** about 1,135 Fender listings × 2 retailers × one check a day is roughly 830k rows a year. That's small. If it grows, we can thin old rows to one a day per listing and retailer later.

### 3. Read views, all SELECT-only for the public key

- **`canvas_retail_prices`:** the latest row per (asin, retailer). It includes `map_price` and `leakage = item price minus MAP` for MAP channels.
- **`canvas_retail_price_history`:** rows for one listing over time, for the drill-down and for R-09's duration.
- **`canvas_retailers`:** the list, so the screen builds its channel columns from data.
- **`canvas_retail_listings` stays,** but its `worst_leakage` and `is_map_violation` are computed over every active MAP-channel row instead of naming Walmart and Musician's Friend.
- **`canvas_metrics` gets a per-retailer companion,** `canvas_retailer_metrics` (retailer, checked, priced, leaks), in place of `wmt_*` / `mf_*` counts.

The empty `listing_channel_price` tables are retired. Their only reader, the "extra channels" path in `map-channels.ts`, moves to `canvas_retail_prices`.

## Cutover, in four pull requests

Order matters: the collectors write outside this repo, so we add the new path, run both for a while, and only then remove the old one.

1. **Tables, views and backfill (additive; Brian approves, an agent applies).**
   - Create the two `retailers` tables, the two observation tables and the new views.
   - Copy today's `wmt_*` / `mf_*` values in as one row each, with `source = 'backfill'` and their stored check time.
   - Nothing on screen changes.
   - Before writing it, take the live DDL of `fmic_retail_buybox_map` and `public.canvas_metrics`, which have no migration of record.
2. **Collectors write rows too.**
   - The Walmart audit and the Musician's Friend checker insert an observation row on every check, `no_match` and `check_failed` included, and keep writing the old columns.
   - This is a Toolbelt wrench change, mine.
   - It starts MAP history from that day.
3. **Dashboard reads rows (view changes wait for Brian Watson to apply).**
   - `map-channels.ts` builds channels from `canvas_retailers` and `canvas_retail_prices`.
   - The leakage and violation math moves onto rows.
   - Exports read the rows.
   - `FENDER_ONLY_COLUMNS` in `column-aliases.ts` goes away.
   - Test fixtures move to rows.
   - Check: every number on the MAP and Catalog Health screens matches the column version for both clients before merging.
4. **Stop the columns (Brian Watson applies).**
   - After two weeks with both paths matching, the collectors stop writing `wmt_*` / `mf_*`.
   - The views drop those columns, and the Ledlenser trigger goes.
   - The base-table columns can stay a while longer as a safety copy, then be dropped in a later migration.

**Undo, at every step:**
- Until step 4, the old columns are still written, so a read can switch back.
- Each migration file carries its own undo.

## What this unblocks

- **R-09:** violation duration, from the observation history. Nothing extra to collect; it starts the day step 2 ships.
- **R-15:** the price-match search writes its results as observation rows with `source = 'price_search'` ([r15-price-match-plan.md](r15-price-match-plan.md)).
- **X-30, later:** Google and other channels are new retailer rows, not columns.

## Decisions for Brian

1. **Retailer list home:** one `retailers` table in each client schema, staff-edited. Agree?
2. **History:** keep every check (recommended, since it is the MAP history), or only changes in price?
3. **Musician's Friend for Ledlenser:** stays off. Walmart only, as today.
4. **Order with R-15:** step 1 first, since R-15 stores into these tables. Steps 2–4 can run alongside R-15.
