import { questionRole } from "@/lib/ai-search/question-role";
import {
  callOutcome,
  categoryLabel,
  engineLabel,
  isCommercial,
  tallyCommercial,
} from "@/lib/ai-search/run-metrics";
import type { AiCallRow } from "@/lib/ai-search/types";
import { leadBrand } from "@/lib/brand-copy";

/** Unbranded discovery rows only (commercial buying prompts that name no brand). */
export function isUnbrandedDiscovery(row: AiCallRow): boolean {
  return isCommercial(row) && questionRole(row) === "unbranded_discovery";
}

/** Answered unbranded discovery rows with a clear leader. Probes, errors, and unresolved rows are out. */
export function resolvedUnbrandedDiscovery(rows: AiCallRow[]): AiCallRow[] {
  return rows.filter((row) => {
    if (!isUnbrandedDiscovery(row)) return false;
    const outcome = callOutcome(row);
    return outcome === "fender_win" || outcome === "fender_win_disqualified" || outcome === "competitor_win";
  });
}

export type CompetitorTally = {
  brand: string;
  wins: number;
  /** Resolved unbranded discovery answers in the whole run, the denominator for `wins`. */
  resolved: number;
  byCategory: Array<{ category: string; wins: number; resolved: number }>;
  byEngine: Array<{ engine: string; wins: number; resolved: number }>;
};

function countBy(rows: AiCallRow[], keyOf: (row: AiCallRow) => string) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(keyOf(row), (map.get(keyOf(row)) ?? 0) + 1);
  return map;
}

export function competitorTallies(rows: AiCallRow[]): CompetitorTally[] {
  const resolved = resolvedUnbrandedDiscovery(rows);
  const resolvedByCategory = countBy(resolved, (row) => row.category ?? "");
  const resolvedByEngine = countBy(resolved, (row) => (row.engine ?? "").toLowerCase());
  const losses = resolved.filter((row) => callOutcome(row) === "competitor_win");

  const brands = new Map<string, AiCallRow[]>();
  for (const row of losses) {
    const brand = row.primary_brand?.trim() || "Brand not recorded";
    brands.set(brand, [...(brands.get(brand) ?? []), row]);
  }

  return [...brands.entries()]
    .map(([brand, wins]) => ({
      brand,
      wins: wins.length,
      resolved: resolved.length,
      byCategory: [...countBy(wins, (row) => row.category ?? "").entries()]
        .map(([category, n]) => ({ category, wins: n, resolved: resolvedByCategory.get(category) ?? 0 }))
        .sort((a, b) => b.wins - a.wins || a.category.localeCompare(b.category)),
      byEngine: [...countBy(wins, (row) => (row.engine ?? "").toLowerCase()).entries()]
        .map(([engine, n]) => ({ engine, wins: n, resolved: resolvedByEngine.get(engine) ?? 0 }))
        .sort((a, b) => b.wins - a.wins || a.engine.localeCompare(b.engine)),
    }))
    .sort((a, b) => b.wins - a.wins || a.brand.localeCompare(b.brand));
}

export type CategoryBattle = {
  category: string;
  resolved: number;
  fenderWins: number;
  competitorWins: number;
  unresolved: number;
  errors: number;
  leaders: Array<{ brand: string; wins: number }>;
};

/** Per unbranded discovery category: who out-mentions Fender/Squier, and how often. */
export function categoryBattles(rows: AiCallRow[]): CategoryBattle[] {
  const byCategory = new Map<string, AiCallRow[]>();
  for (const row of rows.filter(isUnbrandedDiscovery)) {
    const key = row.category ?? "";
    byCategory.set(key, [...(byCategory.get(key) ?? []), row]);
  }
  return [...byCategory.entries()]
    .map(([category, bucket]) => {
      const tally = tallyCommercial(bucket);
      const leaders = [
        ...countBy(
          bucket.filter((row) => callOutcome(row) === "competitor_win"),
          (row) => row.primary_brand?.trim() || "Brand not recorded",
        ).entries(),
      ]
        .map(([brand, wins]) => ({ brand, wins }))
        .sort((a, b) => b.wins - a.wins || a.brand.localeCompare(b.brand));
      return {
        category,
        resolved: tally.resolved,
        fenderWins: tally.fenderWins,
        competitorWins: tally.competitorWins,
        unresolved: tally.unresolved,
        errors: tally.errors,
        leaders,
      };
    })
    .sort((a, b) => b.competitorWins - a.competitorWins || a.category.localeCompare(b.category));
}

/** The category where competitors lead the most resolved unbranded discovery answers, if any lead at all. */
export function largestCompetitorGap(rows: AiCallRow[]): CategoryBattle | null {
  const top = categoryBattles(rows)[0];
  return top && top.competitorWins > 0 ? top : null;
}

export function joinBrands(brands: string[]): string {
  if (brands.length <= 1) return brands[0] ?? "";
  if (brands.length === 2) return `${brands[0]} and ${brands[1]}`;
  return `${brands.slice(0, -1).join(", ")}, and ${brands[brands.length - 1]}`;
}

export function battleSentence(battle: CategoryBattle): string {
  const names = joinBrands(battle.leaders.map((leader) => leader.brand));
  return `${names} out-mention ${leadBrand()} in ${battle.competitorWins} of ${battle.resolved} resolved unbranded discovery ${categoryLabel(battle.category).toLowerCase()} answers`;
}

export function engineSpread(rows: AiCallRow[]): string {
  const engines = [...new Set(rows.map((row) => engineLabel(row.engine)))].sort();
  return joinBrands(engines);
}
