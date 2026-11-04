"use client";

import { useEffect, useMemo, useState } from "react";
import {
  approvedExceptionAsins,
  withMapApprovedExceptions,
} from "@/lib/fender-canvas/map-approved-exceptions";
import type { PortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { loadPortfolioRetailSnapshot } from "@/lib/fender-canvas/portfolio-retail-queries";
import { FMIC_CLIENT_KEY, SET_ASIDE_CHECKS } from "@/lib/set-aside/keys";
import { useSetAsides } from "@/lib/set-aside/set-aside";

// One retail read while any caller is mounted: the canvas and the Divisions table both call this hook.
// The read is dropped when the last caller unmounts, so a remounted canvas reads fresh rows.
let sharedLoad: Promise<PortfolioRetailSnapshot> | null = null;
let mountedCallers = 0;

function loadSharedSnapshot(): Promise<PortfolioRetailSnapshot> {
  if (!sharedLoad) {
    sharedLoad = loadPortfolioRetailSnapshot();
    sharedLoad.catch(() => {
      sharedLoad = null;
    });
  }
  return sharedLoad;
}

export function usePortfolioRetailSnapshot(): RetailCanvasRead {
  const [read, setRead] = useState<RetailCanvasRead>({ phase: "loading" });
  // Same per-check store the MAP table writes to, so a set-aside or reopen updates every MAP figure.
  const mapSetAsides = useSetAsides(FMIC_CLIENT_KEY, SET_ASIDE_CHECKS.mapPricing);

  useEffect(() => {
    let cancelled = false;
    mountedCallers += 1;
    loadSharedSnapshot()
      .then((snapshot) => {
        if (!cancelled) setRead({ phase: "ready", snapshot });
      })
      .catch(() => {
        if (!cancelled) setRead({ phase: "error" });
      });
    return () => {
      cancelled = true;
      mountedCallers -= 1;
      if (mountedCallers === 0) sharedLoad = null;
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
