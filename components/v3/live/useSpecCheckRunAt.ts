"use client";

import { useEffect, useState } from "react";
import { loadSpecCheckRunAt } from "@/lib/fender-canvas/page-found-checked-at";

/** The fender.com product check's last run. Null while loading or when the read fails, so no time is claimed. */
export function useSpecCheckRunAt(): string | null {
  const [at, setAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSpecCheckRunAt().then(
      (value) => {
        if (!cancelled) setAt(value);
      },
      () => {
        if (!cancelled) setAt(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return at;
}
