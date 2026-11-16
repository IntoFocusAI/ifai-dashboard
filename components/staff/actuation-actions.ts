"use server";

import { revalidatePath } from "next/cache";
import {
  ACTUATION_RECORDS_PATH,
  itemPayload,
  programPayload,
  type ItemInput,
  type ProgramInput,
} from "@/lib/fender-canvas/actuation-records";
import { isoDay } from "@/lib/fender-canvas/actuation-score";
import { getCommandSession } from "@/lib/command/session";
import { createClient } from "@/lib/supabase/server";

export type ActuationSaveResult = { ok: true } | { ok: false; message: string };

const STAFF_ONLY = "Only IntoFocus staff can change Actuation records.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Staff writes. The page checks staff before it renders; each action checks again, and each
 * database function checks a third time as the caller.
 */
async function staffClient() {
  const session = await getCommandSession().catch(() => null);
  return session?.isIntoFocusAdmin ? createClient() : null;
}

export async function saveActuationProgram(input: ProgramInput): Promise<ActuationSaveResult> {
  const supabase = await staffClient();
  if (!supabase) return { ok: false, message: STAFF_ONLY };
  const checked = programPayload(input, isoDay(new Date()));
  if (!checked.ok) return checked;
  const { error } = await supabase.rpc("actuation_program_save", checked.payload);
  if (error) return { ok: false, message: "The program was not saved. Try again." };
  revalidatePath(ACTUATION_RECORDS_PATH);
  return { ok: true };
}

export async function saveActuationItem(input: ItemInput): Promise<ActuationSaveResult> {
  const supabase = await staffClient();
  if (!supabase) return { ok: false, message: STAFF_ONLY };
  const checked = itemPayload(input, isoDay(new Date()));
  if (!checked.ok) return checked;
  const { error } = await supabase.rpc("actuation_item_save", checked.payload);
  if (error) return { ok: false, message: "The item was not saved. Try again." };
  revalidatePath(ACTUATION_RECORDS_PATH);
  return { ok: true };
}

export async function removeActuationItem(id: string): Promise<ActuationSaveResult> {
  const supabase = await staffClient();
  if (!supabase) return { ok: false, message: STAFF_ONLY };
  if (!UUID.test(id)) return { ok: false, message: "Unknown item." };
  const { error } = await supabase.rpc("actuation_item_remove", { p_id: id });
  if (error) return { ok: false, message: "The item was not removed. Try again." };
  revalidatePath(ACTUATION_RECORDS_PATH);
  return { ok: true };
}
