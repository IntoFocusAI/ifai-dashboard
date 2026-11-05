/** Error function (Abramowitz and Stegun 7.1.26). */
function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const value = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? value : -value;
}

/** Opacity at `distance` from the center of a solid disk of `radius` blurred with a Gaussian of `sigma`. */
export function blurredDiskOpacity(radius: number, sigma: number, distance: number) {
  const slices = Math.ceil((2 * radius) / (sigma / 8));
  const step = (2 * radius) / slices;
  let total = 0;
  for (let i = 0; i < slices; i += 1) {
    const x = -radius + (i + 0.5) * step;
    const half = Math.sqrt(radius * radius - x * x);
    const across = erf(half / (sigma * Math.SQRT2));
    const along = Math.exp(-((distance - x) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
    total += along * across * step;
  }
  return Math.min(1, total);
}

const diskCache = new Map<string, { reach: number; stops: { offset: number; opacity: number }[] }>();

/**
 * Radial-gradient stops that trace a disk of `radius` blurred with a Gaussian of `sigma`, the
 * way Chrome draws `filter: drop-shadow(0 0 <sigma>px ...)` on an SVG shape (the length is the
 * standard deviation, in the shape's own units). Offsets are shares of `reach`, the radius of
 * the circle the gradient fills. Results are cached, since every map render asks again.
 */
export function blurredDiskStops(radius: number, sigma: number) {
  const key = `${radius}|${sigma}`;
  const cached = diskCache.get(key);
  if (cached) return cached;
  const reach = radius + sigma * 3;
  const stops: { offset: number; opacity: number }[] = [];
  for (let d = Math.max(0, radius - sigma * 3); d <= reach + 1e-6; d += sigma / 2) {
    stops.push({ offset: d / reach, opacity: blurredDiskOpacity(radius, sigma, d) });
  }
  const result = { reach, stops };
  diskCache.set(key, result);
  return result;
}

type Rgb = readonly [number, number, number];

/** The map's `luxHubAura` gradient, as shares of the halo radius. */
const AURA: { at: number; color: Rgb; opacity: number }[] = [
  { at: 0, color: [0, 240, 255], opacity: 0.55 },
  { at: 0.55, color: [99, 102, 241], opacity: 0.28 },
  { at: 1, color: [99, 102, 241], opacity: 0 },
];

/** Bessel I0(x) * e^-x (Abramowitz and Stegun 9.8.1 and 9.8.2). */
function besselI0Scaled(x: number) {
  if (x < 3.75) {
    const t = (x / 3.75) ** 2;
    const i0 = 1 + t * (3.5156229 + t * (3.0899424 + t * (1.2067492 + t * (0.2659732 + t * (0.0360768 + t * 0.0045813)))));
    return i0 * Math.exp(-x);
  }
  const t = 3.75 / x;
  const poly =
    0.39894228 +
    t * (0.01328592 + t * (0.00225319 + t * (-0.00157565 + t * (0.00916281 + t * (-0.02057706 + t * (0.02635537 + t * (-0.01647633 + t * 0.00392377)))))));
  return poly / Math.sqrt(x);
}

/** Share of a thin ring of `ringRadius` that a Gaussian of `sigma` spreads to `distance` from the center, per unit of ring width. */
function ringKernel(ringRadius: number, sigma: number, distance: number) {
  const s2 = sigma * sigma;
  return (ringRadius / s2) * Math.exp(-((ringRadius - distance) ** 2) / (2 * s2)) * besselI0Scaled((ringRadius * distance) / s2);
}

/** Premultiplied red, green, blue, and opacity of the aura at `share` of its radius. */
function auraAt(share: number, out: Float64Array, at: number) {
  let upper = 1;
  while (upper < AURA.length - 1 && AURA[upper].at < share) upper += 1;
  const a = AURA[upper - 1];
  const b = AURA[upper];
  const t = Math.min(1, (share - a.at) / (b.at - a.at));
  const opacity = a.opacity + (b.opacity - a.opacity) * t;
  for (let c = 0; c < 3; c += 1) out[at + c] = (a.color[c] + (b.color[c] - a.color[c]) * t) * opacity;
  out[at + 3] = opacity;
}

type AuraStops = { reach: number; stops: { offset: number; color: string; opacity: number }[] };
const auraCache = new Map<string, AuraStops>();

/**
 * Radial-gradient stops for the breathing halo: the `luxHubAura` fill on a circle of `radius`,
 * plus an optional 1px `ring` stroke on its edge, blurred with a Gaussian of `sigma`, the way the
 * halo looked under `filter: url(#auraBlur)`. Offsets are shares of `reach`. Results are cached,
 * since every map render asks again.
 */
export function blurredAuraStops(radius: number, sigma: number, ring?: Rgb): AuraStops {
  const key = `${radius}|${sigma}|${ring?.join(",") ?? ""}`;
  const cached = auraCache.get(key);
  if (cached) return cached;
  const reach = radius + sigma * 3;
  const slices = Math.ceil(radius / (sigma / 8));
  const width = radius / slices;
  const source = new Float64Array(slices * 4);
  for (let i = 0; i < slices; i += 1) auraAt((i + 0.5) / slices, source, i * 4);
  // Inside the blur's reach the aura is two straight ramps, so its corners carry it there.
  const edge = radius - sigma * 3;
  const distances = [0, ...(AURA[1].at * radius < edge ? [AURA[1].at * radius] : [])];
  for (let d = edge > 0 ? edge : sigma * 0.75; d < reach + 1e-6; d += sigma * 0.75) distances.push(d);
  const stops = distances.map((d) => {
    const sum = [0, 0, 0, 0];
    const first = Math.max(0, Math.floor((d - sigma * 5) / width));
    const last = Math.min(slices - 1, Math.ceil((d + sigma * 5) / width));
    for (let i = first; i <= last; i += 1) {
      const k = ringKernel((i + 0.5) * width, sigma, d) * width;
      for (let c = 0; c < 4; c += 1) sum[c] += source[i * 4 + c] * k;
    }
    if (ring) {
      const k = ringKernel(radius, sigma, d);
      for (let c = 0; c < 3; c += 1) sum[c] += ring[c] * k;
      sum[3] += k;
    }
    const color = sum[3] > 1e-6 ? sum.slice(0, 3).map((value) => Math.round(Math.min(255, value / sum[3]))) : [99, 102, 241];
    return { offset: d / reach, color: `rgb(${color.join(" ")})`, opacity: Math.min(1, sum[3]) };
  });
  const result = { reach, stops };
  auraCache.set(key, result);
  return result;
}
