"use client";

import { useEffect, useState } from "react";
import {
  loadPageFoundEvidence,
  type PageFoundEvidence,
} from "@/lib/fender-canvas/page-found-evidence";

export type PageFoundRead =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; evidence: PageFoundEvidence };

/** Reads the checked-SKU rows once, the first time `enabled` is true. */
export function usePageFoundEvidence(enabled: boolean): PageFoundRead {
  const [requested, setRequested] = useState(enabled);
  const [read, setRead] = useState<PageFoundRead>({ phase: "loading" });
  if (enabled && !requested) setRequested(true);

  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    loadPageFoundEvidence().then(
      (evidence) => {
        if (!cancelled) setRead({ phase: "ready", evidence });
      },
      () => {
        if (!cancelled) setRead({ phase: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [requested]);

  return read;
}
