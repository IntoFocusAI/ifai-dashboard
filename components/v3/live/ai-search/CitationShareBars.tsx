"use client";

import "@/components/v3/live/ai-search/citation-share-bars.css";
import type { CitationPie } from "@/lib/ai-search/citation-pies";

const count = (n: number) => n.toLocaleString("en-US");

function scrollToEvidence() {
  document.querySelector(".ai-citation-evidence")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** One whole as a track: the Fender-owned part in Fender blue. Its tooltip gives N of M. */
export function OwnedShareBar({
  id,
  owned,
  total,
  name,
  tip,
}: {
  id: string;
  owned: number;
  total: number;
  name: string;
  tip: string;
}) {
  const share = total > 0 ? owned / total : 0;
  return (
    <span
      className="citation-share-bar citation-chart-tip ifai-term"
      role="img"
      tabIndex={0}
      data-citation-pie={id}
      data-pie-total={total}
      data-ifai-tooltip-title={name}
      data-ifai-tooltip-desc={tip}
      aria-label={`${name}. ${tip}`}
    >
      <span className="citation-share-fill" style={{ width: `${100 * share}%` }} />
    </span>
  );
}

/** Brand sites as one stacked bar, Fender-owned brands in Fender blue, then a legend with counts. */
export function BrandStackBar({ pie, tip }: { pie: CitationPie; tip: string }) {
  return (
    <figure className="citation-stack" data-citation-pie={pie.id} data-pie-total={pie.total}>
      <span
        className="citation-stack-bar citation-chart-tip ifai-term"
        role="img"
        tabIndex={0}
        data-ifai-tooltip-title={pie.title}
        data-ifai-tooltip-desc={tip}
        aria-label={`${pie.title}. ${tip}`}
      >
        {pie.slices.map((slice) => (
          <span
            key={slice.key}
            className={`citation-stack-seg${slice.owned ? " citation-stack-seg-owned" : ""}`}
            style={{ flexGrow: slice.count }}
          />
        ))}
      </span>
      <figcaption>
        <ul className="citation-stack-legend">
          {pie.slices.map((slice) => (
            <li
              key={slice.key}
              className={`citation-chart-tip ifai-term${slice.owned ? " citation-stack-owned" : ""}`}
              data-pie-count={slice.count}
              data-pie-label={slice.label}
              data-ifai-tooltip-title={slice.label}
              data-ifai-tooltip-desc={`${slice.label}: ${slice.count} of ${pie.total} ${pie.totalLabel}.`}
              tabIndex={0}
              aria-label={`${slice.label}: ${slice.count} of ${pie.total} ${pie.totalLabel}.`}
            >
              {slice.label} <strong>{count(slice.count)}</strong>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/**
 * Ranked bars, largest first, Fender-owned in Fender blue. Each row opens its links
 * in the table below. The caveat sits in every row's tooltip.
 */
export function RankedShareBars({
  pie,
  ownedKey,
  caveat,
  onPick,
}: {
  pie: CitationPie;
  ownedKey: string;
  caveat: string;
  onPick: (key: string) => void;
}) {
  const ranked = [...pie.slices].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...ranked.map((slice) => slice.count));
  return (
    <ol className="citation-rank-bars" data-citation-pie={pie.id} data-pie-total={pie.total}>
      {ranked.map((slice) => {
        const desc = `${slice.label}: ${count(slice.count)} of ${count(pie.total)} ${pie.totalLabel}. ${caveat}`;
        return (
          <li
            key={slice.key}
            className="citation-chart-tip ifai-term"
            data-pie-count={slice.count}
            data-pie-label={slice.label}
            data-ifai-tooltip-title={slice.label}
            data-ifai-tooltip-desc={desc}
          >
            <button
              type="button"
              className={`citation-rank-bar${slice.key === ownedKey ? " citation-rank-bar-owned" : ""}`}
              data-citation-mix-class={slice.key}
              aria-label={`${desc} Opens its links.`}
              onClick={() => {
                onPick(slice.key);
                scrollToEvidence();
              }}
            >
              <span className="citation-rank-bar-label">{slice.label}</span>
              <span className="citation-rank-bar-track" aria-hidden="true">
                <span className="citation-rank-bar-fill" style={{ width: `${(100 * slice.count) / max}%` }} />
              </span>
              <span className="citation-rank-bar-value">{count(slice.count)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
