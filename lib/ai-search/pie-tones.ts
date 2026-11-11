/**
 * Chart colors for pies and stacked shares (brand book, decision 27): the measured slice in
 * ice blue, the rest gray, at most two blue series. Status colors never fill a chart slice.
 */

export type PieTone = "measured" | "second" | "rest";

type TonedSlice = { key: string; label?: string; tone?: PieTone };

/** Slices that are the figure the pie sits beside. */
const MEASURED_KEYS: ReadonlySet<string> = new Set(["cited", "owned", "fender_owned", "fender", "measured"]);

/** The one other series a pie may draw in blue: the top rival, or competitor-owned sites. */
const SECOND_KEYS: ReadonlySet<string> = new Set(["competitor_brand", "second"]);

/**
 * "matched" and "contradicted" are used by several views as a two-slice pair, in either
 * polarity: the slice the figure reads is listed first. A builder that knows better sets `tone`.
 */
const LEGACY_PAIR: ReadonlySet<string> = new Set(["matched", "contradicted"]);

const REST_LABEL = /^(rest|remainder)\b/i;

/** Grays for the slices that are not the measured figure, stepped so neighbors stay distinct. */
const REST_STEPS = [
  "var(--chart-rest)",
  "color-mix(in srgb, var(--chart-rest) 72%, var(--text-muted))",
  "color-mix(in srgb, var(--chart-rest) 48%, var(--text-muted))",
  "color-mix(in srgb, var(--chart-rest) 24%, var(--text-muted))",
  "color-mix(in srgb, var(--chart-rest) 84%, var(--text-main))",
  "color-mix(in srgb, var(--chart-rest) 60%, var(--text-main))",
] as const;

export const PIE_TONE_COLOR: Record<Exclude<PieTone, "rest">, string> = {
  measured: "var(--chart-measured)",
  second: "var(--chart-second)",
};

/** A slice's tone from its key alone, for a caller that draws one swatch outside a pie. */
export function keyTone(key: string): PieTone {
  if (MEASURED_KEYS.has(key) || key === "matched") return "measured";
  if (SECOND_KEYS.has(key)) return "second";
  return "rest";
}

/** Each slice's tone, in slice order. An explicit `tone` wins; one measured slice at most. */
export function sliceTones(slices: readonly TonedSlice[]): PieTone[] {
  let measuredTaken = false;
  let secondTaken = false;
  const pair = slices.filter((slice) => !slice.tone && LEGACY_PAIR.has(slice.key));
  return slices.map((slice) => {
    let tone: PieTone;
    if (slice.tone) tone = slice.tone;
    else if (MEASURED_KEYS.has(slice.key)) tone = "measured";
    else if (SECOND_KEYS.has(slice.key)) tone = "second";
    else if (LEGACY_PAIR.has(slice.key)) {
      const lone = pair.length === 1;
      tone = slice === pair[0] && !(lone && REST_LABEL.test(slice.label ?? "")) ? "measured" : "rest";
    } else tone = "rest";
    if (tone === "measured") {
      if (measuredTaken) return "rest";
      measuredTaken = true;
    }
    if (tone === "second") {
      if (secondTaken) return "rest";
      secondTaken = true;
    }
    return tone;
  });
}

/** One CSS color per slice, in slice order. */
export function sliceColors(slices: readonly TonedSlice[]): string[] {
  let rest = 0;
  return sliceTones(slices).map((tone) => {
    if (tone !== "rest") return PIE_TONE_COLOR[tone];
    const color = REST_STEPS[rest % REST_STEPS.length];
    rest += 1;
    return color;
  });
}

/** The color for one key drawn on its own (a legend swatch, a bar). */
export function keyColor(key: string): string {
  const tone = keyTone(key);
  return tone === "rest" ? REST_STEPS[0] : PIE_TONE_COLOR[tone];
}
