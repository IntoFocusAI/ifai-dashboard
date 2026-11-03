/**
 * The active prompt battery stored in command.fmic_ai_prompts.
 * History gaps are pairs from this battery that a run did not store.
 * A run whose stored wording differs is a question-set change, not a gap.
 */

export const BATTERY_ENGINES = ["chatgpt", "gemini", "perplexity"] as const;

export type BatteryEngine = (typeof BATTERY_ENGINES)[number];

export type BatteryPrompt = {
  key: string;
  text: string;
  category: string;
  kind: "commercial" | "probe";
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
  for (const call of calls) {
    const prompt = batteryPrompt(call.prompt_key);
    if (!prompt) return [];
    if (call.prompt_kind !== "probe" && call.prompt && call.prompt !== prompt.text) return [];
    present.add(`${prompt.key}|${(call.engine ?? "").toLowerCase()}`);
  }
  if (present.size === 0) return [];
  const gaps: BatteryGap[] = [];
  for (const prompt of PROMPT_BATTERY) {
    for (const engine of BATTERY_ENGINES) {
      if (present.has(`${prompt.key}|${engine}`)) continue;
      gaps.push({ promptKey: prompt.key, engine, promptText: prompt.text, promptKind: prompt.kind });
    }
  }
  return gaps;
}
