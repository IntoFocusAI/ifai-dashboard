"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approvedExceptionAsins,
  withMapApprovedExceptions,
} from "@/lib/fender-canvas/map-approved-exceptions";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { FMIC_CLIENT_KEY, SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { useSetAsides } from "@/lib/set-aside/set-aside";

export function usePortfolioRetailSnapshot(): RetailCanvasRead {
  const [read, setRead] = useState<RetailCanvasRead>({ phase: "loading" });
  // Same per-check store the MAP table writes to, so a set-aside or reopen updates every MAP figure.
  const mapSetAsides = useSetAsides(FMIC_CLIENT_KEY, SET_ASIDE_CHECKS.mapPricing);

  useEffect(() => {
    let cancelled = false;
    loadPortfolioRetailSnapshot()
      .then((snapshot) => {
        if (!cancelled) setRead({ phase: "ready", snapshot });
      })
      .catch(() => {
        if (!cancelled) setRead({ phase: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const exceptions = useMemo(() => approvedExceptionAsins(mapSetAsides.rows), [mapSetAsides.rows]);
  const failed = Boolean(mapSetAsides.error) && mapSetAsides.rows.length === 0;

  return useMemo<RetailCanvasRead>(() => {
    if (read.phase !== "ready") return read;
    // Hold the figures until the set-asides answer, so the MAP count does not change after first paint.
    if (!mapSetAsides.loaded) return { phase: "loading" };
    return { phase: "ready", snapshot: withMapApprovedExceptions(read.snapshot, exceptions, { failed }) };
  }, [read, mapSetAsides.loaded, exceptions, failed]);
}
