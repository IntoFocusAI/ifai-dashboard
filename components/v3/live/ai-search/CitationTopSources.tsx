"use client";

import "@/components/v3/live/ai-search/citation-top-sources.css";
import { useState } from "react";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { CitationCategoryFilter } from "@/components/v3/live/ai-search/CitationCategoryFilter";
import { sliceColor } from "@/components/v3/live/ai-search/CitationPieDisc";
import type { CitationRead } from "@/lib/ai-search/citations";
import {
  TOP_SOURCES_FIRST,
  TOP_SOURCES_MAX,
  topCitedSources,
  type CitationCategoryOption,
  type TopCitedSource,
} from "@/lib/ai-search/citation-top-sources";

function SourceRow({
  source,
  scopeNoun,
  active,
  onPick,
}: {
  source: TopCitedSource;
  scopeNoun: string;
  active: boolean;
  onPick: (domain: string) => void;
}) {
  const share = source.answered > 0 ? (100 * source.answers) / source.answered : 0;
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
        aria-label={`${source.rank}. ${source.domain}: cited in ${source.answers} of ${source.answered} ${scopeNoun}. ${owner}. Opens its ${source.links} cited links.`}
        onClick={() => {
          onPick(source.domain);
          document.querySelector(".ai-citation-evidence")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <span className="citation-top-source-rank">{source.rank}</span>
        <span className="citation-top-source-body">
          <strong className="citation-top-source-domain">{source.domain}</strong>
          <span className="citation-top-source-count" data-top-source-ratio>
            Cited in {source.answers} of {source.answered} {scopeNoun}
          </span>
          <span className="citation-top-source-track" aria-hidden="true">
            <span
              className="citation-top-source-fill"
              style={{ width: `${share}%`, background: sliceColor(source.sourceClass) }}
            />
          </span>
        </span>
        <span className="citation-top-source-side">
          <span className={`citation-top-source-owner${source.fenderOwned ? " owned" : ""}`}>{owner}</span>
          <span className="citation-top-source-links">
            {source.fenderOwned ? "" : `${source.classLabel} · `}Open {source.links}{" "}
            {source.links === 1 ? "link" : "links"}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Opens Citation Ecosystem after the lead figure: the sites cited in the most answers. */
export function CitationTopSources({
  read,
  scopeNoun,
  categories,
  category,
  onCategory,
  activeDomain,
  onPickDomain,
}: {
  read: CitationRead;
  scopeNoun: string;
  categories: CitationCategoryOption[];
  category: string | null;
  onCategory: (category: string | null) => void;
  activeDomain: string | null;
  onPickDomain: (domain: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ranked = topCitedSources(read, TOP_SOURCES_MAX);
  const shown = expanded ? ranked : ranked.slice(0, TOP_SOURCES_FIRST);
  return (
    <div className="citation-top-sources-block">
      <CitationCategoryFilter options={categories} value={category} scopeNoun={scopeNoun} onChange={onCategory} />
      <section
        className="citation-card citation-top-sources"
        data-citation-top-sources
        data-top-sources-answered={read.answered}
        data-top-sources-category={category ?? ""}
      >
        <h3 className="citation-card-kicker">
          <AiTerm term="top cited sites">Top cited sites</AiTerm>
        </h3>
        {read.answered === 0 ? (
          <p className="citation-card-note">No {scopeNoun} in this view.</p>
        ) : ranked.length === 0 ? (
          <p className="citation-card-note">None of the {read.answered} {scopeNoun} in this view cited a site.</p>
        ) : (
          <ol className="citation-top-source-list">
            {shown.map((source) => (
              <SourceRow
                key={source.domain}
                source={source}
                scopeNoun={scopeNoun}
                active={activeDomain === source.domain}
                onPick={onPickDomain}
              />
            ))}
          </ol>
        )}
        {ranked.length > TOP_SOURCES_FIRST ? (
          <button
            type="button"
            className="citation-gap-more"
            data-citation-top-sources-toggle
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? `Show top ${TOP_SOURCES_FIRST}` : `Show top ${ranked.length}`}
          </button>
        ) : null}
        <p className="citation-card-caveat">
          Each count is an <AiTerm term="association">association</AiTerm>: the answer cited the site. It
          does not show that the site caused what the answer said.
        </p>
      </section>
    </div>
  );
}
