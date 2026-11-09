"use client";

import "@/components/v3/live/catalog-health.css";
import { figureTipAttrs } from "@/components/v3/live/FigureTip";

/** Where a number comes from. Estimate marks a figure built from more than one source. */
export type DataSource = "Keepa" | "SmartScout" | "Estimate";

const SOURCE_TITLES: Record<DataSource, string> = {
  Keepa: "From Keepa's Amazon price, stock and sales-rank history.",
  SmartScout: "From SmartScout's Amazon sales estimates.",
  Estimate: "Analyst estimate built from Keepa and SmartScout inputs. Not reported sales.",
};

/** The source name with its definition in the shared custom tooltip (no native title). */
export function SourceTag({ source }: { source: DataSource }) {
  return (
    <span
      {...figureTipAttrs(source, SOURCE_TITLES[source], "source-tag")}
      className={`source-tag source-tag-${source.toLowerCase()} ifai-term`}
      data-source={source}
    >
      {source}
    </span>
  );
}

/** Marks a section or figure added recently. Remove once it is no longer new. */
export function NewTag() {
  return (
    <span
      {...figureTipAttrs("New", "Recently added to the dashboard.", "new-tag")}
      className="tag-badge new-tag ifai-term"
      data-new-tag
    >
      New
    </span>
  );
}
