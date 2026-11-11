"use client";

import { useSlidingChrome } from "@/lib/canvas-sdk/useSlidingChrome";
import { Compass, Minus, Plus } from "lucide-react";

type Props = {
  open: boolean;
  exiting: boolean;
  onExitComplete: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
};

export function CanvasHudZoomControls({
  open,
  exiting,
  onExitComplete,
  onZoomIn,
  onZoomOut,
  onResetView,
}: Props) {
  const { mounted, onScreen, onTransitionEnd } = useSlidingChrome(
    open,
    exiting,
    onExitComplete,
  );

  if (!mounted) return null;

  return (
    <div
      className={`canvas-hud-controls map-chrome-slide${onScreen ? " map-chrome-onscreen" : ""}`}
      onTransitionEnd={onTransitionEnd}
      aria-hidden={!onScreen}
    >
      <div className="hud-btn-group">
        <button
          type="button"
          className="hud-btn"
          onClick={onZoomIn}
          aria-label="Zoom in"
          tabIndex={onScreen ? 0 : -1}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="hud-btn"
          onClick={onZoomOut}
          aria-label="Zoom out"
          tabIndex={onScreen ? 0 : -1}
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          className="hud-btn"
          onClick={onResetView}
          aria-label="Center and overview"
          tabIndex={onScreen ? 0 : -1}
        >
          <Compass size={16} />
        </button>
      </div>
    </div>
  );
}
