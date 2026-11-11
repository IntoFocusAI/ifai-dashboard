"use client";

import { useEffect, useState } from "react";
import {
  resolveAmazonFieldTotals,
  sumAmazonFieldTotals,
  type AmazonFieldTotals,
} from "@/lib/fender-canvas/ai-readiness-lead";
import { loadFilteredPages } from "@/lib/fender-canvas/full-result-sort";
import type { StockLossRead } from "@/lib/fender-canvas/minimal-metrics";
import { loadStockLossRows } from "@/lib/fender-canvas/stock-loss";
import type { CanvasMetricsRow, CanvasSpecReadinessRow } from "@/lib/fender-canvas/types";
import { getCanvasSupabase } from "@/lib/supabase/canvas-client";

type FieldTotalRow = Pick<CanvasSpecReadinessRow, "amazon_checked" | "amazon_fields_found" | "amazon_fields_expected">;

/** The Out of Stock rows, read once for the Minimal slots with the tab's own loader. */
export function useStockLossRead(): StockLossRead {
  const [read, setRead] = useState<StockLossRead>({ phase: "loading" });
  useEffect(() => {
    let cancelled = false;
    loadStockLossRows().then(
      (next) => {
        if (cancelled) return;
        setRead(next.available ? { phase: "ready", rows: next.rows, populationCount: next.populationCount } : { phase: "error" });
      },
      () => {
        if (!cancelled) setRead({ phase: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return read;
}

/**
 * Amazon Specs field totals. The metrics row wins when it stores them; otherwise the same sum
 * the Amazon Specs tab takes over the spec rows, read with only the columns it needs.
 */
export function useAmazonFieldTotals(m: CanvasMetricsRow | null): AmazonFieldTotals | null {
  const stored = m ? resolveAmazonFieldTotals(m, null) : null;
  const needRows = m != null && stored == null;
  const [fromRows, setFromRows] = useState<AmazonFieldTotals | null>(null);

  useEffect(() => {
    if (!needRows) return;
    let cancelled = false;
    void loadFilteredPages<FieldTotalRow>(async (page, size) => {
      const result = await getCanvasSupabase()
        .from("canvas_spec_readiness")
        .select("asin,amazon_checked,amazon_fields_found,amazon_fields_expected", { count: "exact" })
        .order("asin")
        .range(page * size, page * size + size - 1);
      return { data: (result.data ?? []) as unknown as FieldTotalRow[], error: result.error, count: result.count };
    }).then(
      (result) => {
        if (!cancelled) setFromRows(result.error ? null : sumAmazonFieldTotals(result.rows));
      },
      () => {
        if (!cancelled) setFromRows(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [needRows]);

  return stored ?? fromRows;
}
