import { AI_DEFINITIONS, type AiTermKey } from "@/lib/ai-search/definitions";
import { READ_NOT_AVAILABLE } from "@/lib/fender-canvas/canvas-reads";
import { sanitizeUiText } from "@/lib/fender-canvas/format";
import { DECK_PAGE, type StoryDeck, type StoryDeckFinding, type StoryDeckRate } from "@/lib/story-deck/story-deck";

const RATE_TERM: Record<StoryDeckRate["id"], AiTermKey> = {
  unbranded_discovery: "unbranded discovery",
  branded_consideration: "branded consideration",
};

function termProps(title: string, desc: string, className: string) {
  const description = sanitizeUiText(desc);
  return {
    className: `${className} ifai-term`,
    "data-ifai-tooltip-title": title,
    "data-ifai-tooltip-desc": description,
    tabIndex: 0 as const,
    "aria-label": `${title}: ${description}`,
  };
}

function Finding({ finding }: { finding: StoryDeckFinding }) {
  const failed = finding.percent === READ_NOT_AVAILABLE && finding.note;
  return (
    <li className="deck-finding" data-deck-finding={finding.id}>
      <span {...termProps(finding.label, finding.explainer, "deck-finding-label")}>{finding.label}</span>
      {finding.percent == null ? (
        <p className="deck-note" data-deck-finding-note="">
          {finding.note}
        </p>
      ) : (
        <>
          <span
            data-deck-finding-percent=""
            style={finding.color ? { color: finding.color } : undefined}
            {...(failed && finding.note
              ? termProps(READ_NOT_AVAILABLE, finding.note, "deck-finding-percent")
              : { className: "deck-finding-percent" })}
          >
            {finding.percent}
          </span>
          {finding.ratio ? (
            <span className="deck-finding-ratio" data-deck-finding-ratio="">
              {finding.ratio}
            </span>
          ) : null}
        </>
      )}
    </li>
  );
}

function Rate({ rate }: { rate: StoryDeckRate }) {
  return (
    <div className="deck-rate" data-deck-rate={rate.id}>
      <span {...termProps(rate.label, AI_DEFINITIONS[RATE_TERM[rate.id]], "deck-rate-label")}>{rate.label}</span>
      <span
        data-deck-rate-percent=""
        style={rate.color ? { color: rate.color } : undefined}
        {...(rate.tip
          ? termProps(rate.label, rate.tip, "deck-rate-percent")
          : { className: "deck-rate-percent" })}
      >
        {rate.percent}
      </span>
      {rate.ratio ? (
        <span className="deck-rate-ratio" data-deck-rate-ratio="">
          {rate.ratio}
        </span>
      ) : null}
    </div>
  );
}

/** The pack: window name, five briefing findings, and the published run. */
export function DeckView({ deck }: { deck: StoryDeck }) {
  const published = deck.published;
  return (
    <>
      <p className="deck-lead">{DECK_PAGE.lead}</p>
      <section className="deck-section" aria-labelledby="deck-window-heading">
        <h2 id="deck-window-heading">{DECK_PAGE.windowHeading}</h2>
        <p className="deck-window" data-deck-window="">
          {deck.windowLabel}
        </p>
      </section>
      <section className="deck-section" aria-labelledby="deck-findings-heading">
        <h2 id="deck-findings-heading">{DECK_PAGE.findingsHeading}</h2>
        <ul className="deck-findings">
          {deck.findings.map((finding) => (
            <Finding key={finding.id} finding={finding} />
          ))}
        </ul>
      </section>
      <section className="deck-section" aria-labelledby="deck-published-heading" data-deck-published={published.phase}>
        <h2 id="deck-published-heading">{DECK_PAGE.publishedHeading}</h2>
        {published.phase === "ready" ? (
          <>
            <p className="deck-run-id" data-deck-run-id="">
              {published.runId}
            </p>
            <div className="deck-rates">
              <Rate rate={published.unbranded} />
              <Rate rate={published.branded} />
            </div>
          </>
        ) : (
          <p className="deck-run-copy" data-deck-published-copy="">
            {published.copy}
          </p>
        )}
      </section>
    </>
  );
}
