"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readClientEstimates } from "@/components/v3/live/estimates/useClientEstimates";
import { loadCanvas } from "@/lib/canvasData";
import type { ClientEstimatesRead } from "@/lib/estimates/live-inputs";
import { bundleReadFailures, CanvasReadError, withLastGood } from "@/lib/fender-canvas/canvas-reads";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const REFRESH_MS = 300_000;

export function useFenderCanvasData() {
  const [data, setData] = useState<CanvasBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stale, setStale] = useState(false);
  const lastGood = useRef<CanvasBundle | null>(null);
  // Dollar estimates read once per page load, after the bundle, so the map never waits on them.
  const estimates = useRef<ClientEstimatesRead>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    const settle = (next: ClientEstimatesRead) => {
      if (cancelled) return;
      estimates.current = next;
      setData((prev) => (prev ? { ...prev, estimates: next } : prev));
    };
    readClientEstimates().then(
      (ready) => settle({ phase: "ready", estimates: ready }),
      (err: unknown) => settle({ phase: "error", message: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await loadCanvas();
      const failures = bundleReadFailures(next);
      const merged = withLastGood(next, lastGood.current);
      const bundle = { ...merged.bundle, estimates: estimates.current };
      lastGood.current = bundle;
      setData(bundle);
      setError(failures.length > 0 ? new CanvasReadError(failures, false) : null);
      setStale(merged.stale);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      if (lastGood.current) setData(lastGood.current);
      setStale(Boolean(lastGood.current));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return {
    bundle: data,
    loading: loading && !data,
    error,
    stale,
    refresh,
  };
}
