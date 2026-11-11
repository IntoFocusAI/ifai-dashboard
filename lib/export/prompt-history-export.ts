import {
  PROMPT_HISTORY_HEADER,
  PROMPT_HISTORY_NOTE,
  formatPromptEditWhen,
  loadPromptEditHistory,
  promptEditCells,
  promptEditsFor,
} from "@/lib/ai-search/prompt-edit-history";
import { activeClient } from "@/lib/client/active-client";
import type { SourceRead } from "@/lib/export/types";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { formatInt } from "@/lib/fender-canvas/format";

const PROMPT_KEY = /^[a-z][a-z0-9_-]{0,39}$/i;

/** One prompt's stored changes, read again with public.ai_prompt_edits_list. */
export async function loadPromptHistorySource(scope: Record<string, unknown> | null): Promise<SourceRead> {
  const promptKey = typeof scope?.promptKey === "string" && PROMPT_KEY.test(scope.promptKey) ? scope.promptKey : null;
  if (!promptKey) return { ok: false, message: "This download needs the prompt on screen. Open its history and try again." };
  if (!activeClient().promptsEditable) return { ok: false, message: "This brand's prompt list has no change history." };
  const history = await loadPromptEditHistory(promptKey);
  if (history.status !== "ready") return { ok: false, message: "The prompt change history could not be read." };
  const rows = promptEditsFor(history.rows, promptKey);
  return {
    ok: true,
    source: {
      table: "prompt-history",
      header: [...PROMPT_HISTORY_HEADER],
      rows: rows.map((row) => ({ key: row.id, cells: promptEditCells(row) })),
      filter: `Prompt ${promptKey}.`,
      sort: "Time, newest first.",
      population: `${formatInt(rows.length)} stored ${rows.length === 1 ? "change" : "changes"} to prompt ${promptKey}. ${PROMPT_HISTORY_NOTE}`,
      asOf: rows.length ? formatPromptEditWhen(rows[0].edited_at) : READ_NOT_AVAILABLE,
    },
  };
}
