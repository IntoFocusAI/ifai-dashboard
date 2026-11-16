"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DeckSlideView } from "@/components/v3/live/deck/DeckSlideView";
import { useDeckModel } from "@/components/v3/live/deck/useDeckModel";
import type { DeckModel } from "@/lib/deck/deck-types";
import type { RetailCanvasRead } from "@/lib/fender-canvas/portfolio-retail-display";
import type { CanvasBundle } from "@/lib/fender-canvas/types";

/** Slides are laid out on this stage and scaled to the screen, so nothing reflows or overflows. */
export const STAGE = { width: 1600, height: 900 } as const;

function useStageScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE.width, (window.innerHeight - 48) / STAGE.height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

function DeckControls({
  model,
  index,
  go,
  notes,
  setNotes,
  onClose,
  rootRef,
}: {
  model: DeckModel;
  index: number;
  go: (next: number) => void;
  notes: boolean;
  setNotes: (next: boolean) => void;
  onClose: () => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
}) {
  const slide = model.slides[index];
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };
  return (
    <div className="deck-controls" data-deck-controls="">
      <button type="button" className="deck-control" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide">
        Previous
      </button>
      <span className="deck-position" data-deck-position="">
        {slide.backstage ? "Backstage · " : ""}
        {index + 1} of {model.slides.length}
      </span>
      <button
        type="button"
        className="deck-control"
        onClick={() => go(index + 1)}
        disabled={index === model.slides.length - 1}
        aria-label="Next slide"
      >
        Next
      </button>
      <span className="deck-controls-gap" />
      <button type="button" className="deck-control" aria-pressed={notes} onClick={() => setNotes(!notes)}>
        Notes
      </button>
      <button type="button" className="deck-control" onClick={fullscreen}>
        Full screen
      </button>
      <button type="button" className="deck-control" data-deck-print="" onClick={() => window.print()}>
        Print or save PDF
      </button>
      <button type="button" className="deck-control" data-deck-close="" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function DeckPresenter({ model, onClose }: { model: DeckModel; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState(false);
  const scale = useStageScale();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const count = model.slides.length;
  const firstBackstage = model.slides.findIndex((slide) => slide.backstage);
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(count - 1, next))), [count]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      if (key === "ArrowRight" || key === "PageDown" || key === " ") go(index + 1);
      else if (key === "ArrowLeft" || key === "PageUp") go(index - 1);
      else if (key === "Home") go(0);
      else if (key === "End") go(count - 1);
      else if (key === "ArrowDown" && firstBackstage >= 0 && index < firstBackstage) go(firstBackstage);
      else if (key === "ArrowUp" && firstBackstage > 0 && index >= firstBackstage) go(firstBackstage - 1);
      else if (key === "n" || key === "N") setNotes((value) => !value);
      else if (key === "f" || key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void rootRef.current?.requestFullscreen?.();
      } else if (key === "Escape" && !document.fullscreenElement) onClose();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    // Capture, so the map's own keys do not move behind the deck.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [count, firstBackstage, go, index, onClose]);

  const slide = model.slides[index];
  return (
    <div className="deck-root" ref={rootRef} data-deck="" data-deck-slide-count={count} role="dialog" aria-label={model.title}>
      <div className="deck-viewport">
        <div
          className="deck-stage"
          style={{ width: STAGE.width, height: STAGE.height, transform: `scale(${scale})` }}
          data-deck-stage=""
        >
          {model.slides.map((item, at) => (
            <DeckSlideView key={item.id} model={model} slide={item} position={at + 1} active={at === index} />
          ))}
        </div>
      </div>
      {notes ? (
        <p className="deck-notes" data-deck-notes="">
          {slide.note}
        </p>
      ) : null}
      <DeckControls model={model} index={index} go={go} notes={notes} setNotes={setNotes} onClose={onClose} rootRef={rootRef} />
    </div>
  );
}

export function DeckOverlay({
  bundle,
  retail,
  onClose,
}: {
  bundle: CanvasBundle;
  retail: RetailCanvasRead;
  onClose: () => void;
}) {
  const load = useDeckModel(bundle, retail);

  useEffect(() => {
    document.documentElement.classList.add("deck-open");
    return () => document.documentElement.classList.remove("deck-open");
  }, []);

  if (load.phase === "loading") {
    return (
      <div className="deck-root" data-deck="" data-deck-loading="">
        <p className="deck-loading">Loading the deck from the current reads.</p>
        <button type="button" className="deck-control deck-loading-close" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  return <DeckPresenter model={load.model} onClose={onClose} />;
}
