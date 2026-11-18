-- public.canvas_site_types (view) — live definition snapshot, do not apply
--   client_key: text
--   domain: text
--   site_type: text
--   source: text
--   confidence: numeric
--   model: text
--   classified_at: timestamp with time zone
--   needs_review: boolean
CREATE OR REPLACE VIEW public.canvas_site_types AS
 WITH candidates AS (
         SELECT c.client_key,
            o.domain,
            o.site_type,
            NULL::numeric AS confidence,
            'staff'::text AS source,
            NULL::text AS model,
            o.set_at AS classified_at,
                CASE
                    WHEN o.client_key IS NULL THEN 2
                    ELSE 1
                END AS rank
           FROM site_type_overrides o
             JOIN set_aside_clients c ON o.client_key IS NULL OR o.client_key = c.client_key
        UNION ALL
         SELECT c.client_key,
            k.domain,
            k.site_type,
            k.confidence,
            k.origin,
            k.model,
            k.classified_at,
                CASE
                    WHEN k.client_key IS NULL THEN 4
                    ELSE 3
                END AS rank
           FROM site_type_classifications k
             JOIN set_aside_clients c ON k.client_key IS NULL OR k.client_key = c.client_key
        )
 SELECT DISTINCT ON (client_key, domain) client_key,
    domain,
    site_type,
    source,
    confidence,
    model,
    classified_at,
    source = 'ai'::text AND confidence < (( SELECT s.review_below
           FROM site_type_settings s
          WHERE s.id)) AS needs_review
   FROM candidates x
  ORDER BY client_key, domain, rank;
