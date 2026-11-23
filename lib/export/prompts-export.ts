import type { EditablePrompt } from "@/lib/ai-search/prompt-editor";
import { PROMPTS_EXPORT_TABLE } from "@/lib/export/tables";
import type { ExportRow, SourceRead } from "@/lib/export/types";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatCheckedAt } from "@/lib/fender-canvas/featured-offer-copy";
import { formatInt } from "@/lib/fender-canvas/format";
import { loadPromptList, promptDisplayText } from "@/lib/prompts/prompt-list";

export { PROMPTS_EXPORT_TABLE };

export const PROMPTS_HEADER = ["Prompt key", "Category", "Kind", "Prompt", "Status"] as const;

/** One prompt as the list shows it: key, category chip, the Fact check chip, the wording, and its section. */
export function promptCells(prompt: EditablePrompt): string[] {
  return [
    prompt.prompt_key,
    prompt.category,
    prompt.prompt_kind === "probe" ? "Fact check" : "Shopping",
    promptDisplayText(prompt.prompt_text),
    prompt.active ? "Asked" : "Removed",
  ];
}

/** The asked prompts in list order, then the removed prompts, as the editor lists them. */
export function promptRows(prompts: readonly EditablePrompt[]): ExportRow[] {
  const ordered = [...prompts.filter((p) => p.active), ...prompts.filter((p) => !p.active)];
  return ordered.map((prompt) => ({ key: prompt.prompt_key, cells: promptCells(prompt) }));
}

/**
 * Download CSV for the prompt list, read again for the brand on screen (X-10, decision 89): Fender
 * through public.ai_prompts_list, every other client from its own canvas_ai_prompts view.
 */
export async function loadPromptsSource(): Promise<SourceRead> {
  try {
    const { prompts } = await loadPromptList();
    const asked = prompts.filter((p) => p.active).length;
    const removed = prompts.length - asked;
    const newest = prompts
      .map((p) => p.updated_at ?? p.created_at)
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(-1);
    return {
      ok: true,
      source: {
        table: PROMPTS_EXPORT_TABLE,
        header: [...PROMPTS_HEADER],
        rows: promptRows(prompts),
        filter: null,
        sort: "List order, asked prompts first, then removed prompts.",
        population: `${formatInt(asked)} ${asked === 1 ? "prompt" : "prompts"} asked each run, ${formatInt(removed)} removed`,
        asOf: formatCheckedAt(newest) ?? READ_NOT_AVAILABLE,
      },
    };
  } catch {
    return { ok: false, message: "The prompt list could not be read." };
  }
}
