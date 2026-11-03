"use client";

import "@/components/v3/live/ai-search/citation-top-sources.css";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { sliceColor } from "@/components/v3/live/ai-search/CitationPieDisc";
import type { CitationRead } from "@/lib/ai-search/citations";
import { TOP_SOURCES_MAX, topCitedSources, type TopCitedSource } from "@/lib/ai-search/citation-top-sources";

function SourceRow({
  source,
  max,
  scopeNoun,
  active,
  onPick,
}: {
  source: TopCitedSource;
  /** The largest count shown, so the leader fills its track. */
  max: number;
  scopeNoun: string;
  active: boolean;
  onPick: (domain: string) => void;
}) {
  const owner = source.fenderOwned ? "Fender-owned" : "Not Fender-owned";
  return (
    <li>
      <button
        type="button"
        className={`citation-top-source${active ? " active" : ""}`}
        aria-pressed={active}
        data-citation-top-source={source.domain}
        data-top-source-rank={source.rank}
        data-top-source-n={source.answers}
        data-top-source-m={source.answered}
        data-top-source-links={source.links}
        data-fender-owned={source.fenderOwned ? "yes" : "no"}
        aria-label={`${source.rank}. ${source.domain}: cited in ${source.answers} of ${source.answered} ${scopeNoun}, ${source.links} cited ${source.links === 1 ? "link" : "links"}. ${owner}, ${source.classLabel}. Opens its cited links.`}
        onClick={() => {
          onPick(source.domain);
          document.querySelector(".ai-citation-evidence")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <span className="citation-top-source-rank">{source.rank}</span>
        <span className="citation-top-source-site">
          <span className="citation-top-source-domain">{source.domain}</span>
          {source.fenderOwned ? (
            <span className="citation-top-source-owner">Fender-owned</span>
          ) : (
            <span className="citation-top-source-class">{source.classLabel}</span>
          )}
        </span>
        <span className="citation-top-source-track" aria-hidden="true">
          <span
            className="citation-top-source-fill"
            style={{ width: `${(100 * source.answers) / max}%`, background: sliceColor(source.sourceClass) }}
          />
        </span>
        <span className="citation-top-source-value" data-top-source-ratio>
          <strong>{source.answers}</strong> of {source.answered}
        </span>
      </button>
    </li>
  );
}

/** The sites cited in the most answers in view. Each row opens that site's cited links. */
export function CitationTopSources({
  read,
  scopeNoun,
  category,
  activeDomain,
  onPickDomain,
}: {
  read: CitationRead;
  scopeNoun: string;
  category: string | null;
  activeDomain: string | null;
  onPickDomain: (domain: string) => void;
}) {
  const ranked = topCitedSources(read, TOP_SOURCES_MAX);
  const max = Math.max(1, ...ranked.map((source) => source.answers));
  return (
    <section
      className="citation-card citation-top-sources"
      data-citation-top-sources
      data-top-sources-answered={read.answered}
      data-top-sources-category={category ?? ""}
    >
      <div className="citation-top-sites-head">
        <h3 className="citation-card-kicker">
          <AiTerm term="top cited sites">Top cited sites</AiTerm>
        </h3>
      </div>
      {read.answered === 0 ? (
        <p className="citation-card-note">No {scopeNoun} in this view.</p>
      ) : ranked.length === 0 ? (
        <p className="citation-card-note">None of the {read.answered} {scopeNoun} in this view cited a site.</p>
      ) : (
        <ol className="citation-top-source-list">
          {ranked.map((source) => (
            <SourceRow
              key={source.domain}
              source={source}
              max={max}
              scopeNoun={scopeNoun}
              active={activeDomain === source.domain}
              onPick={onPickDomain}
            />
          ))}
        </ol>
      )}
      <div className="citation-top-sites-foot">
        <p className="citation-card-caveat">
          Each count is an <AiTerm term="association">association</AiTerm>: the answer cited the site. It
          does not show that the site caused what the answer said.
        </p>
      </div>
    </section>
  );
}
