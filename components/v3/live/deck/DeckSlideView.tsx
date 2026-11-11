"use client";

import { BarsBody, FixesBody, PipelineBody, StatsBody, TableBody, TitleBody } from "@/components/v3/live/deck/DeckSlideBodies";
import type { DeckModel, DeckSlide } from "@/lib/deck/deck-types";

function SlideBody({ slide }: { slide: DeckSlide }) {
  if (slide.kind === "title") return <TitleBody slide={slide} />;
  if (slide.kind === "bars") return <BarsBody slide={slide} />;
  if (slide.kind === "pipeline") return <PipelineBody slide={slide} />;
  if (slide.kind === "fixes") return <FixesBody slide={slide} />;
  if (slide.kind === "table") return <TableBody slide={slide} />;
  return <StatsBody slide={slide} />;
}

/** One slide on the stage: eyebrow, headline, why it matters, the proof, and its sources and run. */
export function DeckSlideView({
  model,
  slide,
  position,
  active,
}: {
  model: DeckModel;
  slide: DeckSlide;
  position: number;
  active: boolean;
}) {
  const runLine = [
    model.window,
    model.runId ? `Run ${model.runId}` : null,
    model.asOf ? `Data as of ${model.asOf}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section
      className={`deck-slide deck-slide-${slide.kind}${active ? " is-active" : ""}`}
      data-deck-slide={slide.id}
      data-deck-backstage={slide.backstage ? "" : undefined}
      aria-hidden={!active}
    >
      <header className="deck-slide-head">
        <p className="deck-eyebrow">
          {model.brand} · {slide.backstage ? "Backstage" : slide.act}
        </p>
        <h2 className="deck-headline">{slide.headline}</h2>
        <p className="deck-why">{slide.why}</p>
      </header>
      <div className="deck-slide-body">
        <SlideBody slide={slide} />
      </div>
      <footer className="deck-slide-foot">
        <span className="deck-foot-source" data-deck-sources="">
          Source: {slide.sources.join("; ")}
        </span>
        <span className="deck-foot-run" data-deck-run="">
          {runLine}
        </span>
        <span className="deck-foot-mark">
          IntoFocus AI · {position} of {model.slides.length}
        </span>
      </footer>
    </section>
  );
}
