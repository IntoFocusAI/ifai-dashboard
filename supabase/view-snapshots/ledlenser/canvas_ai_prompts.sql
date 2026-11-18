-- ledlenser.canvas_ai_prompts (view) — live definition snapshot, do not apply
--   prompt_key: text
--   prompt_text: text
--   category: text
--   prompt_kind: text
--   active: boolean
--   created_at: timestamp with time zone
--   updated_at: timestamp with time zone
--   analytical_intent: text
CREATE OR REPLACE VIEW ledlenser.canvas_ai_prompts AS
 SELECT prompt_key,
    prompt_text,
    category::text AS category,
    prompt_kind,
    active,
    created_at,
    updated_at,
    analytical_intent
   FROM ledlenser.ai_prompts p;
