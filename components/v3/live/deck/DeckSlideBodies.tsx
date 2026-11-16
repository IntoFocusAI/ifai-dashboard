"use client";

import { figureTipAttrs } from "@/components/v3/live/FigureTip";
import { StatusMark } from "@/components/v3/live/StatusMark";
import { ANALYST_ESTIMATE, type DeckFigure, type DeckSlide } from "@/lib/deck/deck-types";

/** One figure: value (ice blue only when it is the slide's accent), N of M, status word, source tab. */
export function DeckFigureCard({ figure, large = false }: { figure: DeckFigure; large?: boolean }) {
  return (
    <div className={`deck-figure${large ? " deck-figure-large" : ""}`} data-deck-figure={figure.id} data-src={figure.source}>
      {figure.estimate ? <span className="deck-estimate-label">{ANALYST_ESTIMATE}</span> : null}
      <span className="deck-figure-label">{figure.label}</span>
      <span
        className={`deck-figure-value${figure.accent ? " is-accent" : ""}${figure.value.length > 9 ? " is-long" : ""}`}
        data-deck-figure-value=""
      >
        <span {...figureTipAttrs(figure.label, figure.tip)}>{figure.value}</span>
      </span>
      {figure.ratio ? (
        <span className="deck-figure-ratio" data-deck-figure-ratio="">
          {figure.ratio}
        </span>
      ) : null}
      {figure.status ? <StatusMark status={figure.status} word={figure.statusWord} /> : null}
      <span
        {...figureTipAttrs("Source", `Read from ${figure.source}, on the same run and window as the dashboard.`)}
        className="deck-figure-source ifai-term"
      >
        {figure.source}
      </span>
    </div>
  );
}

export function TitleBody({ slide }: { slide: DeckSlide }) {
  const figure = slide.figures[0];
  return (
    <div className="deck-title-body">
      <div className="deck-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {figure ? <DeckFigureCard figure={figure} large /> : null}
    </div>
  );
}

export function StatsBody({ slide }: { slide: DeckSlide }) {
  return (
    <div className={`deck-stats deck-stats-${slide.figures.length}`}>
      {slide.figures.map((figure) => (
        <DeckFigureCard key={figure.id} figure={figure} />
      ))}
    </div>
  );
}

export function BarsBody({ slide }: { slide: DeckSlide }) {
  const bars = slide.bars ?? [];
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const lead = slide.figures[0];
  return (
    <div className="deck-bars-body">
      <div className="deck-bars" data-deck-bars="">
        {bars.map((bar) => (
          <div key={bar.label} className="deck-bar-row" data-deck-bar={bar.label}>
            <span className="deck-bar-label">{bar.label}</span>
            <span className="deck-bar-track">
              <span
                {...figureTipAttrs(bar.label, bar.detail || null)}
                className={`deck-bar-fill deck-bar-tone-${bar.tone}`}
                style={{ width: `${(100 * bar.value) / max}%` }}
              />
            </span>
            <span className="deck-bar-ratio">{bar.ratio}</span>
          </div>
        ))}
      </div>
      <aside className="deck-bars-side">
        {lead ? <DeckFigureCard figure={lead} /> : null}
        {slide.callout ? <p className="deck-callout">{slide.callout}</p> : null}
      </aside>
    </div>
  );
}

export function PipelineBody({ slide }: { slide: DeckSlide }) {
  const steps = slide.steps ?? [];
  const markers = slide.markers ?? [];
  return (
    <div className="deck-pipeline">
      <ol className="deck-pipeline-steps">
        {steps.map((step, index) => (
          <li key={step} className="deck-pipeline-step">
            <span className="deck-step-number">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <ul className="deck-markers" data-deck-markers={markers.length}>
        {markers.map((marker) => (
          <li key={marker.title} className="deck-marker">
            <StatusMark status="bad" word="Gap" />
            <span className="deck-marker-title">{marker.title}</span>
            <span className="deck-marker-line">{marker.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FixesBody({ slide }: { slide: DeckSlide }) {
  const fixes = slide.fixes ?? [];
  return (
    <div className="deck-fixes-body">
      <ol className="deck-fixes" data-deck-fixes={fixes.length}>
        {fixes.map((fix) => (
          <li key={fix.rank} className="deck-fix">
            <span className="deck-fix-rank">{fix.rank}</span>
            <span className="deck-fix-action">{fix.action}</span>
            <span className="deck-fix-ratio">{fix.ratio}</span>
            {fix.status ? <StatusMark status={fix.status} word={fix.statusWord} /> : <span />}
          </li>
        ))}
      </ol>
      {slide.meta ? (
        <p className="deck-fix-meta" data-deck-figure={slide.meta.id} data-src={slide.meta.source}>
          {slide.meta.label}: <span className="is-accent">{slide.meta.value}</span> · {ANALYST_ESTIMATE}
        </p>
      ) : null}
    </div>
  );
}

export function TableBody({ slide }: { slide: DeckSlide }) {
  const table = slide.table;
  if (!table) return null;
  return (
    <div className="deck-table-body">
      <table className="deck-table">
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, at) => (
                <td key={at}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="deck-table-caption">{table.caption}</p>
    </div>
  );
}
