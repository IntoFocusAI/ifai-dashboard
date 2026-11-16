import { loadPrompts, type EditablePrompt, type PromptEditorStatus } from "@/lib/ai-search/prompt-editor";
import { activeClient } from "@/lib/client/active-client";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/**
 * The prompt list for the brand on screen (decision 89: every client has the Prompts screen).
 *
 * A client whose prompt list is edited from the dashboard (Fender) reads it through the editor
 * functions, which also return the run lock and the calls per prompt. Every other client reads its
 * own battery, read-only, from `<schema>.canvas_ai_prompts`
 * (supabase/migrations/20261116200000_ledlenser_canvas_ai_prompts.sql for Ledlenser).
 */
export type PromptList = {
  prompts: EditablePrompt[];
  /** Run lock and calls per prompt. Null for a read-only list. */
  status: PromptEditorStatus | null;
  /** Add, edit, remove, restore, change history, and Build prompts. */
  editable: boolean;
};

/** Columns of canvas_ai_prompts the screen reads, the same as public.ai_prompts_list() returns. */
export const PROMPT_LIST_COLUMNS = "prompt_key,prompt_text,category,prompt_kind,active,created_at,updated_at";

export const PROMPT_LIST_UNREADABLE = "The prompt list could not be read.";

type Row = Partial<Record<keyof EditablePrompt, unknown>>;

/** One canvas_ai_prompts row, or null when the row has no key or wording. */
export function promptFromRow(row: Row): EditablePrompt | null {
  if (typeof row.prompt_key !== "string" || typeof row.prompt_text !== "string") return null;
  return {
    prompt_key: row.prompt_key,
    prompt_text: row.prompt_text,
    category: typeof row.category === "string" ? row.category : "",
    prompt_kind: typeof row.prompt_kind === "string" ? row.prompt_kind : "commercial",
    active: row.active !== false,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function loadPromptList(): Promise<PromptList> {
  if (activeClient().promptsEditable) {
    const { prompts, status } = await loadPrompts();
    return { prompts, status, editable: true };
  }
  const { data, error } = await getCanvasSupabase()
    .from("canvas_ai_prompts")
    .select(PROMPT_LIST_COLUMNS)
    .order("prompt_key", { ascending: true });
  if (error) throw new Error(PROMPT_LIST_UNREADABLE);
  const prompts = ((data ?? []) as Row[]).map(promptFromRow).filter((p): p is EditablePrompt => p !== null);
  return { prompts, status: null, editable: false };
}
