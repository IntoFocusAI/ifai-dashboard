import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/** Shown on the prompt change history. A published run already keeps its own prompt hash. */
export const PROMPT_HISTORY_NOTE =
  "A run keeps the questions it asked. A later edit does not change that run.";

export const PROMPT_HISTORY_UNAVAILABLE = "Not available*";

/** Why the history reads Not available*. The reason stays in the tooltip. */
export const PROMPT_HISTORY_UNAVAILABLE_DESC = "The prompt change log could not be read.";

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
  | { status: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** null is an empty side (an add has no before). A non-object is not a log row. */
function snapshotFrom(value: unknown): PromptEditSnapshot | null | undefined {
  if (value == null) return null;
  if (!isRecord(value)) return undefined;
  const snap: PromptEditSnapshot = {};
  if ("prompt_text" in value) {
    if (typeof value.prompt_text !== "string") return undefined;
    snap.prompt_text = value.prompt_text;
  }
  if ("category" in value) {
    if (typeof value.category !== "string") return undefined;
    snap.category = value.category;
  }
  if ("prompt_kind" in value) {
    if (typeof value.prompt_kind !== "string") return undefined;
    snap.prompt_kind = value.prompt_kind;
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
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.edited_at !== "string" || !value.edited_at) return null;
  if (typeof value.action !== "string" || !value.action) return null;
  if (typeof value.prompt_key !== "string" || !value.prompt_key) return null;
  const before = snapshotFrom(value.before);
  const after = snapshotFrom(value.after);
  if (before === undefined || after === undefined) return null;
  return {
    id: value.id,
    edited_at: value.edited_at,
    action: value.action,
    prompt_key: value.prompt_key,
    before,
    after,
  };
}

/**
 * Turns the rpc payload into history. An error, or anything that is not a list of
 * stored edits, is unavailable. An empty list is a real read with no rows.
 */
export function promptEditHistoryFromRpc(data: unknown, error: unknown): PromptEditHistory {
  if (error) return { status: "unavailable" };
  if (!Array.isArray(data)) return { status: "unavailable" };
  const rows: PromptEditRow[] = [];
  for (const item of data) {
    const row = parsePromptEditRow(item);
    if (!row) return { status: "unavailable" };
    rows.push(row);
  }
  return { status: "ready", rows };
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
  if (!text && typeof snapshot.active === "boolean") {
    lines.push(snapshot.active ? "Asked" : "Not asked");
  }
  return lines.join("\n") || "None";
}

export function formatPromptEditWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Reads public.ai_prompt_edits_list. A missing function or any other failure is unavailable. */
export async function loadPromptEditHistory(promptKey: string): Promise<PromptEditHistory> {
  try {
    const { data, error } = await getCanvasSupabase().rpc("ai_prompt_edits_list", {
      p_prompt_key: promptKey,
    });
    return promptEditHistoryFromRpc(data, error);
  } catch {
    return { status: "unavailable" };
  }
}
