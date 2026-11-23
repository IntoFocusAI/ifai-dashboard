type SingleClient = {
  from: (view: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

/**
 * Where a call's stored answer can be: the published run, an earlier run in the date-pill window,
 * or an API-engine run. The window's runs are read without their answers, so a drawer reads its
 * one answer here when it opens.
 */
export const ANSWER_VIEWS = ["canvas_ai_simulations", "canvas_ai_history_calls", "canvas_ai_api_calls"] as const;

/**
 * The stored call id. A window total gives each call its run's id as a prefix ("run:call") so
 * calls from different runs stay apart; the views store the call id alone.
 */
export function storedCallId(id: string): string {
  return id.slice(id.lastIndexOf(":") + 1);
}

/** The engine's answer for one call, read only when its evidence drawer opens. */
export async function answerTextQuery(
  client: SingleClient,
  pooledId: string,
): Promise<{ answer: string | null; error: string | null }> {
  const id = storedCallId(pooledId);
  for (const view of ANSWER_VIEWS) {
    const { data, error } = await client.from(view).select("answer_text").eq("id", id).maybeSingle();
    if (error) return { answer: null, error: error.message };
    if (data) return { answer: (data as { answer_text?: string | null }).answer_text?.trim() || null, error: null };
  }
  return { answer: null, error: null };
}
