// Rank-to-units curve: what a listing with a given Amazon sales rank sells, read from listings in the
// same Amazon category whose sales SmartScout does track (decision 112).
//
// Method, in plain language: take every listing SmartScout tracks that also has a sales rank. Group
// them into bands of similar rank. A band's figure is the average units those listings sold per 30
// days in stock, counting the ones that sold nothing. A listing SmartScout does not track is then
// assumed to sell what tracked listings in its band sell.
//
// Why bands and not a fitted line: Amazon does not publish the relation. The published work (see
// benchmarks.ts, RANK_CURVE_METHOD_SOURCES) finds units fall as a power of rank, but a line fitted
// only to listings that sell overstates the long tail many times over: on Fender's catalog it puts
// 73 units a month on 100 listings ranked 160,000 to 320,000 that SmartScout says sold 1. Averages
// that include the zeros do not have that fault. They also absorb variation families, where several
// listings share one rank.
//
// The range is the band average plus or minus two standard errors (never below zero).

/** One calibration listing: its sales rank and units sold per 30 in-stock days (0 when it sold nothing). */
export type RankCurvePoint = { rank: number; unitsPer30InStockDays: number };

export type RankCurveBand = {
  /** Listings ranked at or better than this fall in the band. The last band has no limit. */
  maxRank: number;
  /** Tracked listings behind the band's average. */
  listings: number;
  /** Units per 30 in-stock days. */
  low: number;
  mid: number;
  high: number;
};

export type RankCurve = {
  /** The Amazon category the ranks are counted in. */
  category: string;
  /** The date the calibration listings were read. */
  calibratedOn: string;
  /** Tracked listings used. */
  listings: number;
  /** Where the calibration listings came from, in words. */
  basis: string;
  /**
   * The worst rank among the tracked listings. A listing ranked worse than this has no tracked
   * listing to compare with, so it is not estimated.
   */
  maxCalibratedRank: number;
  bands: RankCurveBand[];
};

/** Fewer tracked listings than this and there is no curve: the listing reads Not available*. */
export const RANK_CURVE_MIN_LISTINGS = 20;
/** A band needs at least this many tracked listings; smaller bands join their neighbor. */
export const RANK_CURVE_MIN_BAND = 10;

type Group = { maxRank: number; values: number[] };

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardError(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance / values.length);
}

function merge(a: Group, b: Group): Group {
  return { maxRank: Math.max(a.maxRank, b.maxRank), values: [...a.values, ...b.values] };
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

/**
 * Builds the band table from tracked listings. Returns null when there are too few.
 * Steps: bands double in width from rank 1,000; a band with under RANK_CURVE_MIN_BAND listings, or
 * with no listing that sold, joins the next better-ranked band; then any band that averages more
 * than a better-ranked band is pooled with it, so units never rise as rank worsens.
 */
export function calibrateRankCurve(
  points: RankCurvePoint[],
  meta: { category: string; calibratedOn: string; basis: string },
): RankCurve | null {
  const clean = points.filter(
    (p) => Number.isFinite(p.rank) && p.rank > 0 && Number.isFinite(p.unitsPer30InStockDays) && p.unitsPer30InStockDays >= 0,
  );
  if (clean.length < RANK_CURVE_MIN_LISTINGS) return null;

  // 1. Doubling bands.
  const byEdge = new Map<number, number[]>();
  for (const p of clean) {
    let edge = 1000;
    while (p.rank > edge) edge *= 2;
    byEdge.set(edge, [...(byEdge.get(edge) ?? []), p.unitsPer30InStockDays]);
  }
  const groups: Group[] = [...byEdge.entries()].sort((a, b) => a[0] - b[0]).map(([maxRank, values]) => ({ maxRank, values }));

  // 2. Thin bands, and bands where nothing sold, join the better-ranked neighbor (the first band joins the next).
  const thin = (g: Group) => g.values.length < RANK_CURVE_MIN_BAND || !g.values.some((v) => v > 0);
  for (let i = groups.length - 1; i >= 1; i--) {
    if (thin(groups[i])) groups.splice(i - 1, 2, merge(groups[i - 1], groups[i]));
  }
  while (groups.length > 1 && thin(groups[0])) groups.splice(0, 2, merge(groups[0], groups[1]));

  // 3. Units never rise as rank worsens: pool neighbors that break the order.
  let pooled = true;
  while (pooled) {
    pooled = false;
    for (let i = 0; i < groups.length - 1; i++) {
      if (mean(groups[i + 1].values) > mean(groups[i].values)) {
        groups.splice(i, 2, merge(groups[i], groups[i + 1]));
        pooled = true;
        break;
      }
    }
  }

  const bands = groups.map((g, i): RankCurveBand => {
    const mid = mean(g.values);
    const se = standardError(g.values);
    return {
      maxRank: i === groups.length - 1 ? Number.POSITIVE_INFINITY : g.maxRank,
      listings: g.values.length,
      low: round4(Math.max(0, mid - 2 * se)),
      mid: round4(mid),
      high: round4(mid + 2 * se),
    };
  });
  return { ...meta, listings: clean.length, maxCalibratedRank: Math.max(...clean.map((p) => p.rank)), bands };
}

/** The band a rank falls in, or null when the rank is worse than any tracked listing's. */
export function rankCurveBand(curve: RankCurve, rank: number): RankCurveBand | null {
  if (!(rank > 0) || rank > curve.maxCalibratedRank) return null;
  return curve.bands.find((b) => rank <= b.maxRank) ?? curve.bands[curve.bands.length - 1];
}
