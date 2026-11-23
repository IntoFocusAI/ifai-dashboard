"use client";

import { useEffect, useState } from "react";
import { activeClientSettings } from "@/lib/client/active-client";
import {
  loadClientEstimates,
  type ClientEstimates,
  type ClientEstimatesRead,
  type EstimateReadClient,
} from "@/lib/estimates/live-inputs";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

export type { ClientEstimatesRead };

/** One read per page load: every view on the page shares it. The client is fixed for the page load. */
let shared: Promise<ClientEstimates> | null = null;

export function readClientEstimates(): Promise<ClientEstimates> {
  if (!shared) {
    shared = loadClientEstimates(getCanvasSupabase() as unknown as EstimateReadClient, activeClientSettings());
    shared.catch(() => {
      shared = null;
    });
  }
  return shared;
}

/** The active client's estimates: lines 1 to 7, Phase 1, MAP beside, line 6 held, per listing. */
export function useClientEstimates(): ClientEstimatesRead {
  const [read, setRead] = useState<ClientEstimatesRead>({ phase: "loading" });
  useEffect(() => {
    let cancelled = false;
    readClientEstimates().then(
      (estimates) => {
        if (!cancelled) setRead({ phase: "ready", estimates });
      },
      (error: unknown) => {
        if (!cancelled) setRead({ phase: "error", message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return read;
}
