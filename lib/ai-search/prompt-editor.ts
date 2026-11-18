import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

let sessionClient: SupabaseClient | null = null;

/**
 * Prompt edits run as the signed-in staff member: ai_prompt_save and ai_prompt_set_active check
 * command.is_intofocus_admin() and are not callable with the anon key
 * (migration 20261118160000). Reads stay on the public client.
 */
function staffSessionSupabase(): SupabaseClient {
  if (!sessionClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase is not configured.");
    sessionClient = createBrowserClient(url, key, supabaseCookieOptions());
  }
  return sessionClient;
}

/** One row of command.fmic_ai_prompts, as returned by public.ai_prompts_list(). */
export type EditablePrompt = {
  prompt_key: string;
  prompt_text: string;
  category: string;
  prompt_kind: "commercial" | "probe" | string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

/** public.ai_prompts_status(): whether edits are allowed and what a prompt costs per run. */
export type PromptEditorStatus = {
  locked: boolean;
  run_id: string | null;
  run_started_at: string | null;
  active_count: number;
  max_active: number;
  engines: number;
  repeats: number;
  categories: string[];
};

function errorText(error: { message?: string } | null): string {
  return error?.message ?? "Something went wrong. Try again.";
}

export async function loadPrompts(): Promise<{ prompts: EditablePrompt[]; status: PromptEditorStatus }> {
  const client = getPublicCanvasSupabase();
  const [list, status] = await Promise.all([client.rpc("ai_prompts_list"), client.rpc("ai_prompts_status")]);
  if (list.error) throw new Error(errorText(list.error));
  if (status.error) throw new Error(errorText(status.error));
  return { prompts: (list.data ?? []) as EditablePrompt[], status: status.data as PromptEditorStatus };
}

/** Adds a prompt when `promptKey` is null; otherwise edits its text and category. Returns the key. */
export async function savePrompt(promptKey: string | null, promptText: string, category: string): Promise<string> {
  const { data, error } = await staffSessionSupabase().rpc("ai_prompt_save", {
    p_prompt_key: promptKey,
    p_prompt_text: promptText,
    p_category: category,
  });
  if (error) throw new Error(errorText(error));
  return data as string;
}

/** Remove (false) switches a prompt off; restore (true) switches it back on. */
export async function setPromptActive(promptKey: string, active: boolean): Promise<void> {
  const { error } = await staffSessionSupabase().rpc("ai_prompt_set_active", {
    p_prompt_key: promptKey,
    p_active: active,
  });
  if (error) throw new Error(errorText(error));
}
