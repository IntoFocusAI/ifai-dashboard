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
