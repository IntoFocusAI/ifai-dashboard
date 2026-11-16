/**
 * Turns structured shopper details into one natural question, the same way every time.
 * Ported from Justin Hittell's Recommendation Lab (github.com/geneticmarauder/aeo,
 * src/main/services/promptRenderer.ts, MIT License, Copyright (c) 2026 GeneticMarauder).
 */

/** Where a detail goes in the sentence. */
export type Slot = "persona" | "constraint" | "clause" | "context" | "frame";

export const SLOTS: readonly Slot[] = ["persona", "constraint", "clause", "context", "frame"];

export const SLOT_LABELS: Record<Slot, string> = {
  persona: "Describes the shopper",
  constraint: "Follows the product",
  clause: "Follows “who”",
  context: "Sentence after the question",
  frame: "Question style",
};

export const SLOT_EXAMPLES: Record<Slot, string> = {
  persona: "…for an intermediate blues player",
  constraint: "…an electric guitar under $500",
  clause: "…who cares most about resale value",
  context: "…? I'm upgrading from a Squier.",
  frame: "Which brand makes the best {request}?",
};

export const DEFAULT_FRAME = "What is the best {request}?";

export type RenderVariable = { name: string; slot: Slot; template: string };

/** The product and the word for the shopper: "electric guitar", "player". */
export type RenderProduct = { item: string; personaNoun: string };

/** Variable name → chosen value. A missing or empty value leaves the detail out. */
export type Attributes = Record<string, string>;

export function article(phrase: string): "a" | "an" {
  const w = phrase.trim().toLowerCase();
  if (!w) return "a";
  if (/^(uni|use|usu|eu|one|once|ur)/.test(w)) return "a";
  if (/^(hour|honest|honor|heir|8|11|18)/.test(w)) return "an";
  return /^[aeiou]/.test(w) ? "an" : "a";
}

export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function applyTemplate(template: string, value: string): string {
  const t = template.includes("{value}") ? template : `${template} {value}`;
  return t.replaceAll("{value}", value).replace(/\s+/g, " ").trim();
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ensureSentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

/**
 * One question from the chosen details. Details apply in the order of `variables`, so the same
 * details always give the same sentence, and changing one detail changes only its phrase.
 */
export function renderPrompt(product: RenderProduct, variables: readonly RenderVariable[], attributes: Attributes): string {
  const persona: string[] = [];
  const constraints: string[] = [];
  const clauses: string[] = [];
  const context: string[] = [];
  let frame = DEFAULT_FRAME;

  for (const v of variables) {
    const value = attributes[v.name]?.trim();
    if (!value) continue;
    switch (v.slot) {
      case "persona":
        persona.push(applyTemplate(v.template, value));
        break;
      case "constraint":
        constraints.push(applyTemplate(v.template, value));
        break;
      case "clause":
        clauses.push(applyTemplate(v.template, value));
        break;
      case "context":
        context.push(ensureSentence(capitalizeFirst(applyTemplate(v.template, value))));
        break;
      case "frame":
        frame = applyTemplate(v.template, value);
        break;
    }
  }

  const item = product.item.trim() || "product";
  let request = [item, ...constraints].join(" ");
  const personaPhrase = [...persona, product.personaNoun.trim()].filter(Boolean).join(" ");
  if (personaPhrase) {
    request += ` for ${article(personaPhrase)} ${personaPhrase}`;
    if (clauses.length) request += ` who ${joinList(clauses)}`;
  } else if (clauses.length) {
    request += ` for someone who ${joinList(clauses)}`;
  }

  const aRequest = `${article(request)} ${request}`;
  let sentence =
    frame.includes("{request}") || frame.includes("{a_request}")
      ? frame.replaceAll("{a_request}", aRequest).replaceAll("{request}", request)
      : `${ensureSentence(frame)} ${capitalizeFirst(aRequest)}.`;
  sentence = capitalizeFirst(ensureSentence(sentence.replace(/\s+/g, " ").trim()));
  return [sentence, ...context].join(" ");
}
