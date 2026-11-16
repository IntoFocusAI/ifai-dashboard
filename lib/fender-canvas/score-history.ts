import { historyViewMissing } from "@/lib/ai-search/history-queries";
import { formatDay } from "@/lib/ai-search/history-eligibility";

/**
 * Score history (decision 94): one saved row per client per week in public.canvas_score_snapshots,
 * written by the weekly save (scripts/save-score-snapshots.ts). The dashboard only reads it.
 */
export const SCORE_SNAPSHOT_TABLE = "canvas_score_snapshots";

export const SCORE_SNAPSHOT_COLUMNS =
  "client_key,week_start,saved_at,consensus_score,foundation_score,commerce_score,actuation_score";

export type ScoreSnapshotRow = {
  client_key: string;
  /** Monday of the saved week (UTC), YYYY-MM-DD. */
  week_start: string;
  saved_at: string;
  consensus_score: number | string | null;
  foundation_score: number | string | null;
  commerce_score: number | string | null;
  actuation_score: number | string | null;
};

/**
 * Absent: the table is not in the database yet, or holds no saved week for this client. The chart
 * section shows nothing then, and the page does not error.
 */
export type ScoreHistoryRead =
  | { phase: "loading" }
  | { phase: "absent" }
  | { phase: "error"; message: string }
  | { phase: "ready"; rows: ScoreSnapshotRow[] };

type DbError = { code?: string; message: string } | null;

type QueryResult = PromiseLike<{ data: unknown[] | null; error: DbError }>;

/** The slice of a Supabase client this read uses. */
export type ScoreHistoryClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): QueryResult;
      };
    };
  };
};

export async function loadScoreHistory(client: ScoreHistoryClient, clientKey: string): Promise<ScoreHistoryRead> {
  try {
    const { data, error } = await client
      .from(SCORE_SNAPSHOT_TABLE)
      .select(SCORE_SNAPSHOT_COLUMNS)
      .eq("client_key", clientKey)
      .order("week_start", { ascending: true });
    if (error) {
      return historyViewMissing(error) ? { phase: "absent" } : { phase: "error", message: error.message };
    }
    const rows = (data ?? []) as ScoreSnapshotRow[];
    return rows.length > 0 ? { phase: "ready", rows } : { phase: "absent" };
  } catch (error) {
    return { phase: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

export type ScoreSeriesKey = "consensus" | "foundation" | "commerce" | "actuation";

export type ScoreHistoryPoint = { week: string; score: number };

export type ScoreHistorySeries = { key: ScoreSeriesKey; label: string; points: ScoreHistoryPoint[] };

export type ScoreHistoryModel = {
  /** Every saved week, oldest first. */
  weeks: string[];
  /** Only scores with at least one saved point. AI Actuation has none until it is scored. */
  series: ScoreHistorySeries[];
  /** The first saved week. */
  savingStarted: string;
};

const SERIES: Array<{ key: ScoreSeriesKey; label: string; column: keyof ScoreSnapshotRow }> = [
  { key: "consensus", label: "AI Consensus", column: "consensus_score" },
  { key: "foundation", label: "AI Foundation", column: "foundation_score" },
  { key: "commerce", label: "AI Commerce", column: "commerce_score" },
  { key: "actuation", label: "AI Actuation", column: "actuation_score" },
];

function scoreValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** The chart's lines from the saved rows. Null when there is no saved week. Nothing is filled in between weeks. */
export function scoreHistoryModel(rows: readonly ScoreSnapshotRow[]): ScoreHistoryModel | null {
  const sorted = [...rows].filter((row) => typeof row.week_start === "string").sort((a, b) => a.week_start.localeCompare(b.week_start));
  if (sorted.length === 0) return null;
  const weeks = [...new Set(sorted.map((row) => row.week_start.slice(0, 10)))];
  const series = SERIES.map(({ key, label, column }) => ({
    key,
    label,
    points: sorted.flatMap((row) => {
      const score = scoreValue(row[column]);
      return score == null ? [] : [{ week: row.week_start.slice(0, 10), score }];
    }),
  })).filter((line) => line.points.length > 0);
  return { weeks, series, savingStarted: weeks[0] };
}

/** "Week of Nov 16, 2026". */
export function weekLabel(week: string): string {
  return `Week of ${formatDay(week)}`;
}

/** The title tooltip: how the history is kept, and when saving started. */
export function scoreHistoryTip(model: ScoreHistoryModel): string {
  const count = model.weeks.length;
  const saved = count === 1 ? "One week is saved so far." : `${count} weeks are saved.`;
  return `Each point is the score as saved once a week, on Monday. Saving started the week of ${formatDay(model.savingStarted)}. ${saved} Nothing is filled in between saved weeks.`;
}
