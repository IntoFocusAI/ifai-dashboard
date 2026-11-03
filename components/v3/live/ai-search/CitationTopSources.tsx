"use client";

import "@/components/v3/live/ai-search/citation-top-sources.css";
import { useState } from "react";
import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import type { CitationRead } from "@/lib/ai-search/citations";
import {
  TOP_SITES_RULE,
  TOP_SOURCES_MAX,
  topCitedSources,
  type TopCitedSource,
  type TopSitesMeasure,
} from "@/lib/ai-search/citation-top-sources";

const MEASURES: Array<[TopSitesMeasure, string]> = [
  ["answers", "Answers"],
  ["links", "Links"],
];

const count = (n: number) => n.toLocaleString("en-US");

/** Shown in each site's tooltip and spoken with its row. */
export const TOP_SITE_ASSOCIATION =
  "Each count is an association: the answer cited the site. It does not show that the site caused what the answer said.";

function scrollToEvidence() {
  document.querySelector(".ai-citation-evidence")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SourceRow({
  source,
  measure,
  max,
  scopeNoun,
  active,
  onPick,
}: {
  source: TopCitedSource;
  measure: TopSitesMeasure;
  /** The largest count shown, so the leader fills its track. */
  max: number;
  scopeNoun: string;
  active: boolean;
  onPick: (domain: string) => void;
}) {
  const owner = source.fenderOwned ? "Fender-owned" : "Not Fender-owned";
  const [n, m] = measure === "links" ? [source.links, source.linksTotal] : [source.answers, source.answered];
  const counts = `Cited in ${count(source.answers)} of ${count(source.answered)} ${scopeNoun}, ${count(source.links)} of ${count(source.linksTotal)} links.`;
  return (
    // The tooltip sits on the row so the button keeps its own border; focusing the button shows it too.
    <li
      className="citation-chart-tip ifai-term"
      data-ifai-tooltip-title={source.domain}
      data-ifai-tooltip-desc={`${counts} ${TOP_SITE_ASSOCIATION}`}
    >
      <button
        type="button"
        className={`citation-top-source${active ? " active" : ""}${source.fenderOwned ? " citation-top-source-fender" : ""}`}
        aria-pressed={active}
        data-citation-top-source={source.domain}
        data-top-source-rank={source.rank}
        data-top-source-n={source.answers}
        data-top-source-m={source.answered}
        data-top-source-links={source.links}
        data-fender-owned={source.fenderOwned ? "yes" : "no"}
        aria-label={`${source.rank}. ${source.domain}: ${counts} ${owner}, ${source.classLabel}. ${TOP_SITE_ASSOCIATION} Opens its cited links.`}
        onClick={() => {
          onPick(source.domain);
          scrollToEvidence();
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
          <span className="citation-top-source-fill" style={{ width: `${(100 * n) / max}%` }} />
        </span>
        <span className="citation-top-source-value" data-top-source-ratio>
          <strong>{count(n)}</strong> of {count(m)}
        </span>
      </button>
    </li>
  );
}

/** The one ranked chart of cited sites. A toggle switches between answers citing a site and links to it. */
export function CitationTopSources({
  read,
  scopeNoun,
  category,
  activeDomain,
  onPickDomain,
  onShowAll,
}: {
  read: CitationRead;
  scopeNoun: string;
  category: string | null;
  activeDomain: string | null;
  onPickDomain: (domain: string) => void;
  /** Clears any pick so the cited-links table lists every site. */
  onShowAll: () => void;
}) {
  const [measure, setMeasure] = useState<TopSitesMeasure>("answers");
  const ranked = topCitedSources(read, TOP_SOURCES_MAX, measure);
  const max = Math.max(1, ...ranked.map((source) => (measure === "links" ? source.links : source.answers)));
  const sites = new Set(read.rows.map((row) => row.domain)).size;
  return (
    <section
      className="citation-card citation-top-sources"
      data-citation-top-sources
      data-top-sources-answered={read.answered}
      data-top-sources-category={category ?? ""}
      data-top-sites-measure={measure}
    >
      <div className="citation-top-sites-head">
        <h3 className="citation-card-kicker">
          <AiTerm term={TOP_SITES_RULE[measure]}>Top cited sites</AiTerm>
        </h3>
        <div role="group" aria-label="Rank sites by" className="segmented-control citation-top-sites-measure">
          {MEASURES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`segmented-btn${measure === value ? " active" : ""}`}
              aria-pressed={measure === value}
              data-citation-top-measure={value}
              onClick={() => setMeasure(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {read.answered === 0 ? (
        <p className="citation-card-note">No {scopeNoun} in this view.</p>
      ) : ranked.length === 0 ? (
        <p className="citation-card-note">None of the {read.answered} {scopeNoun} in this view cited a site.</p>
      ) : (
        <ol
          className="citation-top-source-list"
          style={{ gridTemplateRows: `repeat(${Math.ceil(ranked.length / 2)}, auto)` }}
        >
          {ranked.map((source) => (
            <SourceRow
              key={source.domain}
              source={source}
              measure={measure}
              max={max}
              scopeNoun={scopeNoun}
              active={activeDomain === source.domain}
              onPick={onPickDomain}
            />
          ))}
        </ol>
      )}
      {sites > 0 ? (
        <div className="citation-top-sites-foot">
          <button
            type="button"
            className="citation-top-sites-more"
            data-citation-top-sources-all
            onClick={() => {
              onShowAll();
              scrollToEvidence();
            }}
          >
            See all {count(sites)} sites
          </button>
        </div>
      ) : null}
    </section>
  );
}
