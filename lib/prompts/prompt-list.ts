import { loadPrompts, type EditablePrompt, type PromptEditorStatus } from "@/lib/ai-search/prompt-editor";
import { activeClient } from "@/lib/client/active-client";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

/**
 * The prompt list for the brand on screen. Every client sees the same view-only list (decisions 89
 * and 99).
 *
 * Fender's list, which staff write from Build prompts, is read through its editor functions, which
 * also return the calls per prompt. Every other client reads its own battery from
 * `<schema>.canvas_ai_prompts`
 * (supabase/migrations/20261116230000_ledlenser_canvas_ai_prompts.sql for Ledlenser).
 */
export type PromptList = {
  prompts: EditablePrompt[];
  /** Calls per prompt (and the run lock). Null where the list is read from a canvas view. */
  status: PromptEditorStatus | null;
};

/** Columns of canvas_ai_prompts the screen reads, the same as public.ai_prompts_list() returns. */
export const PROMPT_LIST_COLUMNS = "prompt_key,prompt_text,category,prompt_kind,active,created_at,updated_at";

export const PROMPT_LIST_UNREADABLE = "The prompt list could not be read.";

const ROTATING_SLOT = /^Rotating catalog fact check slot ([A-Z]): question per run in \S+$/;

/**
 * The wording the Prompts list and its CSV show. A rotating fact-check slot stores an internal note
 * ("... question per run in command.fmic_ai_probe_plan"); the screen shows it in plain words. The
 * stored text is unchanged.
 */
export function promptDisplayText(text: string): string {
  const slot = ROTATING_SLOT.exec(text.trim());
  return slot ? `Rotating catalog fact check, slot ${slot[1]}: a different catalog product each run` : text;
}

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
    return { prompts, status };
  }
  const { data, error } = await getCanvasSupabase()
    .from("canvas_ai_prompts")
    .select(PROMPT_LIST_COLUMNS)
    .order("prompt_key", { ascending: true });
  if (error) throw new Error(PROMPT_LIST_UNREADABLE);
  const prompts = ((data ?? []) as Row[]).map(promptFromRow).filter((p): p is EditablePrompt => p !== null);
  return { prompts, status: null };
}
