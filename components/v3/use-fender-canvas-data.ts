"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCanvas } from "@/lib/canvasData";
import { bundleReadFailures, CanvasReadError, withLastGood } from "@/lib/fender-canvas/canvas-reads";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const REFRESH_MS = 300_000;

export function useFenderCanvasData() {
  const [data, setData] = useState<CanvasBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stale, setStale] = useState(false);
  const lastGood = useRef<CanvasBundle | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadCanvas();
      const failures = bundleReadFailures(next);
      const merged = withLastGood(next, lastGood.current);
      lastGood.current = merged.bundle;
      setData(merged.bundle);
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
