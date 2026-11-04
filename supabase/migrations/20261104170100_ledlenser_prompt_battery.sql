-- Ledlenser AI Search prompt battery, draft 1 (2026-11-04). Needs 20261104170000_ledlenser_schema.sql.
--
-- 29 commercial prompts and 3 rotating catalog fact-check slots, the same shape as Fender's battery
-- (command.fmic_ai_prompts p01-p37). Categories follow the product sheet's divisions: headlamps,
-- flashlights, work_lights, lanterns, kids, plus brand for brand-level questions and hallucinations
-- for the fact-check slots.
--
-- Headline rates use the same two roles as Fender: unbranded_discovery (no brand named) and
-- branded_consideration (Ledlenser named). brand_associated_discovery prompts lean on a Ledlenser trait
-- without naming it. product_fact and shopping_guidance prompts are excluded from the headline rates.
-- Competitors named here are the AI Search set in ledlenser.client_config, plus Milwaukee for work lights.
--
-- No fixed fact-check prompts yet: each one needs a verified claim in ledlenser.ai_probe_facts, checked
-- by a person against ledlenser.com. The rotating slots draw their questions from the product sheet.
--
-- Nothing runs these until the Ledlenser AI battery wrench exists. Edit freely before then.
--
-- Undo: DELETE FROM ledlenser.ai_prompts WHERE prompt_key LIKE 'l__';

INSERT INTO ledlenser.ai_prompts
  (prompt_key, prompt_text, category, prompt_kind, analytical_intent, headline_denominator, names_client_brand, probe_mode, probe_slots)
VALUES
  -- Headlamps
  ('l01', 'Best rechargeable headlamp for backpacking and hiking', 'headlamps', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l02', 'Brightest headlamp for night trail running', 'headlamps', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l03', 'Best headlamp for electricians and contractors', 'headlamps', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l04', 'Best headlamp with a focusable beam that switches between spot and flood', 'headlamps', 'commercial', 'brand_associated_discovery', 'brand_associated_discovery', false, 'fixed', NULL),
  ('l05', 'Ledlenser H7R vs Petzl Swift RL headlamp', 'headlamps', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l06', 'Is the Ledlenser HF8R a good headlamp for camping?', 'headlamps', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l07', 'How long does the Ledlenser H19R battery last on its highest setting?', 'headlamps', 'commercial', 'product_fact', 'excluded', true, 'fixed', NULL),
  -- Flashlights
  ('l08', 'Best rechargeable EDC flashlight under $100', 'flashlights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l09', 'Best high-lumen flashlight for search and rescue', 'flashlights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l10', 'Best compact keychain flashlight that charges with USB-C', 'flashlights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l11', 'Best tactical flashlight for law enforcement', 'flashlights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l12', 'Ledlenser P7R vs Olight Warrior 3S flashlight', 'flashlights', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l13', 'Is the Ledlenser P5R worth it?', 'flashlights', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l14', 'What is the beam distance of the Ledlenser P7R?', 'flashlights', 'commercial', 'product_fact', 'excluded', true, 'fixed', NULL),
  -- Work lights
  ('l15', 'Best rechargeable work light for auto mechanics', 'work_lights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l16', 'Best LED floodlight for construction job sites', 'work_lights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l17', 'Best pen light for home inspectors', 'work_lights', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l18', 'Ledlenser W5R Work vs Milwaukee rechargeable work light', 'work_lights', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  -- Lanterns
  ('l19', 'Best rechargeable camping lantern for a tent', 'lanterns', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l20', 'Best warm white camping lantern that does not attract bugs', 'lanterns', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l21', 'Ledlenser ML6 vs Black Diamond Apollo lantern', 'lanterns', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  -- Kids
  ('l22', 'Best headlamp for kids going camping', 'kids', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  ('l23', 'Safest flashlight for a young child', 'kids', 'commercial', 'unbranded_discovery', 'unbranded_discovery', false, 'fixed', NULL),
  -- Brand level
  ('l24', 'Ledlenser vs Petzl: which headlamp brand is better?', 'brand', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l25', 'Is Ledlenser a good flashlight brand?', 'brand', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l26', 'Fenix vs Nitecore vs Ledlenser rechargeable headlamps', 'brand', 'commercial', 'branded_consideration', 'branded_consideration', true, 'fixed', NULL),
  ('l27', 'Best German-engineered flashlight brand', 'brand', 'commercial', 'brand_associated_discovery', 'brand_associated_discovery', false, 'fixed', NULL),
  ('l28', 'How many lumens do I need in a headlamp for hiking?', 'brand', 'commercial', 'shopping_guidance', 'excluded', false, 'fixed', NULL),
  ('l29', 'What IP rating should a camping flashlight have?', 'brand', 'commercial', 'shopping_guidance', 'excluded', false, 'fixed', NULL),
  -- Rotating catalog fact checks (question per run in ledlenser.ai_probe_plan)
  ('l30', 'Rotating catalog fact check slot A: question per run in ledlenser.ai_probe_plan', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, 'rotating', 30),
  ('l31', 'Rotating catalog fact check slot B: question per run in ledlenser.ai_probe_plan', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, 'rotating', 30),
  ('l32', 'Rotating catalog fact check slot C: question per run in ledlenser.ai_probe_plan', 'hallucinations', 'probe', 'product_fact_probe', 'excluded', true, 'rotating', 30);
