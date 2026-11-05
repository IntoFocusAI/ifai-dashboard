import { getCanvasSupabase } from "@/lib/supabase/canvas-client";
import { approvalPatch, pendingInsert } from "./approval";
import { keysInPendingPayload } from "./classify-rows";
import { isStagingTableAbsent, type StagingError } from "./staging-error";
import { STAGED_TABLE, type StagedPayload, type StagedUpload, type UploadKind } from "./types";

const COLUMNS =
  "id, kind, file_name, status, payload, created_by_name, created_at, approved_by_name, approved_at";

export type StagingLookup =
  | { state: "ready"; uploads: StagedUpload[] }
  | { state: "absent" }
  | { state: "error"; message: string };

export type SaveResult =
  | { state: "saved"; upload: StagedUpload }
  | { state: "absent" }
  | { state: "error"; message: string };

export type ApproveResult =
  | { state: "approved"; upload: StagedUpload }
  | { state: "absent" }
  | { state: "error"; message: string };

function readError(error: unknown): StagingError {
  if (!error || typeof error !== "object") return {};
  const value = error as StagingError;
  return { code: value.code, message: value.message, details: value.details };
}

function asUpload(row: unknown): StagedUpload | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  if (value.kind !== "catalog" && value.kind !== "map") return null;
  if (value.status !== "pending" && value.status !== "approved") return null;
  if (typeof value.id !== "string" || typeof value.file_name !== "string") return null;
  if (!value.payload || typeof value.payload !== "object") return null;
  return {
    id: value.id,
    kind: value.kind,
    file_name: value.file_name,
    status: value.status,
    payload: value.payload as StagedPayload,
    created_by_name: typeof value.created_by_name === "string" ? value.created_by_name : null,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
    approved_by_name: typeof value.approved_by_name === "string" ? value.approved_by_name : null,
    approved_at: typeof value.approved_at === "string" ? value.approved_at : null,
  };
}

function clientOrAbsent(): { client: ReturnType<typeof getCanvasSupabase> } | { absent: true } {
  try {
    return { client: getCanvasSupabase() };
  } catch {
    return { absent: true };
  }
}

export function stagedKeysFor(uploads: StagedUpload[], kind: UploadKind, exceptId: string | null): string[] {
  const keys: string[] = [];
  for (const upload of uploads) {
    if (upload.kind !== kind || upload.id === exceptId) continue;
    if (upload.status !== "pending" && upload.status !== "approved") continue;
    keys.push(...keysInPendingPayload(upload.payload));
  }
  return keys;
}

export async function loadStaging(kind: UploadKind): Promise<StagingLookup> {
  const ready = clientOrAbsent();
  if ("absent" in ready) return { state: "absent" };
  try {
    const { data, error } = await ready.client
      .from(STAGED_TABLE)
      .select(COLUMNS)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isStagingTableAbsent(readError(error))) return { state: "absent" };
      return { state: "error", message: "The saved copy could not be read." };
    }
    const uploads = (data ?? []).map(asUpload).filter((row): row is StagedUpload => row !== null);
    return { state: "ready", uploads };
  } catch {
    return { state: "error", message: "The saved copy could not be read." };
  }
}

export async function savePendingUpload(input: {
  kind: UploadKind;
  fileName: string;
  payload: StagedPayload;
  name: string;
}): Promise<SaveResult> {
  const ready = clientOrAbsent();
  if ("absent" in ready) return { state: "absent" };
  try {
    const { data, error } = await ready.client
      .from(STAGED_TABLE)
      .insert(pendingInsert(input))
      .select(COLUMNS)
      .single();
    if (error) {
      if (isStagingTableAbsent(readError(error))) return { state: "absent" };
      return { state: "error", message: "The pending rows were not saved." };
    }
    const upload = asUpload(data);
    if (!upload) return { state: "error", message: "The pending rows were not saved." };
    return { state: "saved", upload };
  } catch {
    return { state: "error", message: "The pending rows were not saved." };
  }
}

export async function approveUpload(id: string, name: string, when = new Date().toISOString()): Promise<ApproveResult> {
  const ready = clientOrAbsent();
  if ("absent" in ready) return { state: "absent" };
  try {
    const { data, error } = await ready.client
      .from(STAGED_TABLE)
      .update(approvalPatch(name, when))
      .eq("id", id)
      .eq("status", "pending")
      .select(COLUMNS)
      .single();
    if (error) {
      if (isStagingTableAbsent(readError(error))) return { state: "absent" };
      return { state: "error", message: "The approval was not recorded." };
    }
    const upload = asUpload(data);
    if (!upload) return { state: "error", message: "The approval was not recorded." };
    return { state: "approved", upload };
  } catch {
    return { state: "error", message: "The approval was not recorded." };
  }
}
