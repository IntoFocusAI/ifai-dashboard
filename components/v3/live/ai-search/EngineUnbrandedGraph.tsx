"use client";

import { AiTerm } from "@/components/v3/live/ai-search/AiTerm";
import { sliceColor } from "@/components/v3/live/ai-search/CitationPieDisc";
import { unbrandedEnginesWeakestFirst } from "@/components/v3/live/ai-search/engineUnbrandedGraph";
import { EvidenceLink } from "@/components/v3/live/ai-search/EvidenceLink";
import { AI_TABS } from "@/lib/ai-search/canvas-surfaces";
import type { RoleGroupTally } from "@/lib/ai-search/question-role";
import { engineLabel, isSmallSample } from "@/lib/ai-search/run-metrics";
import { pct, SMALL_SAMPLE_LABEL } from "@/lib/ai-search/summary";
import { formatInt } from "@/lib/fender-canvas/format";
import { leadBrand } from "@/lib/brand-copy";

const SIM = AI_TABS.simulations;

/**
 * Unbranded discovery by engine. One mark per engine with resolved answers.
 * Weakest Fender-lead share first. Counts stay visible beside the bar.
 */
export function EngineUnbrandedGraph({
  engines,
  showSmallSample,
}: {
  engines: readonly RoleGroupTally[];
  showSmallSample: boolean;
}) {
  const marks = unbrandedEnginesWeakestFirst(engines);
  const largest = Math.max(0, ...marks.map((engine) => engine.roles.unbranded_discovery.resolved));

  return (
    <div className="ai-engine-unbranded-graph" data-ai-engine-unbranded-graph="">
      <div className="content-box-title" style={{ marginTop: 12 }}>
        <span>
          <AiTerm term="unbranded discovery">Unbranded discovery</AiTerm> by engine
        </span>
      </div>
      {marks.length === 0 ? (
        <p className="ai-role-footnote" data-ai-engine-unbranded-empty="">
          No resolved answers
        </p>
      ) : (
        <ul className="ai-engine-unbranded-list">
          {marks.map((engine) => {
            const tally = engine.roles.unbranded_discovery;
            const rest = tally.resolved - tally.fenderWins;
            const fenderPct = (100 * tally.fenderWins) / tally.resolved;
            const restPct = 100 - fenderPct;
            const small = showSmallSample && isSmallSample(tally.resolved, largest);
            const name = engineLabel(engine.key);
            return (
              <li key={engine.key} data-engine={engine.key} data-ai-engine-mark="" data-small-sample={small ? "true" : undefined}>
                <span className="ai-engine-unbranded-name">
                  <EvidenceLink focus={{ field: "engine", value: engine.key }} tab={SIM}>
                    {name}
                  </EvidenceLink>
                </span>
                <div
                  className="ai-engine-unbranded-bar"
                  role="img"
                  aria-label={`${name}: ${formatInt(tally.fenderWins)} ${leadBrand()} leads, ${formatInt(rest)} rest of resolved answers, of ${formatInt(tally.resolved)} resolved answers.`}
                >
                  {tally.fenderWins > 0 ? (
                    <span
                      className="ai-engine-unbranded-seg"
                      data-ai-seg="fender"
                      style={{ width: `${fenderPct}%`, background: sliceColor("fender") }}
                    >
                      <span className="ai-engine-unbranded-count">{formatInt(tally.fenderWins)}</span>
                    </span>
                  ) : null}
                  {rest > 0 ? (
                    <span
                      className="ai-engine-unbranded-seg"
                      data-ai-seg="other"
                      style={{ width: `${restPct}%`, background: sliceColor("other") }}
                    >
                      <span className="ai-engine-unbranded-count">{formatInt(rest)}</span>
                    </span>
                  ) : null}
                </div>
                <span className="ai-engine-unbranded-rate" data-ai-engine-rate="">
                  {pct(tally.fenderWins, tally.resolved)}
                  {small ? (
                    <>
                      {" "}
                      <AiTerm term="small sample">{SMALL_SAMPLE_LABEL}</AiTerm>
                    </>
                  ) : null}
                </span>
                <div className="ai-engine-unbranded-legend">
                  <span data-ai-seg-label="fender">{leadBrand()} leads: {formatInt(tally.fenderWins)}</span>
                  <span data-ai-seg-label="other">Rest of resolved answers: {formatInt(rest)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
