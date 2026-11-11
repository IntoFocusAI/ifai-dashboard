"use client";

import "@/components/v3/live/ai-search/citation-chain.css";
import { useId, type CSSProperties, type ReactNode } from "react";
import { AiStaleMark } from "@/components/v3/live/ai-search/AiStaleMark";
import { CitationFilteredMark } from "@/components/v3/live/ai-search/CitationFilteredMark";
import { citationChain, citationOwnedLinksLead } from "@/lib/ai-search/citation-lead";
import type { CitationRead } from "@/lib/ai-search/citations";
import { pct } from "@/lib/ai-search/summary";
import { brandOwned, brandSite } from "@/lib/brand-copy";

export type CitationLeadInput = { owned: number; total: number };

/** One-line definitions on the chain's labels. */
export const CHAIN_DEFINITIONS = {
  showed: "Answers that listed web pages as sources. The sites and shares on this tab come from these answers.",
  none: "Answers given without showing a web page. These rely on what the model already knows.",
  links: "Every web page those answers listed. One answer can list several.",
  owned: `Links that lead to ${brandSite()} and other ${brandOwned()} sites.`,
  other: "Links to every other site, such as retailers, editorial and review sites, forums, and competitor brands.",
} as const;

/** The thinnest band a nonzero share draws, as a fraction of the band height. */
const MIN_SHARE = 0.08;
const BAND_PX = 24;
/** A rest thinner than this moves its label just under the band. */
const LABEL_FIT_PX = 13;

const count = (n: number) => n.toLocaleString("en-US");

function listed(items: string[]): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function Term({ name, desc, children }: { name: string; desc: string; children: ReactNode }) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={name}
      data-ifai-tooltip-desc={desc}
      tabIndex={0}
      aria-label={`${name}: ${desc}`}
    >
      {children}
    </span>
  );
}

function NotAvailable({ desc }: { desc: string }) {
  return (
    <span className="citation-chain-share">
      <Term name="Not available" desc={desc}>
        Not available*
      </Term>
    </span>
  );
}

/** Height a share draws, as a fraction of the band. A missing share draws nothing. */
function drawn(share: number | null): number {
  if (share == null || share <= 0) return 0;
  return Math.max(share, MIN_SHARE);
}

type Rest = "none" | "gone" | "other";

/**
 * Band under a step. With a rest, the kept part sits on top and the rest, named,
 * beneath it: hatched for answers that listed nothing, solid for links elsewhere.
 */
function Band({ kept, rest, tone, label }: { kept: number; rest: Rest; tone: "answers" | "owned"; label?: ReactNode }) {
  const tight = label != null && (1 - kept) * BAND_PX < LABEL_FIT_PX;
  return (
    <span
      className={`citation-chain-band citation-chain-band-${tone} citation-chain-rest-${rest}${tight ? " citation-chain-band-tight" : ""}`}
    >
      <span className="citation-chain-kept" style={{ height: `${100 * kept}%` }} aria-hidden="true" />
      {label ? <span className="citation-chain-rest">{label}</span> : null}
    </span>
  );
}

/** Connector between two steps: an arrow on the figure line, the band's taper or fan beneath it. */
function Connector({ from, to, rest, owned = false }: { from: number; to: number; rest: Rest; owned?: boolean }) {
  const gradient = useId();
  const a = 100 * from;
  const b = 100 * to;
  return (
    <span className="citation-chain-link" aria-hidden="true">
      <svg className="citation-chain-arrow" viewBox="0 0 16 16" focusable="false">
        <path d="M3 8h9M8.5 4l4 4-4 4" />
      </svg>
      <span className={`citation-chain-flow citation-chain-rest-${rest}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {owned ? (
            <defs>
              <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" className="citation-chain-stop-links" />
                <stop offset="1" className="citation-chain-stop-owned" />
              </linearGradient>
            </defs>
          ) : null}
          <path
            className="citation-chain-flow-kept"
            style={owned ? { fill: `url(#${gradient})` } : undefined}
            d={`M0 0 H100 V${b} C50 ${b} 50 ${a} 0 ${a} Z`}
          />
        </svg>
      </span>
    </span>
  );
}

/**
 * Headline chain of Citation Ecosystem: answers, the answers that showed sources,
 * the links those answers listed, and the links to Fender-owned sites. Each share
 * is of the step before it. An active category or a left-out run adds an asterisk.
 */
export function CitationChain({
  lead,
  read,
  scopeNoun,
  engines,
  note,
  category,
}: {
  lead: CitationLeadInput;
  read: CitationRead;
  scopeNoun: string;
  engines: string[];
  /** Window note, e.g. runs left out because citations were not stored. */
  note: string;
  /** Label of the active category. Every step then carries an asterisk. */
  category: string | null;
}) {
  const { answered, showed, none, links, owned, other, showedShare, ownedShare } = citationChain(read, lead);
  const ownedLead = citationOwnedLinksLead(owned, links);
  const scopeTitle = scopeNoun.charAt(0).toUpperCase() + scopeNoun.slice(1);
  const answersDesc = `${engines.length ? `Answers from ${listed(engines)}` : "Answers"} in this view. Each is one engine's response to one question.`;
  const heights = [answered > 0 ? 1 : 0, drawn(showedShare), links > 0 ? 1 : 0, drawn(ownedShare)];
  const mark = <CitationFilteredMark category={category} />;

  return (
    <div
      className="citation-chain"
      style={{ "--chain-band": `${BAND_PX}px` } as CSSProperties}
      data-citation-figures
      data-citation-chain
    >
      <section className="citation-chain-step" data-citation-chain-step="answers" data-chain-count={answered}>
        <span className="citation-chain-figure">
          <span className="citation-chain-count">{count(answered)}</span>
          <CitationFilteredMark category={category} note={note} />
          <AiStaleMark />
        </span>
        <span className="citation-chain-label">
          <Term name={scopeTitle} desc={answersDesc}>
            {scopeNoun}
          </Term>
        </span>
        <Band kept={heights[0]} rest="gone" tone="answers" />
      </section>

      <Connector from={heights[0]} to={heights[1]} rest="none" />

      <section className="citation-chain-step" data-citation-chain-step="showed" data-chain-count={showed}>
        <span className="citation-chain-figure">
          <span className="citation-chain-count">{count(showed)}</span>
          {showedShare == null ? (
            <NotAvailable desc={`No ${scopeNoun} in this view, so there is no share to show.`} />
          ) : (
            <span className="citation-chain-share">{pct(showed, answered)}</span>
          )}
          {showedShare == null ? null : mark}
        </span>
        <span className="citation-chain-label">
          <Term name="Showed sources" desc={CHAIN_DEFINITIONS.showed}>
            showed sources
          </Term>
        </span>
        <Band
          kept={heights[1]}
          rest="none"
          tone="answers"
          label={
            <span className="citation-chain-rest-label" data-citation-chain-rest="none" data-chain-count={none}>
              <Term name="No sources" desc={CHAIN_DEFINITIONS.none}>
                {count(none)} no sources
              </Term>
            </span>
          }
        />
        <span className="sr-only" data-ai-cited-answers>
          {count(showed)} of {count(answered)} {scopeNoun} showed sources
        </span>
      </section>

      <Connector from={heights[1]} to={heights[2]} rest="gone" />

      <section className="citation-chain-step" data-citation-chain-step="links" data-chain-count={links}>
        <span className="citation-chain-figure">
          <span className="citation-chain-count" data-ai-cited-links>
            {count(links)}
          </span>
          {mark}
        </span>
        <span className="citation-chain-label">
          <Term name="Links" desc={CHAIN_DEFINITIONS.links}>
            links
          </Term>
        </span>
        <Band kept={heights[2]} rest="gone" tone="answers" />
      </section>

      <Connector from={heights[2]} to={heights[3]} rest="other" owned />

      <section
        className="citation-chain-step citation-chain-step-owned"
        data-citation-chain-step="owned"
        data-chain-count={owned}
        data-citation-lead
        data-citation-lead-total={links}
        data-citation-lead-owned={owned}
        data-citation-lead-category={category ?? ""}
      >
        <span className="citation-chain-figure">
          <span className="citation-chain-count">{count(owned)}</span>
          {ownedLead.population ? (
            <span className="citation-chain-share" data-citation-lead-figure>
              {ownedLead.figure}
            </span>
          ) : (
            <NotAvailable desc={`No links in this view, so there is no ${brandOwned()} share to show.`} />
          )}
          {ownedLead.population ? mark : null}
        </span>
        <span className="citation-chain-label" data-citation-lead-label>
          <Term name={`To ${brandOwned()} sites`} desc={CHAIN_DEFINITIONS.owned}>
            to {brandOwned()} sites
          </Term>
        </span>
        <Band
          kept={heights[3]}
          rest="other"
          tone="owned"
          label={
            <span className="citation-chain-rest-label" data-citation-chain-rest="other" data-chain-count={other}>
              <Term name="Other sites" desc={CHAIN_DEFINITIONS.other}>
                {count(other)} other sites
              </Term>
            </span>
          }
        />
        {ownedLead.population ? (
          <span className="sr-only" data-citation-lead-population>
            {count(owned)} of {count(links)} links lead to {brandOwned()} sites
          </span>
        ) : null}
      </section>
    </div>
  );
}
