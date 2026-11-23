"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loadAiSearchRead, type AiReadClient } from "@/lib/ai-search/queries";
import type { AiSearchRead } from "@/lib/ai-search/types";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

const REFRESH_MS = 300_000;

/** Reads the published AI run. A later failed refresh keeps the last good run, marked stale. */
export function useAiSearchRead(): AiSearchRead {
  const [read, setRead] = useState<AiSearchRead>({ phase: "loading" });
  const lastGood = useRef<AiSearchRead | null>(null);

  const refresh = useCallback(async () => {
    let next: AiSearchRead;
    try {
      next = await loadAiSearchRead(getCanvasSupabase() as unknown as AiReadClient);
    } catch (error) {
      next = { phase: "error", message: error instanceof Error ? error.message : String(error) };
    }
    if (next.phase === "error" && lastGood.current?.phase === "ready") {
      setRead({ ...lastGood.current, stale: true });
      return;
    }
    if (next.phase === "ready") lastGood.current = next;
    setRead(next);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return read;
}

const AiSearchContext = createContext<AiSearchRead | null>(null);

export function AiSearchProvider({ read, children }: { read: AiSearchRead; children: ReactNode }) {
  return <AiSearchContext.Provider value={read}>{children}</AiSearchContext.Provider>;
}

export function useAiSearch(): AiSearchRead {
  return useContext(AiSearchContext) ?? { phase: "loading" };
}

/** True inside an AiSearchProvider. The map builds its plan above the provider, where it is false. */
export function useHasAiSearchProvider(): boolean {
  return useContext(AiSearchContext) != null;
}
