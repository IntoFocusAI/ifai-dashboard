"use client";

import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { sourceHref, sourceTip } from "@/components/v3/live/estimates/trail-copy";
import type { BenchmarkSource } from "@/lib/estimates/types";

/**
 * The sources with links and dates. Whether a source has been checked against its page sits in
 * the source's tooltip, never on screen (let the data speak).
 */
export function EstimateTrailSources({ sources }: { sources: BenchmarkSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ol className="estimate-trail-sources" data-estimate-sources={sources.length}>
      {sources.map((source) => {
        const attrs = figureTipAttrs(source.title, sourceTip(source), "estimate-source");
        const href = sourceHref(source.url);
        return (
          <li key={source.id} data-estimate-source={source.id} data-source-verified={source.verified ? "true" : "false"}>
            {href ? (
              <a {...attrs} href={href} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer">
                {source.title}
              </a>
            ) : (
              <span {...attrs}>{source.title}</span>
            )}
            {source.date ? <span className="estimate-source-date">{source.date}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
