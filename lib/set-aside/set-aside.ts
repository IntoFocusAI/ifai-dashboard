"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getPublicCanvasSupabase } from "@/lib/supabase/canvas-client";

/* Server-side Done and Set aside (worker 18.5).

   Done means the issue was fixed or handled. Set aside means come back to
   review it, or ignore it on purpose for a stated reason. Both are one row per
   (client, check, entity) with an outcome column, and both can be reopened.

   A set-aside clears one issue for one check on one entity: a Command Center
   queue item, an ASIN, or a page URL. Rows live in public.issue_set_asides,
   one per (client, check, entity). Reopen flips the same row; setting it aside
   again flips it back. Writes go through two SECURITY DEFINER functions that
   check every input and write public.audit_log, so this file only calls them.

   There is no login on the dashboard yet. The person types a name once and it
   is remembered in this browser. */

export type SetAsideStatus = "active" | "reopened";

/** Done = fixed or handled. Set aside = review later, or ignored on purpose for a reason. */
export type SetAsideOutcome = "set_aside" | "done";

export type SetAsideRow = {
  id: string;
  client_key: string;
  check_key: string;
  check_label: string;
  entity_type: "queue_item" | "asin" | "url";
  entity_key: string;
  entity_label: string | null;
  status: SetAsideStatus;
  outcome: SetAsideOutcome;
  /** Null on Done rows. */
  reason_code: string | null;
  reason_label: string | null;
  note: string | null;
  set_by_name: string;
  set_at: string;
  reopened_by_name: string | null;
  reopened_at: string | null;
  reopen_note: string | null;
  updated_at: string;
};

export type SetAsideReason = {
  reason_code: string;
  label: string;
  description: string | null;
  check_keys: string[] | null;
  requires_note: boolean;
  sort_order: number;
};

export type SetAsideInput = {
  entityKey: string;
  entityLabel?: string | null;
  reasonCode: string;
  note?: string | null;
  name: string;
};

export type DoneInput = {
  entityKey: string;
  entityLabel?: string | null;
  note?: string | null;
  name: string;
};

export type SetAsideResult = { ok: true } | { ok: false; error: string };

const NAME_KEY = "ifai:viewer-name";

// ---------------------------------------------------------------------------
// Viewer name (attribution until login)

const nameListeners = new Set<() => void>();
let nameSnapshot: string | null = null;
let nameLoaded = false;

function readName(): string {
  if (!nameLoaded) {
    nameLoaded = true;
    try {
      nameSnapshot = window.localStorage.getItem(NAME_KEY);
    } catch {
      nameSnapshot = null;
    }
  }
  return nameSnapshot ?? "";
}

export function rememberViewerName(name: string) {
  const trimmed = name.trim();
  nameSnapshot = trimmed;
  nameLoaded = true;
  try {
    window.localStorage.setItem(NAME_KEY, trimmed);
  } catch {
    /* keep the in-memory value */
  }
  for (const listener of nameListeners) listener();
}

export function useViewerName(): string {
  return useSyncExternalStore(
    (listener) => {
      nameListeners.add(listener);
      return () => nameListeners.delete(listener);
    },
    readName,
    () => "",
  );
}

// ---------------------------------------------------------------------------
// Validation mirrored from the database so the form can explain itself early.

export function validateSetAside(
  input: Pick<SetAsideInput, "reasonCode" | "note" | "name">,
  reason: SetAsideReason | undefined,
): string | null {
  const name = input.name.trim();
  if (!reason) return "Pick a reason.";
  if (name.length < 2 || name.length > 80) return "Enter your name.";
  const note = (input.note ?? "").trim();
  if (reason.requires_note && !note) return `“${reason.label}” needs a note.`;
  if (note.length > 500) return "Keep the note under 500 characters.";
  return null;
}

export function reasonsForCheck(
  reasons: readonly SetAsideReason[],
  checkKey: string,
): SetAsideReason[] {
  return reasons
    .filter((reason) => !reason.check_keys || reason.check_keys.includes(checkKey))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function validateDone(input: Pick<DoneInput, "note" | "name">): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return "Enter your name.";
  if ((input.note ?? "").trim().length > 500) return "Keep the note under 500 characters.";
  return null;
}

/** "Done" or "Set aside · <reason>". */
export function outcomeLabel(row: Pick<SetAsideRow, "outcome" | "reason_label">): string {
  if (row.outcome === "done") return "Done";
  return row.reason_label ? `Set aside · ${row.reason_label}` : "Set aside";
}

/** Shown when the database does not know the client, so the person sees why nothing was saved. */
export const UNKNOWN_CLIENT_MESSAGE =
  "This client is not set up for set-asides yet, so nothing was saved. Ask IntoFocus to add it.";

/** The message a person reads for a failed set-aside call. Never blank, never the raw database code. */
export function errorText(error: { message?: string } | null | undefined): string {
  const message = error?.message?.trim();
  if (message && /^unknown client\.?$/i.test(message)) return UNKNOWN_CLIENT_MESSAGE;
  return message ? message : "The set-aside could not be saved. Try again.";
}

/** An RPC that throws (network loss, a bad response) is a failed save with a visible message, not a stuck form. */
async function callRpc(fn: string, args: Record<string, unknown>): Promise<SetAsideResult> {
  try {
    const { error } = await getPublicCanvasSupabase().rpc(fn, args);
    return error ? { ok: false, error: errorText(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error as { message?: string }) };
  }
}

// ---------------------------------------------------------------------------
// Per-check store shared by every component on the page.

type CheckState = {
  rows: SetAsideRow[];
  loaded: boolean;
  error: string | null;
};

type CheckStore = {
  state: CheckState;
  listeners: Set<() => void>;
  inflight: Promise<void> | null;
};

const EMPTY_STATE: CheckState = { rows: [], loaded: false, error: null };
const stores = new Map<string, CheckStore>();

function storeFor(clientKey: string, checkKey: string): CheckStore {
  const key = `${clientKey}|${checkKey}`;
  let store = stores.get(key);
  if (!store) {
    store = { state: EMPTY_STATE, listeners: new Set(), inflight: null };
    stores.set(key, store);
  }
  return store;
}

function publish(store: CheckStore, next: CheckState) {
  store.state = next;
  for (const listener of store.listeners) listener();
}

function load(clientKey: string, checkKey: string): Promise<void> {
  const store = storeFor(clientKey, checkKey);
  if (store.inflight) return store.inflight;
  store.inflight = (async () => {
    try {
      const { data, error } = await getPublicCanvasSupabase()
        .from("canvas_issue_set_asides")
        .select("*")
        .eq("client_key", clientKey)
        .eq("check_key", checkKey)
        .order("updated_at", { ascending: false });
      publish(store, {
        rows: error ? store.state.rows : ((data ?? []) as SetAsideRow[]),
        loaded: true,
        error: error ? errorText(error) : null,
      });
    } catch (error) {
      publish(store, {
        rows: store.state.rows,
        loaded: true,
        error: errorText(error as { message?: string }),
      });
    } finally {
      store.inflight = null;
    }
  })();
  return store.inflight;
}

function upsertRow(store: CheckStore, row: SetAsideRow) {
  const rest = store.state.rows.filter((existing) => existing.id !== row.id);
  publish(store, { ...store.state, rows: [row, ...rest] });
}

export function useSetAsides(clientKey: string | null | undefined, checkKey: string) {
  const enabled = Boolean(clientKey);
  const store = useMemo(
    () => (clientKey ? storeFor(clientKey, checkKey) : null),
    [clientKey, checkKey],
  );

  const state = useSyncExternalStore(
    (listener) => {
      if (!store) return () => {};
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store?.state ?? EMPTY_STATE,
    () => EMPTY_STATE,
  );

  useEffect(() => {
    if (clientKey && store && !store.state.loaded) void load(clientKey, checkKey);
  }, [clientKey, checkKey, store]);

  const active = useMemo(() => {
    const map = new Map<string, SetAsideRow>();
    for (const row of state.rows) if (row.status === "active") map.set(row.entity_key, row);
    return map;
  }, [state.rows]);

  const setAside = useCallback(
    async (input: SetAsideInput): Promise<SetAsideResult> => {
      if (!clientKey || !store) return { ok: false, error: "Set-aside is not available here." };
      const saved = await callRpc("set_aside_issue", {
        p_client_key: clientKey,
        p_check_key: checkKey,
        p_entity_key: input.entityKey,
        p_reason_code: input.reasonCode,
        p_name: input.name.trim(),
        p_note: input.note?.trim() || null,
        p_entity_label: input.entityLabel ?? null,
      });
      if (!saved.ok) return saved;
      rememberViewerName(input.name);
      // Re-read through the view so labels (check, reason) come back joined.
      await load(clientKey, checkKey);
      return { ok: true };
    },
    [clientKey, checkKey, store],
  );

  const markDone = useCallback(
    async (input: DoneInput): Promise<SetAsideResult> => {
      if (!clientKey || !store) return { ok: false, error: "Done is not available here." };
      const saved = await callRpc("mark_issue_done", {
        p_client_key: clientKey,
        p_check_key: checkKey,
        p_entity_key: input.entityKey,
        p_name: input.name.trim(),
        p_note: input.note?.trim() || null,
        p_entity_label: input.entityLabel ?? null,
      });
      if (!saved.ok) return saved;
      rememberViewerName(input.name);
      await load(clientKey, checkKey);
      return { ok: true };
    },
    [clientKey, checkKey, store],
  );

  const reopen = useCallback(
    async (row: SetAsideRow, name: string, note?: string | null): Promise<SetAsideResult> => {
      if (!clientKey || !store) return { ok: false, error: "Set-aside is not available here." };
      const saved = await callRpc("reopen_set_aside", {
        p_id: row.id,
        p_name: name.trim(),
        p_note: note?.trim() || null,
      });
      if (!saved.ok) return saved;
      rememberViewerName(name);
      upsertRow(store, {
        ...row,
        status: "reopened",
        reopened_by_name: name.trim(),
        reopened_at: new Date().toISOString(),
        reopen_note: note?.trim() || null,
      });
      void load(clientKey, checkKey);
      return { ok: true };
    },
    [clientKey, checkKey, store],
  );

  return {
    enabled,
    loaded: state.loaded,
    error: state.error,
    rows: state.rows,
    active,
    setAside,
    markDone,
    reopen,
  };
}

// ---------------------------------------------------------------------------
// Reasons (editable lookup in public.set_aside_reasons)

let reasonsCache: SetAsideReason[] | null = null;
let reasonsInflight: Promise<SetAsideReason[]> | null = null;
const reasonListeners = new Set<() => void>();

function loadReasons(): Promise<SetAsideReason[]> {
  if (reasonsCache) return Promise.resolve(reasonsCache);
  if (!reasonsInflight) {
    reasonsInflight = Promise.resolve(
      getPublicCanvasSupabase()
        .from("canvas_set_aside_reasons")
        .select("*")
        .order("sort_order"),
    )
      .then(({ data, error }) => {
        reasonsCache = error ? [] : ((data ?? []) as SetAsideReason[]);
        return reasonsCache;
      })
      .catch(() => {
        reasonsCache = [];
        return reasonsCache;
      })
      .finally(() => {
        reasonsInflight = null;
        for (const listener of reasonListeners) listener();
      });
  }
  return reasonsInflight;
}

const NO_REASONS: SetAsideReason[] = [];

export function useSetAsideReasons(checkKey: string): SetAsideReason[] {
  const all = useSyncExternalStore(
    (listener) => {
      reasonListeners.add(listener);
      return () => reasonListeners.delete(listener);
    },
    () => reasonsCache ?? NO_REASONS,
    () => NO_REASONS,
  );
  useEffect(() => {
    if (!reasonsCache) void loadReasons();
  }, []);
  return useMemo(() => reasonsForCheck(all, checkKey), [all, checkKey]);
}

export function formatSetAsideDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
