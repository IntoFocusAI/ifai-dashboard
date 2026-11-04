/** Standard normal CDF (Abramowitz and Stegun 7.1.26). */
function normalCdf(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Radial-gradient stops that trace the edge of a disk of `radius` blurred with a Gaussian of
 * `sigma` (a CSS drop-shadow blur of 2 × sigma). Offsets are shares of `reach`, the radius of
 * the circle the gradient fills.
 */
export function blurredDiskStops(radius: number, sigma: number) {
  const reach = radius + sigma * 3;
  const stops: { offset: number; opacity: number }[] = [];
  for (let d = Math.max(0, radius - sigma * 3); d <= reach + 1e-6; d += sigma / 2) {
    stops.push({ offset: d / reach, opacity: normalCdf((radius - d) / sigma) });
  }
  return { reach, stops };
}
