/**
 * The active prompt battery stored in command.fmic_ai_prompts.
 * History gaps are pairs from this battery that a run did not store.
 * A run whose stored wording differs is a question-set change, not a gap.
 * Wave 1 is the battery asked since 12 Oct 2026. Wave 2 (p38 to p67) joined in Nov 2026.
 * A run is only checked against the waves it asked, so a run from before wave 2 shows no wave 2 gaps.
 */

export const BATTERY_ENGINES = ["chatgpt", "gemini", "perplexity"] as const;

export type BatteryEngine = (typeof BATTERY_ENGINES)[number];

export type BatteryPrompt = {
  key: string;
  text: string;
  category: string;
  kind: "commercial" | "probe";
  /** When the prompt joined the battery. Omitted means wave 1. */
  wave?: 2;
};

export const PROMPT_BATTERY: readonly BatteryPrompt[] = [
  { key: "p01", text: "Best electric guitar under $900 for versatile tones", category: "electrics", kind: "commercial" },
  { key: "p02", text: "Fender American Professional II Stratocaster vs PRS Silver Sky SE", category: "electrics", kind: "commercial" },
  { key: "p03", text: "Is the Fender Player II Stratocaster good for beginners?", category: "electrics", kind: "commercial" },
  { key: "p04", text: "What are the pickup types on a Fender Player II Stratocaster?", category: "electrics", kind: "commercial" },
  { key: "p05", text: "Best guitar for indie rock under $1000", category: "electrics", kind: "commercial" },
  { key: "p06", text: "Best travel acoustic guitar for intermediate players", category: "acoustics", kind: "commercial" },
  { key: "p07", text: "Best beginner acoustic guitar under $250 with solid top", category: "acoustics", kind: "commercial" },
  { key: "p08", text: "Fender Acoustasonic Player Telecaster pickup types and sounds", category: "acoustics", kind: "commercial" },
  { key: "p09", text: "Best headphone guitar amp with bluetooth for quiet practice", category: "amps", kind: "commercial" },
  { key: "p10", text: "Fender Tone Master Deluxe Reverb tube types and biasing instructions", category: "amps", kind: "commercial" },
  { key: "p11", text: "Best professional bass guitar for recording and gigging under $1000", category: "basses", kind: "commercial" },
  { key: "p12", text: "Fender Player Precision Bass vs Sire Marcus Miller P5", category: "basses", kind: "commercial" },
  { key: "p13", text: "Best budget Stratocaster alternative for upgrading mod platform", category: "squier", kind: "commercial" },
  { key: "p14", text: "Is Squier Classic Vibe 60s Stratocaster good quality?", category: "squier", kind: "commercial" },
  { key: "p15", text: "What is the best first electric guitar for a total beginner?", category: "beginner", kind: "commercial" },
  { key: "p16", text: "Fender vs Yamaha for a beginner guitarist", category: "beginner", kind: "commercial" },
  { key: "p17", text: "Fender Player II Stratocaster neck radius and fret size", category: "hallucinations", kind: "probe" },
  { key: "p18", text: "What body wood does the Fender American Professional II Telecaster use?", category: "hallucinations", kind: "probe" },
  { key: "p19", text: "Does the Fender Mustang Micro amp have vacuum tubes?", category: "hallucinations", kind: "probe" },
  { key: "p20", text: "Fender Telecaster vs Gibson Les Paul for rock music", category: "electrics", kind: "commercial" },
  { key: "p21", text: "Best semi-hollow electric guitar under $1500", category: "electrics", kind: "commercial" },
  { key: "p22", text: "Fender CD-60S vs Yamaha FG800 for a beginner", category: "acoustics", kind: "commercial" },
  { key: "p23", text: "Boss Katana vs Fender Mustang for home practice", category: "amps", kind: "commercial" },
  { key: "p24", text: "Best 5-string bass guitar for gigging musicians", category: "basses", kind: "commercial" },
  { key: "p25", text: "Squier Affinity vs Squier Bullet Stratocaster differences", category: "squier", kind: "commercial" },
  { key: "p26", text: "How much should a beginner spend on their first guitar", category: "beginner", kind: "commercial" },
  { key: "p27", text: "What makes the Fender American Ultra II different from American Professional II", category: "electrics", kind: "commercial" },
  { key: "p28", text: "Best guitar for playing blues under $800", category: "electrics", kind: "commercial" },
  { key: "p29", text: "Best parlor acoustic guitar for small hands", category: "acoustics", kind: "commercial" },
  { key: "p30", text: "Positive Grid Spark vs Fender Mustang Micro comparison", category: "amps", kind: "commercial" },
  { key: "p31", text: "Fender Jazz Bass vs Precision Bass tonal differences", category: "basses", kind: "commercial" },
  { key: "p32", text: "Is Squier a good brand or just a cheap knockoff", category: "squier", kind: "commercial" },
  { key: "p33", text: "What is the scale length of a Fender Jaguar", category: "hallucinations", kind: "probe" },
  { key: "p34", text: "Does the Fender Player Plus Stratocaster have noiseless pickups", category: "hallucinations", kind: "probe" },
  // Wave 2: shopper variables (budget, player, genre and tone, upgrade moment, priority, question style).
  { key: "p38", text: "What is the best electric guitar for an intermediate player under $1,000?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p39", text: "What is the best electric guitar for a professional guitarist under $1,000?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p40", text: "What is the best electric guitar for an intermediate player under $500?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p41", text: "What is the best electric guitar for an intermediate player around $1,500?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p42", text: "What is the best electric guitar for an intermediate player with no budget limit?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p43", text: "What is the best electric guitar for an intermediate metal player under $1,000?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p44", text: "What is the best electric guitar for an intermediate jazz player under $1,000?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p45", text: "What is the best electric guitar for an intermediate country player under $1,000?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p46", text: "What is the best acoustic guitar for an intermediate player under $1,000?", category: "acoustics", kind: "commercial", wave: 2 },
  { key: "p47", text: "What is the best acoustic-electric guitar for playing live under $1,000?", category: "acoustics", kind: "commercial", wave: 2 },
  { key: "p48", text: "What is the best acoustic guitar for fingerstyle playing under $1,000?", category: "acoustics", kind: "commercial", wave: 2 },
  { key: "p49", text: "What is the best acoustic guitar for an intermediate player around $1,500?", category: "acoustics", kind: "commercial", wave: 2 },
  { key: "p50", text: "What is the best acoustic guitar for singer-songwriters under $1,000?", category: "acoustics", kind: "commercial", wave: 2 },
  { key: "p51", text: "What is the best guitar amp for an intermediate player under $500?", category: "amps", kind: "commercial", wave: 2 },
  { key: "p52", text: "What is the best tube amp for gigging under $1,000?", category: "amps", kind: "commercial", wave: 2 },
  { key: "p53", text: "What is the best amp for clean tones under $1,000?", category: "amps", kind: "commercial", wave: 2 },
  { key: "p54", text: "What is the best amp for high-gain metal under $1,000?", category: "amps", kind: "commercial", wave: 2 },
  { key: "p55", text: "What is the best modeling amp for home recording under $500?", category: "amps", kind: "commercial", wave: 2 },
  { key: "p56", text: "What is the best bass guitar for an intermediate player under $1,000?", category: "basses", kind: "commercial", wave: 2 },
  { key: "p57", text: "What is the best short-scale bass guitar under $500?", category: "basses", kind: "commercial", wave: 2 },
  { key: "p58", text: "What is the best bass guitar for metal under $1,000?", category: "basses", kind: "commercial", wave: 2 },
  { key: "p59", text: "What is the best bass guitar for a beginner under $500?", category: "basses", kind: "commercial", wave: 2 },
  { key: "p60", text: "Which brand makes the best electric guitars for intermediate players?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p61", text: "Which brand makes the best bass guitars?", category: "basses", kind: "commercial", wave: 2 },
  { key: "p62", text: "Which brand makes the best guitar amps?", category: "amps", kind: "commercial", wave: 2 },
  { key: "p63", text: "I'm upgrading from a Squier. What is the best electric guitar to buy next under $1,500?", category: "squier", kind: "commercial", wave: 2 },
  { key: "p64", text: "I'm upgrading from a Yamaha Pacifica. What is the best electric guitar to buy next under $1,500?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p65", text: "Which electric guitars under $1,500 hold their resale value best?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p66", text: "Which electric guitar brands have the best quality control?", category: "electrics", kind: "commercial", wave: 2 },
  { key: "p67", text: "Fender American Professional II vs Player II: is the upgrade worth the extra money?", category: "electrics", kind: "commercial", wave: 2 },
];

const BY_KEY = new Map(PROMPT_BATTERY.map((prompt) => [prompt.key, prompt]));

export function batteryPrompt(key: string | null | undefined): BatteryPrompt | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

export type BatteryGap = {
  promptKey: string;
  engine: BatteryEngine;
  promptText: string;
  promptKind: BatteryPrompt["kind"];
};

type GapCall = {
  prompt_key?: string | null;
  prompt?: string | null;
  engine?: string | null;
  prompt_kind?: string | null;
};

/**
 * Question-engine pairs in the current battery that this run did not store.
 * Returns nothing when the stored wording is a different question set, so a
 * future wording change stays a boundary rather than a list of fake gaps.
 * Fact checks match by key only: a rotating key names a different product in each repeat.
 */
export function batteryGaps(calls: readonly GapCall[]): BatteryGap[] {
  const present = new Set<string>();
  const waves = new Set<number>();
  for (const call of calls) {
    // API engines are not battery engines, so their calls neither fill nor open a gap.
    if (!BATTERY_ENGINES.includes((call.engine ?? "").toLowerCase() as BatteryEngine)) continue;
    const prompt = batteryPrompt(call.prompt_key);
    if (!prompt) return [];
    if (call.prompt_kind !== "probe" && call.prompt && call.prompt !== prompt.text) return [];
    present.add(`${prompt.key}|${(call.engine ?? "").toLowerCase()}`);
    waves.add(prompt.wave ?? 1);
  }
  if (present.size === 0) return [];
  const gaps: BatteryGap[] = [];
  for (const prompt of PROMPT_BATTERY) {
    if (!waves.has(prompt.wave ?? 1)) continue;
    for (const engine of BATTERY_ENGINES) {
      if (present.has(`${prompt.key}|${engine}`)) continue;
      gaps.push({ promptKey: prompt.key, engine, promptText: prompt.text, promptKind: prompt.kind });
    }
  }
  return gaps;
}
