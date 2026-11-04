"use client";

import { useCallback, useEffect, useState } from "react";
import type { FindabilityRead } from "@/lib/findability/copy";
import type { FindabilityBucket, FindabilityRow } from "@/lib/findability/outcomes";
import {
  clearFindabilityRowFocus,
  consumeFindabilityRowFocus,
  findabilityRowTarget,
  peekFindabilityRowFocus,
} from "@/lib/findability/row-focus";

/** How long a landed row stays highlighted. */
export const LANDED_ROW_MS = 2400;

/**
 * A link from Brand-Site Specs names one listing. Once the read is in, this opens the
 * outcome table that holds it and returns its ASIN for the table to land on. Choosing
 * another outcome clears the landing and the row named in the URL.
 */
export function useFindabilityRowLanding(
  read: FindabilityRead,
  select: (bucket: FindabilityBucket) => void,
): { landAsin: string | null; clearLanding: () => void } {
  const [pending, setPending] = useState(peekFindabilityRowFocus);
  const [landAsin, setLandAsin] = useState<string | null>(null);

  useEffect(() => {
    consumeFindabilityRowFocus();
  }, []);

  if (pending && read.phase !== "loading") {
    const target = findabilityRowTarget(read, pending);
    setPending(null);
    setLandAsin(target?.asin ?? null);
    if (target) select(target.bucket);
  }

  const clearLanding = useCallback(() => {
    setLandAsin(null);
    clearFindabilityRowFocus();
  }, []);

  return { landAsin, clearLanding };
}

/**
 * Opens the page that holds `asin`, scrolls its row into view, and marks it for
 * LANDED_ROW_MS. The scroll waits a frame, after the shell's tab-change scroll reset.
 */
export function useLandOnFindabilityRow(
  asin: string | null,
  rows: readonly FindabilityRow[],
  pageSize: number,
  setPage: (page: number) => void,
): string | null {
  const [handled, setHandled] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  if (asin && handled !== asin) {
    setHandled(asin);
    const index = rows.findIndex((row) => row.asin === asin);
    if (index >= 0) {
      setPage(Math.floor(index / pageSize));
      setLanded(asin);
    }
  }

  useEffect(() => {
    if (!landed) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-findability-asin="${CSS.escape(landed)}"]`)
        ?.scrollIntoView({ block: "center" });
    });
    const timer = window.setTimeout(() => setLanded(null), LANDED_ROW_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [landed]);

  return landed;
}
