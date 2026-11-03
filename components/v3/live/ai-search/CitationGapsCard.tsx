"use client";

import type { CitationGap } from "@/lib/ai-search/citation-insights";

const KICKER = <h3 className="citation-card-kicker">Biggest actionable gaps</h3>;

/** Categories where a competitor led and no Fender-owned page was cited. Each row opens those answers. */
export function GapsCard({
  gaps,
  ok,
  applicable,
  showAll,
  onToggleAll,
  onPickGap,
}: {
  gaps: CitationGap[];
  ok: boolean;
  applicable: boolean;
  showAll: boolean;
  onToggleAll: () => void;
  onPickGap: (gap: CitationGap) => void;
}) {
  if (!applicable) {
    return (
      <section className="citation-card citation-tile citation-card-gaps" data-citation-gaps>
        {KICKER}
        <p className="citation-card-note">
          Gap ranking uses competitor-led shopping answers. Choose Shopping answers or All answers to see it.
        </p>
      </section>
    );
  }
  if (!ok) {
    return (
      <section className="citation-card citation-tile citation-card-gaps" data-citation-gaps>
        {KICKER}
        <p data-citation-reconcile>
          The gap ranking is hidden because category counts do not match the losing-answer total.
        </p>
      </section>
    );
  }
  const visible = showAll ? gaps : gaps.slice(0, 3);
  return (
    <section className="citation-card citation-tile citation-card-gaps" data-citation-gaps>
      {KICKER}
      <p className="citation-card-lead">Competitor led, no Fender-owned page cited</p>
      {visible.length === 0 ? (
        <p className="citation-card-note">
          No competitor-led discovery or consideration answers lacked a Fender-owned citation.
        </p>
      ) : (
        <ol className="citation-gap-list">
          {visible.map((gap) => {
            const domains = gap.topDomains.length
              ? `Top cited: ${gap.topDomains.map((d) => `${d.domain} (${d.links})`).join(", ")}`
              : "No third-party links recorded in those answers";
            return (
              <li key={gap.category}>
                <button
                  type="button"
                  className="citation-gap-btn"
                  data-citation-gap={gap.category}
                  data-ai-pick={`gap:${gap.category}`}
                  aria-label={`${gap.count} ${gap.categoryLabel} answers: ${gap.competitor} led and no Fender-owned page was cited. ${domains}. Opens their cited links.`}
                  onClick={() => onPickGap(gap)}
                >
                  <span className="citation-gap-count">{gap.count}</span>
                  <span className="citation-gap-body">
                    <span>
                      <strong>{gap.categoryLabel}</strong> · {gap.competitor} led
                    </span>
                    <span className="citation-gap-domains">{domains}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {gaps.length > 3 ? (
        <button type="button" className="citation-gap-more" data-citation-gaps-toggle onClick={onToggleAll}>
          {showAll ? "Show top three" : `See full ranking (${gaps.length} categories)`}
        </button>
      ) : null}
    </section>
  );
}
