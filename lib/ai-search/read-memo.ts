import { installedSiteTypes } from "@/lib/ai-search/site-types";
import { activeClientKey } from "@/lib/client/active-client";

/**
 * Remembers a figure computed from one read's rows. The date-pill window holds tens of thousands
 * of calls and citations, and the map, Summary, Minimal and the tour each compute the same run
 * summary from the same snapshot, so each is computed once per snapshot. A cached value is used
 * only while the brand and the stored site types it was computed under are still the ones in force;
 * a snapshot is never changed after it is read, so its identity stands for its rows.
 */
export function memoByRead<K extends object, V>(compute: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, { brand: string; siteTypes: object | null; value: V }>();
  return (key: K) => {
    const brand = activeClientKey();
    const siteTypes = installedSiteTypes();
    const hit = cache.get(key);
    if (hit && hit.brand === brand && hit.siteTypes === siteTypes) return hit.value;
    const value = compute(key);
    cache.set(key, { brand, siteTypes, value });
    return value;
  };
}
