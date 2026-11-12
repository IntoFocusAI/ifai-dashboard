import type { ClientKey } from "@/lib/client/active-client";

/**
 * Question roles a client's prompt battery stores. Ledlenser's battery records each prompt's
 * role in ledlenser.ai_prompts.analytical_intent
 * (supabase/migrations/20261104170100_ledlenser_prompt_battery.sql). The canvas views do not
 * return that column, so the roles are mirrored here, keyed by the prompt's wording: an edited
 * prompt no longer matches and falls back to the text rules in question-role.ts.
 *
 * Fender's battery stores no role, so Fender has no entry and keeps the text rules.
 * The durable source is the column itself, once the canvas views return it (Brian Watson).
 */
export type StoredQuestionRole =
  | "unbranded_discovery"
  | "brand_associated_discovery"
  | "branded_consideration"
  | "shopping_guidance"
  | "product_fact";

const LEDLENSER: ReadonlyArray<readonly [string, StoredQuestionRole]> = [
  ["Best rechargeable headlamp for backpacking and hiking", "unbranded_discovery"], // l01
  ["Brightest headlamp for night trail running", "unbranded_discovery"], // l02
  ["Best headlamp for electricians and contractors", "unbranded_discovery"], // l03
  ["Best headlamp with a focusable beam that switches between spot and flood", "brand_associated_discovery"], // l04
  ["Ledlenser H7R vs Petzl Swift RL headlamp", "branded_consideration"], // l05
  ["Is the Ledlenser HF8R a good headlamp for camping?", "branded_consideration"], // l06
  ["How long does the Ledlenser H19R battery last on its highest setting?", "product_fact"], // l07
  ["Best rechargeable EDC flashlight under $100", "unbranded_discovery"], // l08
  ["Best high-lumen flashlight for search and rescue", "unbranded_discovery"], // l09
  ["Best compact keychain flashlight that charges with USB-C", "unbranded_discovery"], // l10
  ["Best tactical flashlight for law enforcement", "unbranded_discovery"], // l11
  ["Ledlenser P7R vs Olight Warrior 3S flashlight", "branded_consideration"], // l12
  ["Is the Ledlenser P5R worth it?", "branded_consideration"], // l13
  ["What is the beam distance of the Ledlenser P7R?", "product_fact"], // l14
  ["Best rechargeable work light for auto mechanics", "unbranded_discovery"], // l15
  ["Best LED floodlight for construction job sites", "unbranded_discovery"], // l16
  ["Best pen light for home inspectors", "unbranded_discovery"], // l17
  ["Ledlenser W5R Work vs Milwaukee rechargeable work light", "branded_consideration"], // l18
  ["Best rechargeable camping lantern for a tent", "unbranded_discovery"], // l19
  ["Best warm white camping lantern that does not attract bugs", "unbranded_discovery"], // l20
  ["Ledlenser ML6 vs Black Diamond Apollo lantern", "branded_consideration"], // l21
  ["Best headlamp for kids going camping", "unbranded_discovery"], // l22
  ["Safest flashlight for a young child", "unbranded_discovery"], // l23
  ["Ledlenser vs Petzl: which headlamp brand is better?", "branded_consideration"], // l24
  ["Is Ledlenser a good flashlight brand?", "branded_consideration"], // l25
  ["Fenix vs Nitecore vs Ledlenser rechargeable headlamps", "branded_consideration"], // l26
  ["Best German-engineered flashlight brand", "brand_associated_discovery"], // l27
  ["How many lumens do I need in a headlamp for hiking?", "shopping_guidance"], // l28
  ["What IP rating should a camping flashlight have?", "shopping_guidance"], // l29
];

function wording(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

const STORED: Partial<Record<ClientKey, ReadonlyMap<string, StoredQuestionRole>>> = {
  ledlenser: new Map(LEDLENSER.map(([text, role]) => [wording(text), role])),
};

/** The role the client's battery stores for this wording, or null when it stores none. */
export function storedQuestionRole(client: ClientKey, prompt: string | null | undefined): StoredQuestionRole | null {
  if (!prompt) return null;
  return STORED[client]?.get(wording(prompt)) ?? null;
}
