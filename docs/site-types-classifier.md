# Site-type classifier (decision 21a)

Spec for the AI job that fills `public.site_type_classifications`. Draft; the table and the read
view `public.canvas_site_types` come from `supabase/migrations/20261111150000_site_types.sql`
(applied to production 11 Nov 2026, PR 174). The job runs in Toolbelt as "Site type classifier
(IntoFocus dashboard, decision 21a)" on AEO_Product_Research-FenderTest, daily at 11:40 UTC,
up to 100 domains a run, skipping a subdomain when its main domain already has a row.

## What it decides

For one cited domain, one of: `brand_owned`, `retailer`, `publication` (publication or review),
`community` (community or forum), `video`, `competitor_brand`, `reference`, `other`. It stores the
type, a confidence from 0 to 1, a short reason, the model, and `classified_at`. The answer is
stored, never recomputed on page load.

## Input

- `domain` (lowercase, no `www.`).
- The page itself: the fetched home page title, meta description, and the first 1,500 characters
  of visible text. If the home page cannot be fetched, use the cited page URL stored for that
  domain; if neither loads, skip the domain (no row) and retry on a later run.
- `client_key` and the client's brand name and own site domains, for client rows only (below).

## Output (JSON only)

```json
{ "type": "publication", "confidence": 0.86, "reason": "Guitar gear reviews and buying guides." }
```

The job rejects any reply that is not valid JSON, has a type outside the eight values, or has a
confidence outside 0 to 1, and treats it as a failure.

## Prompt

System:

> You classify websites that AI shopping assistants cite as sources. Choose exactly one type for
> the site: brand_owned (a manufacturer's own site or store), retailer (sells products from many
> brands or is a marketplace), publication (editorial, magazines, reviews, buying guides),
> community (forums, Reddit-style discussion, Q&A, user review aggregators), video (video
> platforms), competitor_brand (a manufacturer's own site that competes with the brand named
> below), reference (encyclopedias, manuals libraries, databases), other (none of these). Judge
> from the page content given, not the domain name alone. Say how sure you are from 0 to 1;
> use below 0.7 when the page is thin or fits two types. Reply with JSON only:
> {"type": "...", "confidence": 0.0, "reason": "one short sentence"}.

User:

> Brand: {brand_name} (its own sites: {brand_domains}).
> Domain: {domain}
> Title: {title}
> Description: {description}
> Text: {text_sample}

## Global and client rows

The job first classifies the domain without a brand (client_key NULL, global row), using
`brand_owned` and `competitor_brand` only when the page makes it plain that it is a manufacturer's
own site. Then, for each client, it writes a client row only when the answer differs for that
brand: `brand_owned` when the domain is one of the client's own sites, `competitor_brand` when the
page is a rival manufacturer in the client's category. Staff overrides use the same two levels.

## When it runs

After each published run, for domains cited in that run that have no row for the client in
`canvas_site_types`. One call per new domain. Domains with a staff override or a stored row are
never reclassified. A weekly pass may re-run AI rows under the review threshold (0.7, column
`site_type_settings.review_below`); a staff override is never touched.

## Where it writes

`site_type_classifications` (`origin = 'ai'`, `confidence`, `model`, `classified_at`, `reason`),
with the service role, upserting on (domain, client). Staff overrides go to `site_type_overrides`
(`set_by_name`, `set_at`, `note`), also with the service role, until a staff screen exists.

## Failures

- Fetch fails or times out (10 seconds): no row; the domain is retried on a later run.
- Model error or invalid JSON: retry once; then write no row. The domain stays unclassified and
  the dashboard uses its in-code lists. The next run tries again.
- No failure ever changes an existing row or blocks the run's publish.

## Needs review

An AI row with confidence under `review_below` reads `needs_review = true` in the view. It still
shows its type. Where staff see this is open: the FDD does not place it on any screen yet.
