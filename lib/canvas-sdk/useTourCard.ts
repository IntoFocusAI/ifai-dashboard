"use client";

import {
  TOUR_CARD_GUTTER,
  TOUR_FRAME_SCALE,
  TOUR_HOLE_SCALE,
  chooseTourCardSide,
  circleBoxClearance,
  framingInset,
  type Box,
  type Circle,
  type TourCardSide,
} from "@/lib/canvas-sdk/tour-card-placement";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type FramePoint = (viewX: number, viewY: number, scale: number, insetRight?: number) => void;

type Options = {
  active: boolean;
  stepIndex: number;
  target: { x: number; y: number; radius: number } | null;
  rootRef: RefObject<HTMLElement | null>;
  overlayRef: RefObject<HTMLElement | null>;
  cardRef: RefObject<HTMLElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  viewBox?: { w: number; h: number };
  framePoint: FramePoint;
  /** How long the camera takes to reach a node; a held card shows by then regardless. */
  cameraMs?: number;
};

const DEFAULT_VIEWBOX = { w: 1600, h: 1000 };

function ringCircle(svg: SVGSVGElement | null): Circle | null {
  const ring = svg?.querySelector("#tour-spotlight-ring");
  if (!ring) return null;
  const box = ring.getBoundingClientRect();
  if (box.width <= 0) return null;
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    r: (box.width / 2) * TOUR_HOLE_SCALE,
  };
}

/** The card's laid-out box, ignoring its slide-in transform. */
function cardBox(card: HTMLElement, overlay: HTMLElement): Box {
  const host = overlay.getBoundingClientRect();
  const left = host.left + card.offsetLeft;
  const top = host.top + card.offsetTop;
  return { left, top, right: left + card.offsetWidth, bottom: top + card.offsetHeight };
}

function replayEntrance(card: HTMLElement) {
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.removeProperty("animation");
}

function release(card: HTMLElement) {
  if (card.dataset.held !== "true") return;
  delete card.dataset.held;
  replayEntrance(card);
}

/**
 * Places the tour card on whichever side keeps it off the lit area for the whole
 * camera move, frames the node in the room beside it, and cuts the dimmer hole
 * over the node each frame. When neither side is clear where the move starts,
 * the card stays transparent until the lit area has slid out from under it.
 */
export function useTourCard({
  active,
  stepIndex,
  target,
  rootRef,
  overlayRef,
  cardRef,
  svgRef,
  viewportRef,
  viewBox = DEFAULT_VIEWBOX,
  framePoint,
  cameraMs = 600,
}: Options) {
  const holdUntil = useRef(0);
  const targetX = target?.x;
  const targetY = target?.y;
  const targetRadius = target?.radius;

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!active) {
      holdUntil.current = 0;
      if (card) delete card.dataset.held;
      return;
    }
    const overlay = overlayRef.current;
    const viewport = viewportRef.current;
    if (targetX === undefined || targetY === undefined || targetRadius === undefined) return;
    if (!card || !overlay || !viewport) {
      framePoint(targetX, targetY, TOUR_FRAME_SCALE);
      return;
    }

    const current: TourCardSide = card.dataset.side === "right" ? "right" : "left";
    const width = card.offsetWidth;
    const inset = current === "left" ? card.offsetLeft : overlay.clientWidth - card.offsetLeft - width;
    const zone = inset + width + TOUR_CARD_GUTTER;
    const placed = cardBox(card, overlay);
    const host = overlay.getBoundingClientRect();
    const cardFor = (side: TourCardSide): Box => {
      const left = side === "left" ? host.left + inset : host.right - inset - width;
      return { left, top: placed.top, right: left + width, bottom: placed.bottom };
    };

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const frame = viewport.getBoundingClientRect();
    const fit = Math.min(vw / viewBox.w, vh / viewBox.h);
    const endFor = (side: TourCardSide): Circle => ({
      x: frame.left + (vw - framingInset(side, vw, zone)) / 2,
      y: frame.top + vh / 2,
      r: targetRadius * fit * TOUR_FRAME_SCALE * TOUR_HOLE_SCALE,
    });
    const start = ringCircle(svgRef.current) ?? endFor(current);

    const plan = chooseTourCardSide({ current, start, endFor, cardFor });
    if (plan.side !== current) {
      if (plan.side === "right") card.dataset.side = "right";
      else delete card.dataset.side;
      replayEntrance(card);
    }
    if (plan.clearance < 0) {
      card.dataset.held = "true";
      holdUntil.current = performance.now() + cameraMs;
    } else {
      holdUntil.current = 0;
      release(card);
    }
    framePoint(targetX, targetY, TOUR_FRAME_SCALE, framingInset(plan.side, vw, zone));
  }, [
    active,
    stepIndex,
    targetX,
    targetY,
    targetRadius,
    cameraMs,
    cardRef,
    framePoint,
    overlayRef,
    svgRef,
    viewBox.h,
    viewBox.w,
    viewportRef,
  ]);

  /* The ring sits inside the panned SVG and the camera eases between nodes, so
     the hole follows its rendered box per frame rather than the camera target. */
  useEffect(() => {
    const overlay = overlayRef.current;
    const root = rootRef.current;
    if (!overlay || !root || !active) return;

    let frame = 0;
    const track = () => {
      const hole = ringCircle(svgRef.current);
      if (hole) {
        const host = root.getBoundingClientRect();
        overlay.style.setProperty("--tour-hole-x", `${hole.x - host.left}px`);
        overlay.style.setProperty("--tour-hole-y", `${hole.y - host.top}px`);
        overlay.style.setProperty("--tour-hole-r", `${Math.round(hole.r)}px`);
        const card = cardRef.current;
        if (card && holdUntil.current) {
          const clear = circleBoxClearance(hole, cardBox(card, overlay)) >= 0;
          if (clear || performance.now() >= holdUntil.current) {
            holdUntil.current = 0;
            release(card);
          }
        }
      }
      frame = requestAnimationFrame(track);
    };
    track();

    return () => {
      cancelAnimationFrame(frame);
      overlay.style.removeProperty("--tour-hole-x");
      overlay.style.removeProperty("--tour-hole-y");
      overlay.style.removeProperty("--tour-hole-r");
    };
  }, [active, cardRef, overlayRef, rootRef, svgRef]);
}
