/**
 * The "Data as of" tooltip: one line per data source a client recognizes, with its last check
 * date, and "out of date" only on a source older than twice its normal check interval
 * (decisions 4 and 62). Collector job keys never reach the screen: each one maps to a source,
 * and a job this file does not name goes under the closest source by its key.
 */

import { AI_SEARCH_STALE_AFTER_DAYS } from "@/lib/ai-search/stale";
import { brandSite } from "@/lib/brand-copy";
import { activeClient } from "@/lib/client/active-client";
import { isPastCheckSchedule } from "@/lib/fender-canvas/canvas-reads";
import { RECHECK_DAYS } from "@/lib/fender-canvas/row-stale";
import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";

const DAY_MS = 86_400_000;

export type DataSourceId =
  | "ai_search"
  | "ai_api"
  | "amazon_offers"
  | "keepa_history"
  | "walmart"
  | "musiciansfriend"
  | "amazon_specs"
  | "amazon_sales"
  | "brand_site";

type SourceRule = {
  id: DataSourceId;
  label: () => string;
  /** Normal check interval in days. Out of date after twice this. */
  intervalDays: () => number;
  /** The collectors that read this source. Their latest run is the source's last check. */
  collectors: readonly string[];
  /** Collector jobs named by pattern, such as one lock per API run. */
  collectorPattern?: RegExp;
  /** The stored check time is a collector too (the API run tables), not only a fallback. */
  storedIsCollector?: boolean;
  /** Supporting jobs (locks, schedules, recomputes) that belong here but do not read the source. */
  support: RegExp;
};

/**
 * Display order: AI first, then Amazon, then the other retailers, then the brand site. Search and
 * API engines, and Buy Box and Keepa history, are separate lines so a stale part cannot hide behind
 * a fresh one (Brian Magazu, 16 Nov).
 */
const SOURCES: readonly SourceRule[] = [
  {
    id: "ai_search",
    label: () => "AI answers (search engines)",
    // AI Search runs every 2 to 3 days (decision 4); the asterisk rule uses 3.
    intervalDays: () => AI_SEARCH_STALE_AFTER_DAYS / 2,
    collectors: ["ai_simulations"],
    support: /^(ai_|subchat_|schedule_probe|claude_drift|mirror_drift|sandbox_drift)|probe|drift|battery|simulation/,
  },
  {
    id: "ai_api",
    label: () => "AI answers (API engines)",
    // The API job runs on the same 2 to 3 day rhythm as the search runs.
    intervalDays: () => AI_SEARCH_STALE_AFTER_DAYS / 2,
    collectors: [],
    collectorPattern: /^subchat_lock_.+_api$/,
    storedIsCollector: true,
    support: /_api$|api_run/,
  },
  {
    id: "amazon_offers",
    label: () => "Amazon Buy Box and offers",
    intervalDays: () => RECHECK_DAYS.buyBox,
    collectors: ["featured_offer_keepa", "buybox_seller_harvester", "catalog_harvester"],
    support: /^kpi_|buybox|buy_box|catalog|offer|amazon_price|keepa/,
  },
  {
    id: "keepa_history",
    label: () => "Keepa sales history",
    intervalDays: () => RECHECK_DAYS.keepa,
    collectors: ["keepa_history"],
    support: /keepa_hist|sales_history/,
  },
  {
    id: "walmart",
    label: () => "Walmart",
    intervalDays: () => (activeClient().key === "ledlenser" ? RECHECK_DAYS.walmartLedlenser : RECHECK_DAYS.walmartFender),
    collectors: ["map_leakage_walmart"],
    support: /walmart|wmt/,
  },
  {
    id: "musiciansfriend",
    label: () => "Musician's Friend",
    intervalDays: () => RECHECK_DAYS.musiciansFriend,
    collectors: ["map_parity_musiciansfriend"],
    support: /musiciansfriend|musicians_friend|_mf_|^mf_/,
  },
  {
    id: "amazon_specs",
    label: () => "Amazon specs and A+",
    intervalDays: () => RECHECK_DAYS.weekly,
    collectors: ["spec_readiness"],
    support: /spec|aplus|a_plus|listing_content|content/,
  },
  {
    id: "amazon_sales",
    label: () => "SmartScout sales estimates",
    intervalDays: () => RECHECK_DAYS.smartscout,
    collectors: ["smartscout_snapshot"],
    support: /smartscout|sales|units|stock/,
  },
  {
    id: "brand_site",
    label: () => `${brandSite()} pages`,
    // Spec and Findability checks are weekly (decision 4).
    intervalDays: () => RECHECK_DAYS.weekly,
    collectors: ["findability_recheck"],
    support: /findability|brand_site|official_page|site_page/,
  },
];

function isCollector(source: SourceRule, key: string): boolean {
  return source.collectors.includes(key) || (source.collectorPattern?.test(key) ?? false);
}

/** The source a collector job belongs to. A job no rule names goes to Amazon Buy Box and offers. */
export function sourceForJob(jobKey: string): DataSourceId {
  const key = jobKey.toLowerCase();
  const named = SOURCES.find((source) => isCollector(source, key));
  if (named) return named.id;
  const near = SOURCES.find((source) => source.support.test(key));
  return near?.id ?? "amazon_offers";
}

export type DataSourceFreshness = {
  id: DataSourceId;
  label: string;
  /** Last check as ISO, or null when no job for the source has run. */
  lastCheck: string | null;
  intervalDays: number;
  outOfDate: boolean;
};

function latest(times: (string | null)[]): string | null {
  let best: { iso: string; ms: number } | null = null;
  for (const iso of times) {
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) continue;
    if (!best || ms > best.ms) best = { iso, ms };
  }
  return best?.iso ?? null;
}

/**
 * One entry per source the client has, in display order. A source's last check is its
 * collectors' latest run. Without a collector row, the source's own stored check time
 * (`stored`, such as the newest Findability row check) stands in, then supporting jobs.
 * For API engines the stored time (the newest API run in the API run tables) counts beside
 * the run locks.
 */
export function dataSourceFreshness(
  rows: readonly CanvasFreshnessRow[],
  now: number = Date.now(),
  stored: Partial<Record<DataSourceId, string | null>> = {},
): DataSourceFreshness[] {
  const grouped = new Map<DataSourceId, { collector: (string | null)[]; other: (string | null)[] }>();
  for (const row of rows) {
    const id = sourceForJob(row.job_key);
    const rule = SOURCES.find((source) => source.id === id)!;
    const entry = grouped.get(id) ?? { collector: [], other: [] };
    (isCollector(rule, row.job_key.toLowerCase()) ? entry.collector : entry.other).push(row.last_run_at);
    grouped.set(id, entry);
  }
  return SOURCES.filter((source) => grouped.has(source.id) || stored[source.id]).map((source) => {
    const entry = grouped.get(source.id) ?? { collector: [], other: [] };
    const collector = source.storedIsCollector ? [...entry.collector, stored[source.id] ?? null] : entry.collector;
    const lastCheck = latest(collector) ?? stored[source.id] ?? latest(entry.other);
    const intervalDays = source.intervalDays();
    return {
      id: source.id,
      label: source.label(),
      lastCheck,
      intervalDays,
      outOfDate: lastCheck == null || isPastCheckSchedule(lastCheck, intervalDays * DAY_MS, now),
    };
  });
}

const CHECK_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "AI answers (search engines): last checked Nov 16, 2026" or "Walmart: last checked Nov 12, 2026, out of date". */
export function dataSourceLine(source: DataSourceFreshness): string {
  const when = source.lastCheck ? `last checked ${CHECK_DAY.format(new Date(source.lastCheck))}` : "not checked yet";
  return `${source.label}: ${when}${source.outOfDate ? ", out of date" : ""}`;
}

/** The newest API run that answered, from the client's API run tables: the API engines' last check. */
export function newestApiRunAt(
  runs: readonly { completed_at: string | null; started_at?: string | null; answered_calls: number | null }[],
): string | null {
  return latest(runs.filter((run) => (run.answered_calls ?? 0) > 0).map((run) => run.completed_at ?? run.started_at ?? null));
}

/** The newest check across the client's sources, for the visible "Data as of" label. */
export function dataAsOf(sources: readonly DataSourceFreshness[]): string | null {
  return latest(sources.map((source) => source.lastCheck));
}
