import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

/**
 * The change history of the AI Search prompt list (FDD A-08). Rows come only from
 * command.fmic_ai_prompt_edits, through public.ai_prompt_edits_list
 * (supabase/migrations/20261109233000_ai_prompt_edits_list.sql). Until that function is applied
 * the screen says the history is not available. It never builds history rows from anything else.
 */

/** Shown beside the history. A published run keeps the prompt set hash it asked. */
export const PROMPT_HISTORY_NOTE = "A run keeps the questions it asked. A later edit does not change that run.";

export const PROMPT_HISTORY_TITLE = "Change history";

export const PROMPT_HISTORY_UNAVAILABLE = "Not available*";

/** Why the history reads Not available*. The reason stays in the tooltip. */
export const PROMPT_HISTORY_TIPS = {
  missing:
    "The prompt change history is stored, and the read that shows it here is not applied to the database yet. No change is shown until it is.",
  failed: "The prompt change log could not be read. No change is shown.",
} as const;

/** One side of a row in command.fmic_ai_prompt_edits (before or after). */
export type PromptEditSnapshot = {
  prompt_text?: string;
  category?: string;
  prompt_kind?: string;
  active?: boolean;
};

/** One stored change, as public.ai_prompt_edits_list returns it. */
export type PromptEditRow = {
  id: string;
  edited_at: string;
  action: string;
  prompt_key: string;
  before: PromptEditSnapshot | null;
  after: PromptEditSnapshot | null;
};

export type PromptEditHistory =
  | { status: "ready"; rows: PromptEditRow[] }
  | { status: "unavailable"; reason: keyof typeof PROMPT_HISTORY_TIPS };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** null is an empty side (an add has no before). A non-object is not a log row. */
function snapshotFrom(value: unknown): PromptEditSnapshot | null | undefined {
  if (value == null) return null;
  if (!isRecord(value)) return undefined;
  const snap: PromptEditSnapshot = {};
  for (const key of ["prompt_text", "category", "prompt_kind"] as const) {
    if (!(key in value)) continue;
    if (typeof value[key] !== "string") return undefined;
    snap[key] = value[key];
  }
  if ("active" in value) {
    if (typeof value.active !== "boolean") return undefined;
    snap.active = value.active;
  }
  return snap;
}

/** A row the screen can show. Null when the payload is not a stored edit. */
export function parsePromptEditRow(value: unknown): PromptEditRow | null {
  if (!isRecord(value)) return null;
  for (const key of ["id", "edited_at", "action", "prompt_key"] as const) {
    if (typeof value[key] !== "string" || !value[key]) return null;
  }
  const before = snapshotFrom(value.before);
  const after = snapshotFrom(value.after);
  if (before === undefined || after === undefined) return null;
  return {
    id: value.id as string,
    edited_at: value.edited_at as string,
    action: value.action as string,
    prompt_key: value.prompt_key as string,
    before,
    after,
  };
}

type RpcError = { message?: string; code?: string } | null | undefined;

/** PostgREST answers PGRST202 (or Postgres 42883) when the function is not in the database. */
export function promptHistoryFunctionMissing(error: RpcError): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

/**
 * Turns the rpc payload into history. A missing function, an error, or anything that is not a
 * list of stored edits is unavailable. An empty list is a real read with no rows.
 */
export function promptEditHistoryFromRpc(data: unknown, error: RpcError): PromptEditHistory {
  if (error) return { status: "unavailable", reason: promptHistoryFunctionMissing(error) ? "missing" : "failed" };
  if (!Array.isArray(data)) return { status: "unavailable", reason: "failed" };
  const rows: PromptEditRow[] = [];
  for (const item of data) {
    const row = parsePromptEditRow(item);
    if (!row) return { status: "unavailable", reason: "failed" };
    rows.push(row);
  }
  return { status: "ready", rows };
}

/** The stored edits of one prompt, newest first. */
export function promptEditsFor(rows: readonly PromptEditRow[], promptKey: string): PromptEditRow[] {
  return rows
    .filter((row) => row.prompt_key === promptKey)
    .sort((a, b) => b.edited_at.localeCompare(a.edited_at) || b.id.localeCompare(a.id));
}

/** "3 changes", "1 change", "No changes". */
export function promptEditCountLabel(count: number): string {
  if (count === 0) return "No changes";
  return `${count} ${count === 1 ? "change" : "changes"}`;
}

/** The action word stored on the row, in the words the editor already uses. */
export function promptEditActionLabel(action: string): string {
  switch (action) {
    case "add":
      return "Added";
    case "edit":
      return "Edited";
    case "remove":
      return "Removed";
    case "restore":
      return "Restored";
    default:
      return action;
  }
}

/** Wording on one side of a change. Active-only rows say whether the prompt was asked. */
export function promptEditSide(snapshot: PromptEditSnapshot | null): string {
  if (!snapshot) return "None";
  const lines: string[] = [];
  const text = snapshot.prompt_text?.trim();
  if (text) lines.push(text);
  const category = snapshot.category?.trim();
  if (category) lines.push(`Category: ${category}`);
  if (!text && typeof snapshot.active === "boolean") lines.push(snapshot.active ? "Asked" : "Not asked");
  return lines.join("\n") || "None";
}

const whenFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** "Nov 4, 2026, 1:27 PM UTC". The stored text when it is not a time. */
export function formatPromptEditWhen(iso: string): string {
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? iso : whenFormat.format(time);
}

/** The cells of one history row, as the screen and the CSV both show them. */
export function promptEditCells(row: PromptEditRow): string[] {
  return [
    formatPromptEditWhen(row.edited_at),
    promptEditActionLabel(row.action),
    promptEditSide(row.before),
    promptEditSide(row.after),
  ];
}

export const PROMPT_HISTORY_HEADER = ["Time", "Change", "Before", "After"] as const;

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError }>;
};

/**
 * Reads public.ai_prompt_edits_list. A null key reads every prompt's edits in one call.
 * A missing function or any other failure is unavailable.
 */
export async function loadPromptEditHistory(
  promptKey: string | null = null,
  client: RpcClient = getPublicCanvasSupabase() as unknown as RpcClient,
): Promise<PromptEditHistory> {
  try {
    const { data, error } = await client.rpc("ai_prompt_edits_list", { p_prompt_key: promptKey });
    return promptEditHistoryFromRpc(data, error);
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
