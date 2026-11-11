import type { RoleGroupTally } from "@/lib/ai-search/question-role";

/** Engines with resolved unbranded answers, weakest Fender-lead share first. */
export function unbrandedEnginesWeakestFirst(engines: readonly RoleGroupTally[]): RoleGroupTally[] {
  return engines
    .filter((engine) => engine.roles.unbranded_discovery.resolved > 0)
    .slice()
    .sort((a, b) => {
      const aRate = a.roles.unbranded_discovery.fenderWins / a.roles.unbranded_discovery.resolved;
      const bRate = b.roles.unbranded_discovery.fenderWins / b.roles.unbranded_discovery.resolved;
      return aRate - bRate || a.key.localeCompare(b.key);
    });
}
