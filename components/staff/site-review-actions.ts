"use server";

import { revalidatePath } from "next/cache";
import { overridePayload, SITES_TO_REVIEW_PATH, type OverrideInput } from "@/lib/ai-search/site-review";
import { getCommandSession } from "@/lib/command/session";
import { createClient } from "@/lib/supabase/server";

export type SaveSiteTypeResult = { ok: true } | { ok: false; message: string };

/**
 * Saves one staff override through public.site_type_override. The page checks staff before it
 * renders; this checks again, and the database function checks a third time as the caller.
 */
export async function saveSiteType(input: OverrideInput): Promise<SaveSiteTypeResult> {
  const session = await getCommandSession();
  if (!session?.isIntoFocusAdmin) return { ok: false, message: "Only IntoFocus staff can set a site type." };
  const payload = overridePayload(input);
  if (!payload) return { ok: false, message: "This site type could not be saved." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("site_type_override", payload);
  if (error) return { ok: false, message: "The site type was not saved. Try again." };
  revalidatePath(SITES_TO_REVIEW_PATH);
  return { ok: true };
}
