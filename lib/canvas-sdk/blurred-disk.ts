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

/**
 * Radial-gradient stops that trace a disk of `radius` blurred with a Gaussian of `sigma`, the
 * way Chrome draws `filter: drop-shadow(0 0 <sigma>px ...)` on an SVG shape (the length is the
 * standard deviation, in the shape's own units). Offsets are shares of `reach`, the radius of
 * the circle the gradient fills.
 */
export function blurredDiskStops(radius: number, sigma: number) {
  const reach = radius + sigma * 3;
  const stops: { offset: number; opacity: number }[] = [];
  for (let d = Math.max(0, radius - sigma * 3); d <= reach + 1e-6; d += sigma / 2) {
    stops.push({ offset: d / reach, opacity: blurredDiskOpacity(radius, sigma, d) });
  }
  return { reach, stops };
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

function auraAt(share: number): [number, number, number, number] {
  if (share >= 1) return [0, 0, 0, 0];
  const upper = AURA.findIndex((stop) => stop.at >= share);
  const a = AURA[Math.max(0, upper - 1)];
  const b = AURA[upper];
  const t = b.at === a.at ? 0 : (share - a.at) / (b.at - a.at);
  const opacity = a.opacity + (b.opacity - a.opacity) * t;
  return [0, 1, 2].map((c) => (a.color[c] + (b.color[c] - a.color[c]) * t) * opacity).concat(opacity) as [number, number, number, number];
}

/**
 * Radial-gradient stops for the breathing halo: the `luxHubAura` fill on a circle of `radius`,
 * plus an optional 1px `ring` stroke on its edge, blurred with a Gaussian of `sigma`, the way the
 * halo looked under `filter: url(#auraBlur)`. Offsets are shares of `reach`.
 */
export function blurredAuraStops(radius: number, sigma: number, ring?: Rgb) {
  const reach = radius + sigma * 3;
  const step = sigma / 8;
  const stops: { offset: number; color: string; opacity: number }[] = [];
  const distances = [0];
  for (let k = Math.ceil(reach / (sigma / 2)) - 1; k >= 0; k -= 1) distances.push(reach - k * (sigma / 2));
  for (const d of distances) {
    const sum = [0, 0, 0, 0];
    const from = Math.max(0, d - sigma * 5);
    const to = Math.min(radius, d + sigma * 5);
    const slices = Math.max(1, Math.ceil((to - from) / step));
    const width = (to - from) / slices;
    for (let i = 0; i < slices && to > from; i += 1) {
      const rho = from + (i + 0.5) * width;
      const k = ringKernel(rho, sigma, d) * width;
      auraAt(rho / radius).forEach((value, c) => {
        sum[c] += value * k;
      });
    }
    if (ring) {
      const k = ringKernel(radius, sigma, d);
      ring.forEach((value, c) => {
        sum[c] += value * k;
      });
      sum[3] += k;
    }
    const opacity = Math.min(1, sum[3]);
    const color = sum[3] > 1e-6 ? sum.slice(0, 3).map((value) => Math.round(Math.min(255, value / sum[3]))) : [99, 102, 241];
    stops.push({ offset: d / reach, color: `rgb(${color.join(" ")})`, opacity });
  }
  return { reach, stops };
}
