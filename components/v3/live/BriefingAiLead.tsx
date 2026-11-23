"use client";

import "@/components/v3/live/roadmap-plan.css";
import { Fragment, useCallback, useRef, useState, type ReactNode } from "react";
import { figureTipAttrs, PartialFigureMark } from "@/components/v3/live/FigureTip";
import type { PartialFigure } from "@/lib/fender-canvas/canvas-reads";
import { useFindability } from "@/components/v3/live/findability/FindabilityContext";
import { useSummaryAiRead, useSummaryAiStale } from "@/components/v3/live/useSummaryAiRead";
import { EstimateFigure } from "@/components/v3/live/estimates/OpportunityEstimates";
import { EstimateTrail } from "@/components/v3/live/estimates/EstimateTrail";
import { summarizeRun } from "@/lib/ai-search/summary";
import { brandName, brandSite } from "@/lib/brand-copy";
import type { PriorityItem } from "@/lib/canvas-sdk/types";
import { activeClient, activeClientSettings } from "@/lib/client/active-client";
import { estimateMonthlyPotential } from "@/lib/estimates/monthly";
import type { EstimateResult } from "@/lib/estimates/types";
import { ESTIMATE_LOADING, NO_ANALYST_ESTIMATE } from "@/lib/fender-canvas/analyst-estimates";
import { AI_READ_FAILED, briefingFindingsLead } from "@/lib/fender-canvas/briefing-retail-lead";
import {
  answerBlock,
  firstMoveBlock,
  narrativeGaps,
  relyBlock,
  sellingModelLine,
  TERM_TIPS,
  worthBlock,
  type NarrativeBlock,
  type NarrativeInput,
  type NarrativeSentence,
} from "@/lib/fender-canvas/briefing-narrative";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import { specHero } from "@/lib/fender-canvas/retail-overview-lead";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

const BLOCK_STYLE = { margin: "0 0 8px", lineHeight: 1.5 } as const;
const NO_AI_ANSWERS_TIP = "No AI answers to unbranded questions in this date range.";

/** The monthly figure inside the sentence; it opens the estimate's inputs, sources and formula. */
function MonthlyFigure({ text, result }: { text: string; result: EstimateResult }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    ref.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="estimate-trail-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-estimate-trigger={result.lineId}
        style={{ display: "inline", fontWeight: 600, textDecoration: "underline dotted", textUnderlineOffset: 3 }}
      >
        {text}
        {result.asterisk ? "*" : null}
      </button>
      {open ? <EstimateTrail result={result} onClose={close} /> : null}
    </>
  );
}

function Sentence({ parts, brand, monthly }: { parts: NarrativeSentence; brand: string; monthly: EstimateResult | null }) {
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === "string") return <Fragment key={index}>{part}</Fragment>;
        if ("figure" in part) {
          return monthly ? <MonthlyFigure key={index} text={part.text} result={monthly} /> : <Fragment key={index}>{part.text}</Fragment>;
        }
        const tip = TERM_TIPS[part.term];
        return (
          <span key={index} {...figureTipAttrs(tip.title, tip.desc(brand), `briefing-term-${part.term}`)}>
            {part.text}
          </span>
        );
      })}
    </>
  );
}

/** One block: the bold lead, then its plain sentences. `after` follows the last sentence. */
function Block({
  block,
  brand,
  monthly = null,
  partial = null,
  after,
}: {
  block: NarrativeBlock;
  brand: string;
  monthly?: EstimateResult | null;
  /** X-25: the lead's figure is stale or partial; its asterisk opens the tooltip. */
  partial?: PartialFigure | null;
  after?: ReactNode;
}) {
  return (
    <p style={BLOCK_STYLE} data-briefing-block={block.id}>
      {block.lead.length ? (
        <strong>
          <PartialFigureMark partial={partial} testId={`briefing-${block.id}-partial`}>
            <Sentence parts={block.lead} brand={brand} monthly={monthly} />
          </PartialFigureMark>
        </strong>
      ) : null}
      {block.body.map((sentence, index) => (
        <Fragment key={index}>
          {block.lead.length || index > 0 ? " " : null}
          <Sentence parts={sentence} brand={brand} monthly={monthly} />
        </Fragment>
      ))}
      {after}
    </p>
  );
}

function AnswerBlock({ input, brand, phase, partial }: { input: NarrativeInput; brand: string; phase: string; partial: PartialFigure | null }) {
  if (phase === "loading") return <p style={BLOCK_STYLE} data-briefing-block="answer">{ESTIMATE_LOADING}</p>;
  if (phase !== "ready") {
    return (
      <p style={BLOCK_STYLE} data-briefing-block="answer">
        <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, AI_READ_FAILED, "briefing-lead-ai")}>{NO_ANALYST_ESTIMATE}</span>
      </p>
    );
  }
  const block = answerBlock(input);
  const missing = block.notAvailable ? (
    <>
      {" "}
      <span {...figureTipAttrs(NO_ANALYST_ESTIMATE, NO_AI_ANSWERS_TIP, "briefing-lead-ai")}>{NO_ANALYST_ESTIMATE}</span>
    </>
  ) : null;
  return <Block block={block} brand={brand} partial={block.notAvailable ? null : partial} after={missing} />;
}

function WorthBlock({ bundle, brand }: { bundle: CanvasBundle; brand: string }) {
  const read = bundle.estimates;
  const monthly = read?.phase === "ready" ? estimateMonthlyPotential(read.estimates.phase1) : null;
  if (!read || read.phase === "loading") return <p style={BLOCK_STYLE} data-briefing-block="worth">{ESTIMATE_LOADING}</p>;
  const range = monthly?.status === "estimated" ? monthly.range : null;
  const block = worthBlock(range);
  const after = block.notAvailable ? (
    <>
      {" "}
      <EstimateFigure read={read} result={monthly} />
    </>
  ) : null;
  return <Block block={block} brand={brand} monthly={monthly} after={after} />;
}

/**
 * Summary › Briefing: "What this means for {brand}" (decisions 110, 128, 129; FDD H-09). Four
 * blocks chosen from live data by rule (lib/fender-canvas/briefing-narrative.ts), the selling-model
 * line, and the first move with a link to Action Items. One layout for every client.
 */
export function BriefingAiLead({
  bundle,
  retail,
  commandItems,
}: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
  commandItems: readonly PriorityItem[];
}) {
  const brand = brandName();
  const note = activeClientSettings().briefing_note;
  const ai = useSummaryAiRead();
  const aiStale = useSummaryAiStale(ai);
  const findability = useFindability();
  // The same findings the hero row shows, and the spec count Action Items shows, so the screens agree.
  const { findings } = briefingFindingsLead(retail, findability, ai, { aiStale });
  const summary = ai.phase === "ready" ? summarizeRun(ai.snapshot) : null;
  const input: NarrativeInput = {
    brand,
    site: brandSite(),
    unbranded: summary ? { wins: summary.roles.unbranded.fenderWins, resolved: summary.roles.unbranded.resolved } : null,
    branded: summary ? { wins: summary.roles.branded.fenderWins, resolved: summary.roles.branded.resolved } : null,
    cited: summary ? { owned: summary.citations.fenderOwnedRows, total: summary.citations.rows } : null,
    gaps: narrativeGaps(findings, retail.phase === "ready" ? specHero(retail.snapshot) : null),
  };
  const selling = sellingModelLine(activeClient().sellerModel, brand);
  const firstMove = firstMoveBlock(commandItems[0]?.title ?? null);

  return (
    <>
      <div className="ceo-callout" data-briefing-lead="" style={{ marginTop: 12 }}>
        <div className="ceo-callout-header">
          <span>What this means for {brand}</span>
        </div>
        <div className="ceo-callout-body">
          <AnswerBlock input={input} brand={brand} phase={ai.phase} partial={aiStale} />
          <Block block={relyBlock(input)} brand={brand} />
          <p style={BLOCK_STYLE} data-briefing-selling-model="">
            <strong>{selling.label}</strong> {selling.text}
          </p>
          <WorthBlock bundle={bundle} brand={brand} />
          <Block
            block={firstMove}
            brand={brand}
            after={
              <>
                {" "}
                <button
                  type="button"
                  className="plan-open"
                  data-ifai-open="suggestions"
                  data-ifai-tab="Urgent Interventions"
                  data-briefing-action-items=""
                >
                  → Action Items
                </button>
              </>
            }
          />
        </div>
      </div>
      {note ? (
        <div className="content-box" data-briefing-note="" style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{note}</p>
        </div>
      ) : null}
    </>
  );
}
