"use client";

import type { CanvasFreshnessRow } from "@/lib/fender-canvas/types";

const JOB_LABELS: Record<string, string> = {
  catalog_harvester: "Catalog",
  buybox_seller_harvester: "Buy Box sellers",
  featured_offer_keepa: "Buy Box",
  map_leakage_walmart: "Walmart MAP",
  map_parity_musiciansfriend: "MF MAP",
  spec_readiness: "Spec audit",
  kpi_recompute: "KPI recompute",
  ai_simulations: "AI battery",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "n/a";
  const then = new Date(iso).getTime();
  const diffH = (Date.now() - then) / (1000 * 60 * 60);
  if (diffH < 1) return `${Math.round(diffH * 60)}m ago`;
  if (diffH < 48) return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

function maxRunAt(rows: CanvasFreshnessRow[]): Date | null {
  let max: number | null = null;
  for (const row of rows) {
    if (!row.last_run_at) continue;
    const t = new Date(row.last_run_at).getTime();
    if (max == null || t > max) max = t;
  }
  return max != null ? new Date(max) : null;
}

export function DataFreshnessBar({
  fresh,
  stale,
}: {
  fresh: CanvasFreshnessRow[];
  stale?: boolean;
}) {
  const asOf = maxRunAt(fresh);
  const asOfLabel = asOf
    ? asOf.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "n/a";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "var(--text-muted)",
      }}
    >
      <span
        className="ifai-term"
        data-ifai-tooltip-title="Data freshness"
        data-ifai-tooltip-desc={fresh
          .map(
            (r) =>
              `${JOB_LABELS[r.job_key] ?? r.job_key}: ${relativeTime(r.last_run_at)}${
                r.last_run_at &&
                Date.now() - new Date(r.last_run_at).getTime() >
                  26 * 3600 * 1000
                  ? " (stale)"
                  : ""
              }`,
          )
          .join("; ")}
        tabIndex={0}
        aria-label={`Data as of ${asOfLabel}`}
      >
        Data as of {asOfLabel}
      </span>
      {stale ? (
        <span className="tag-badge tag-warning" style={{ fontSize: 11 }}>
          Stale
        </span>
      ) : null}
    </div>
  );
}
